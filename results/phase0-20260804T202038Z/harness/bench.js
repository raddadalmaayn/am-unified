'use strict';
/**
 * bench.js — AM unified-chaincode distributed benchmark harness (v2).
 *
 * Replaces geo_benchmark.js, which dispatched concurrent load through a wave
 * barrier (Promise.allSettled over a batch of W before dispatching the next W).
 * This harness maintains a fixed in-flight window W with no barrier: a worker
 * dispatches its next transaction the instant its previous one settles.
 *
 * Everything measured is persisted per transaction to txs.jsonl. No statistic
 * is computed here that cannot be recomputed from that file by analyze.js.
 *
 * HARNESS_VERSION is written into every manifest.
 */

const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc    = require('@grpc/grpc-js');
const crypto  = require('crypto');
const fs      = require('fs');
const fsp     = require('fs').promises;
const path    = require('path');
const os      = require('os');
const { execFileSync } = require('child_process');
const { TextDecoder } = require('util');

const HARNESS_VERSION = '2.0.0';
const utf8Decoder = new TextDecoder();

// ── Network configuration ───────────────────────────────────────────────────
const channelName   = 'amchannel';
const chaincodeName = 'unified';
const mspId         = 'Org1MSP';
const cryptoBase    = path.resolve(process.env.HOME, 'fabric-network', 'peerOrganizations', 'org1.example.com');
const peerEndpoint  = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';
const tlsCertPath   = path.join(cryptoBase, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');

const PROV_CC  = 'ProvenanceContract';
const REP_CC   = 'ReputationContract';
const INTEG_CC = 'IntegrationContract';

const ADMIN_USER = 'Admin';
const TEST_USER  = 'User1';
const MIN_STAKE  = '10000';

const FABINFO = path.resolve(process.env.HOME, 'am-unified', 'client-tests', 'fabinfo.sh');
const CC_SHA256_EXPECTED = '46ae8a9f2cfcac4cf967ddcd0bf47e381f3f3377b8647b52c94dd39cb40ecff5';

// ── Error taxonomy (1d) ─────────────────────────────────────────────────────
const E = {
  MVCC:        'MVCC_READ_CONFLICT',
  PHANTOM:     'PHANTOM_READ_CONFLICT',
  ENDORSE_POL: 'ENDORSEMENT_POLICY_FAILURE',
  CC_REJECT:   'CHAINCODE_REJECT',
  MISMATCH:    'ENDORSE_MISMATCH',
  DEADLINE:    'GATEWAY_DEADLINE',
  UNAVAIL:     'GATEWAY_UNAVAILABLE',
  ORD_UNAVAIL: 'ORDERER_UNAVAILABLE',
  COMMIT_TO:   'COMMIT_TIMEOUT',
  OTHER:       'OTHER',
};
const ALL_ERROR_CLASSES = Object.values(E);

// Fabric TxValidationCode numbers we care about.
const VC = { 0: 'VALID', 10: 'ENDORSEMENT_POLICY_FAILURE', 11: 'MVCC_READ_CONFLICT', 12: 'PHANTOM_READ_CONFLICT' };

/**
 * Classify a failure into exactly one class. Never returns undefined.
 * `phase` is 'endorse' | 'submit' | 'commit' and disambiguates identical
 * gRPC codes arising at different stages.
 */
function classifyError(err, phase) {
  const name = err && err.constructor ? err.constructor.name : 'Unknown';
  const msg  = (err && err.message) || '';
  const details = (err && Array.isArray(err.details))
    ? err.details.map(d => (d && d.message) || '').join(' | ')
    : '';
  const hay = `${msg} ${details}`;
  const grpcCode = (err && typeof err.code === 'number') ? err.code : null;

  // Commit-stage validation codes are authoritative.
  if (phase === 'commit') {
    if (err && typeof err.code === 'number' && VC[err.code]) {
      if (err.code === 11) return E.MVCC;
      if (err.code === 12) return E.PHANTOM;
      if (err.code === 10) return E.ENDORSE_POL;
    }
  }
  if (/MVCC_READ_CONFLICT/.test(hay)) return E.MVCC;
  if (/PHANTOM_READ_CONFLICT/.test(hay)) return E.PHANTOM;
  if (/ENDORSEMENT_POLICY_FAILURE/.test(hay)) return E.ENDORSE_POL;

  // Endorsement disagreement between peers.
  if (/ProposalResponsePayloads do not match|proposal response payloads do not match|failed to assemble transaction/i.test(hay))
    return E.MISMATCH;

  // Chaincode returned a non-success status during endorsement. This is where
  // the lifecycle predecessor assertion surfaces.
  if (/chaincode response 500|status: 500|invalid lifecycle transition|caller cannot rate themselves|insufficient stake|invalid dimension|does not meet reputation gate|blocked by confidence gate/i.test(hay))
    return E.CC_REJECT;

  if (grpcCode === 4  || /DEADLINE_EXCEEDED|deadline exceeded/i.test(hay)) {
    return phase === 'commit' ? E.COMMIT_TO : E.DEADLINE;
  }
  if (grpcCode === 14 || /UNAVAILABLE/i.test(hay)) {
    if (phase === 'submit' || /orderer|ordering service|no orderer/i.test(hay)) return E.ORD_UNAVAIL;
    return E.UNAVAIL;
  }
  if (/orderer|ordering service/i.test(hay)) return E.ORD_UNAVAIL;

  return E.OTHER;
}

function errorSummary(err) {
  const name = err && err.constructor ? err.constructor.name : 'Unknown';
  const msg  = (err && err.message) || String(err);
  const details = (err && Array.isArray(err.details))
    ? ' :: ' + err.details.map(d => `${d.address || ''}(${d.mspId || ''}): ${d.message || ''}`).join(' | ')
    : '';
  return `${name}: ${msg}${details}`.slice(0, 500);
}

// ── JSONL writer (1b) ───────────────────────────────────────────────────────
class JsonlWriter {
  constructor(file, flushEvery = 100) {
    this.file = file;
    this.buf = [];
    this.flushEvery = flushEvery;
    this.written = 0;
  }
  write(obj) {
    this.buf.push(JSON.stringify(obj));
    if (this.buf.length >= this.flushEvery) this.flush();
  }
  flush() {
    if (!this.buf.length) return;
    // appendFileSync: durable at the point of flush. The fault phases are
    // exactly where a lost buffer would cost the result.
    fs.appendFileSync(this.file, this.buf.join('\n') + '\n');
    this.written += this.buf.length;
    this.buf = [];
  }
}

// ── Fabric plumbing ─────────────────────────────────────────────────────────
async function newGrpcConnection() {
  const tlsRootCert = await fsp.readFile(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': peerHostAlias,
    'grpc.max_receive_message_length': 100 * 1024 * 1024,
    'grpc.max_send_message_length':    100 * 1024 * 1024,
  });
}

async function certDirFirstFile(dir) {
  const files = await fsp.readdir(dir);
  return path.join(dir, files[0]);
}

async function newIdentity(username) {
  const certDir = path.join(cryptoBase, 'users', `${username}@org1.example.com`, 'msp', 'signcerts');
  const credentials = await fsp.readFile(await certDirFirstFile(certDir));
  return { mspId, credentials };
}

async function newSigner(username) {
  const keyDir = path.join(cryptoBase, 'users', `${username}@org1.example.com`, 'msp', 'keystore');
  const privateKeyPem = await fsp.readFile(await certDirFirstFile(keyDir));
  return signers.newPrivateKeySigner(crypto.createPrivateKey(privateKeyPem));
}

/**
 * Gateways are built ONCE per user and reused for every transaction.
 * The old harness constructed a fresh gateway inside every submit helper,
 * which put identity loading and key parsing on the measured path.
 */
async function newGatewayForUser(client, username) {
  const identity = await newIdentity(username);
  const signer   = await newSigner(username);
  return connect({
    client, identity, signer,
    evaluateOptions:     () => ({ deadline: Date.now() + 15_000 }),
    endorseOptions:      () => ({ deadline: Date.now() + 60_000 }),
    submitOptions:       () => ({ deadline: Date.now() + 60_000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 300_000 }),
  });
}

// ── Phase-split submit (1c) ─────────────────────────────────────────────────
/**
 * Returns a fully-populated per-transaction record. Never throws.
 * fabric-gateway 1.10.1 exposes newProposal/endorse/submit/getStatus, so
 * endorsement and order+commit are measured separately rather than approximated.
 */
async function submitSplit(contract, fnName, args, meta) {
  const rec = {
    run_id: meta.run_id, condition: meta.condition, run_index: meta.run_index,
    worker_slot: meta.worker_slot, seq: meta.seq, target_key: meta.target_key,
    tx_id: null,
    t_submit_ns: null, t_endorsed_ns: null, t_submitted_ns: null, t_committed_ns: null,
    latency_endorse_ms: null, latency_order_commit_ms: null, latency_total_ms: null,
    status: 'COMMITTED', error_class: null, error_code: null,
    validation_code: null, error_raw: null, warmup: meta.warmup,
  };
  const t0 = process.hrtime.bigint();
  rec.t_submit_ns = t0.toString();
  let phase = 'endorse';
  try {
    const proposal = contract.newProposal(fnName, { arguments: args });
    const transaction = await proposal.endorse();
    const t1 = process.hrtime.bigint();
    rec.t_endorsed_ns = t1.toString();
    rec.tx_id = transaction.getTransactionId();

    phase = 'submit';
    const commit = await transaction.submit();
    const t2 = process.hrtime.bigint();
    rec.t_submitted_ns = t2.toString();

    phase = 'commit';
    const status = await commit.getStatus();
    const t3 = process.hrtime.bigint();
    rec.t_committed_ns = t3.toString();
    rec.validation_code = (status && status.code !== undefined) ? status.code : null;

    rec.latency_endorse_ms      = Number(t1 - t0) / 1e6;
    rec.latency_order_commit_ms = Number(t3 - t1) / 1e6;
    rec.latency_total_ms        = Number(t3 - t0) / 1e6;

    if (!status || status.successful !== true) {
      rec.status = 'FAILED';
      rec.error_class = VC[rec.validation_code] === 'MVCC_READ_CONFLICT' ? E.MVCC
                      : VC[rec.validation_code] === 'PHANTOM_READ_CONFLICT' ? E.PHANTOM
                      : VC[rec.validation_code] === 'ENDORSEMENT_POLICY_FAILURE' ? E.ENDORSE_POL
                      : E.OTHER;
      rec.error_code = String(rec.validation_code);
      rec.error_raw  = `commit status not successful, validation_code=${rec.validation_code}`;
    }
    return rec;
  } catch (err) {
    const tE = process.hrtime.bigint();
    rec.status = 'FAILED';
    rec.error_class = classifyError(err, phase);
    rec.error_code  = (err && err.code !== undefined) ? String(err.code) : null;
    rec.error_raw   = errorSummary(err);
    rec.latency_total_ms = Number(tE - t0) / 1e6;
    if (rec.t_endorsed_ns) {
      rec.latency_endorse_ms = Number(BigInt(rec.t_endorsed_ns) - t0) / 1e6;
      rec.latency_order_commit_ms = Number(tE - BigInt(rec.t_endorsed_ns)) / 1e6;
    }
    return rec;
  }
}

/** Read path (condition D). Evaluate only; no ordering phase. */
async function evaluateRead(contract, fnName, args, meta) {
  const rec = {
    run_id: meta.run_id, condition: meta.condition, run_index: meta.run_index,
    worker_slot: meta.worker_slot, seq: meta.seq, target_key: meta.target_key,
    tx_id: null,
    t_submit_ns: null, t_endorsed_ns: null, t_submitted_ns: null, t_committed_ns: null,
    latency_endorse_ms: null, latency_order_commit_ms: null, latency_total_ms: null,
    status: 'COMMITTED', error_class: null, error_code: null,
    validation_code: null, error_raw: null, warmup: meta.warmup,
  };
  const t0 = process.hrtime.bigint();
  rec.t_submit_ns = t0.toString();
  try {
    await contract.evaluateTransaction(fnName, ...args);
    const t1 = process.hrtime.bigint();
    rec.t_committed_ns = t1.toString();
    rec.latency_total_ms = Number(t1 - t0) / 1e6;
    return rec;
  } catch (err) {
    const tE = process.hrtime.bigint();
    rec.status = 'FAILED';
    rec.error_class = classifyError(err, 'endorse');
    rec.error_code  = (err && err.code !== undefined) ? String(err.code) : null;
    rec.error_raw   = errorSummary(err);
    rec.latency_total_ms = Number(tE - t0) / 1e6;
    return rec;
  }
}

// ── Load generator (1a) ─────────────────────────────────────────────────────
/**
 * Fixed in-flight window. W independent workers each loop: take the next seq,
 * run one transaction, record, immediately take the next. There is no point at
 * which a worker waits on any other worker. W=1 gives the sequential case
 * through the identical code path.
 *
 * Returns timing boundaries needed for the steady-state window (1e).
 */
async function runLoad({ total, W, taskFn, writer, warmupCount, warmupMs }) {
  let next = 0;
  let completed = 0;
  const wallStartNs = process.hrtime.bigint();
  let lastWarmupEndNs = null;
  let firstDrainNs = null;   // first moment in-flight drops below W

  const worker = async (slot) => {
    while (true) {
      const seq = next++;
      if (seq >= total) {
        // This worker has no more work: in-flight is about to drop below W.
        if (firstDrainNs === null) firstDrainNs = process.hrtime.bigint();
        return;
      }
      const nowNs = process.hrtime.bigint();
      const elapsedMs = Number(nowNs - wallStartNs) / 1e6;
      const isWarmup = (seq < warmupCount) || (elapsedMs < warmupMs);
      const rec = await taskFn(seq, slot, isWarmup);
      completed++;
      if (rec.warmup) lastWarmupEndNs = process.hrtime.bigint();
      writer.write(rec);
    }
  };

  await Promise.all(Array.from({ length: W }, (_, slot) => worker(slot)));
  const wallEndNs = process.hrtime.bigint();
  writer.flush();

  return {
    wall_start_ns: wallStartNs.toString(),
    wall_end_ns: wallEndNs.toString(),
    steady_start_ns: (lastWarmupEndNs || wallStartNs).toString(),
    steady_end_ns: (firstDrainNs || wallEndNs).toString(),
    steady_duration_ms: Number((firstDrainNs || wallEndNs) - (lastWarmupEndNs || wallStartNs)) / 1e6,
    total_duration_ms: Number(wallEndNs - wallStartNs) / 1e6,
    completed,
  };
}

// ── Environment capture for the manifest (1g) ───────────────────────────────
function sh(cmd, args) {
  try { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 120000 }).trim(); }
  catch (e) { return `ERROR: ${e.message}`.slice(0, 300); }
}

function fabInfo() {
  try { return JSON.parse(sh('bash', [FABINFO, channelName])); }
  catch (e) { return { error: `fabinfo failed: ${e.message}`.slice(0, 300) }; }
}

/**
 * Peers commit asynchronously, so a snapshot taken the instant the last
 * transaction returns can catch a peer mid-propagation and look like a fork
 * when it is only lag. Poll until all four agree on height AND hash, or until
 * timeout. Convergence time is itself recorded: a peer that never converges is
 * a real finding, one that converges in 400 ms is not.
 */
function fabInfoConverged(timeoutMs = 30000, pollMs = 500) {
  const t0 = Date.now();
  let last = null;
  let attempts = 0;
  while (Date.now() - t0 < timeoutMs) {
    last = fabInfo();
    attempts++;
    const orgs = ['org1', 'org2', 'org3', 'org4'];
    const hs = orgs.map(o => last.peers && last.peers[o] && last.peers[o].height);
    const bs = orgs.map(o => last.peers && last.peers[o] && last.peers[o].currentBlockHash);
    if (hs.every(h => typeof h === 'number') &&
        new Set(hs).size === 1 && new Set(bs).size === 1) {
      last.convergence = { converged: true, wait_ms: Date.now() - t0, polls: attempts };
      return last;
    }
    execFileSync('sleep', [String(pollMs / 1000)]);
  }
  if (last) last.convergence = { converged: false, wait_ms: Date.now() - t0, polls: attempts };
  return last || { error: 'fabInfoConverged: no snapshot' };
}

/**
 * D1 has no outbound SSH access to the other lab nodes (verified: publickey
 * denied to D2/D3/D4 and to itself). Cross-node environment capture is
 * therefore performed on the laptop by collect_env.sh and handed to the
 * harness as --env-file. sshCollect remains only as a fallback for the case
 * where the harness is run from a host that does have SSH access.
 */
function sshCollect(host, cmd) {
  return sh('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', `@${host}`, cmd]);
}

function loadEnvFile(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return { error: `env-file unreadable: ${e.message}`.slice(0, 300) }; }
}

const NODES = {
  D1: 'D1', D2: 'D2', D3: 'D3', D4: 'D4',
};

/**
 * Image DIGESTS, not tags (amendment D1: :latest is not pinned).
 * Chaincode binary sha256 (amendment P3) is the only integrity binding for the
 * deployed code, since CCAAS lifecycle definitions do not hash the binary.
 */
function containerInventory() {
  const inv = {};
  for (const [node, ip] of Object.entries(NODES)) {
    const raw = sshCollect(ip,
      'for c in $(docker ps --format "{{.Names}}"); do ' +
      'echo "$c|$(docker inspect $c --format "{{.Config.Image}}")|' +
      '$(docker inspect $c --format "{{.Image}}")|' +
      '$(docker inspect $c --format "{{.State.StartedAt}}")"; done');
    inv[node] = raw.split('\n').filter(Boolean).map(l => {
      const [name, image_tag, image_digest, started_at] = l.split('|');
      return { name, image_tag, image_digest, started_at };
    });
    inv[node + '_cc_sha256'] = sshCollect(ip,
      'docker exec cc-unified sha256sum /chaincode/unified_ccaas 2>/dev/null | cut -d" " -f1');
  }
  return inv;
}

function qdiscState() {
  const IF = { D1: 'enp4s0f0', D2: 'enp0s25', D3: 'eno1', D4: 'eno1' };
  const out = {};
  for (const [node, ip] of Object.entries(NODES)) {
    out[node] = { iface: IF[node], qdisc: sshCollect(ip, `tc qdisc show dev ${IF[node]}`) };
  }
  return out;
}

function decodedChannelParams() {
  const raw = sh('bash', ['-lc',
    `export PATH=$HOME/fabric-tools/bin:$PATH; cd /tmp && rm -f _m.pb _m.json && ` +
    `source /tmp/pe.sh 1 7051 >/dev/null 2>&1; ` +
    `peer channel fetch config /tmp/_m.pb -o orderer.example.com:7050 ` +
    `--ordererTLSHostnameOverride orderer.example.com -c ${channelName} --tls --cafile $ORDERER_CA >/dev/null 2>&1 && ` +
    `configtxlator proto_decode --input /tmp/_m.pb --type common.Block 2>/dev/null | ` +
    `jq -c '{config_sequence:.data.data[0].payload.data.config.sequence,` +
    `batch_timeout:.data.data[0].payload.data.config.channel_group.groups.Orderer.values.BatchTimeout.value.timeout,` +
    `batch_size:.data.data[0].payload.data.config.channel_group.groups.Orderer.values.BatchSize.value,` +
    `endorsement:.data.data[0].payload.data.config.channel_group.groups.Application.policies.Endorsement.policy.value,` +
    `consenters:[.data.data[0].payload.data.config.channel_group.groups.Orderer.values.ConsensusType.value.metadata.consenters[]|{host,port}],` +
    `raft_options:.data.data[0].payload.data.config.channel_group.groups.Orderer.values.ConsensusType.value.metadata.options}'`]);
  try { return JSON.parse(raw); } catch (e) { return { error: raw.slice(0, 400) }; }
}

// ── Workload definitions (1i: key discipline + lifecycle order) ─────────────
/**
 * Every key is namespaced by run_id, so no two runs collide. Reusing keys
 * between runs would change MVCC behaviour.
 *
 * LIFECYCLE ORDER: the deployed chaincode asserts the predecessor stage on
 * every path including the bridge. All write conditions here use GENESIS
 * events (MATERIAL_CERTIFICATION) against a FRESH asset per transaction, which
 * requires stage "" and is therefore always legal. This matches the workload
 * shape the previous harness used, so the numbers stay comparable, while
 * remaining valid under the assertion.
 */
function makeWorkload(condition, run_id, contracts) {
  const rnd = () => `sha256:${crypto.randomBytes(16).toString('hex')}`;
  switch (condition) {
    case 'A': // sequential provenance write
    case 'E': // concurrent provenance, distinct keys
      return (seq) => {
        const assetID = `${run_id}-PART-${seq}`;
        return { key: assetID, cc: contracts.prov, fn: 'CreateMaterialCertification',
                 args: [assetID, 'Ti-6Al-4V', `${run_id}-BATCH-${seq}`, 'SupplierAlpha', rnd()] };
      };
    case 'B': // sequential reputation write
    case 'F': // concurrent reputation, distinct actor-dimension pairs
      return (seq) => {
        const actor = `${run_id}-ACTOR-${seq}`;
        return { key: `${actor}:quality`, cc: contracts.rep, fn: 'SubmitRating',
                 args: [actor, 'quality', '0.8', rnd(), String(Math.floor(Date.now() / 1000))] };
      };
    case 'C': // sequential bridge write
    case 'G': // concurrent bridge, distinct keys
      return (seq) => {
        const assetID = `${run_id}-BASSET-${seq}`;
        const actor   = `${run_id}-BACTOR-${seq}`;
        return { key: assetID, cc: contracts.integ, fn: 'RecordProvenanceWithReputation',
                 args: [assetID, 'MATERIAL_CERTIFICATION', rnd(), actor, '0.9', 'quality', rnd()] };
      };
    case 'H': // high contention: ALL transactions target ONE actor-dimension key
      return (seq) => {
        const actor = `${run_id}-HOTACTOR`;
        return { key: `${actor}:quality`, cc: contracts.rep, fn: 'SubmitRating',
                 args: [actor, 'quality', '0.8', rnd(), String(Math.floor(Date.now() / 1000))] };
      };
    case 'D': // read: GetPartTrustReport
      return (seq) => ({ key: null, cc: contracts.integ, fn: 'GetPartTrustReport',
                         args: [], read: true });
    default:
      throw new Error(`unknown condition ${condition}`);
  }
}

const READ_CONDITIONS = new Set(['D']);

// ── One measured run ────────────────────────────────────────────────────────
async function runCondition(opts) {
  const {
    condition, run_index, W, total, outRoot, sessionId, gateways, contracts,
    readTargetKey, cooldownObservedMs, extraManifest,
  } = opts;

  const run_id  = `${sessionId}-${condition}-r${run_index}`;
  const runDir  = path.join(outRoot, condition, `run${run_index}`);
  fs.mkdirSync(runDir, { recursive: true });
  const jsonlPath = path.join(runDir, 'txs.jsonl');
  const writer = new JsonlWriter(jsonlPath, 100);

  const wallClockStart = new Date().toISOString();
  console.log(`\n[${condition} run${run_index}] W=${W} total=${total} run_id=${run_id}`);

  // 1h + D3: ledger and orderer state BEFORE
  const before = fabInfo();

  const isRead = READ_CONDITIONS.has(condition);
  const workload = makeWorkload(condition, run_id, contracts);
  const warmupCount = 5 * W;
  const warmupMs = 10_000;

  const taskFn = async (seq, slot, isWarmup) => {
    const w = workload(seq);
    const meta = { run_id, condition, run_index, worker_slot: slot, seq,
                   target_key: isRead ? readTargetKey : w.key, warmup: isWarmup };
    if (isRead) return evaluateRead(w.cc, w.fn, [readTargetKey], meta);
    return submitSplit(w.cc, w.fn, w.args, meta);
  };

  const timing = await runLoad({ total, W, taskFn, writer, warmupCount, warmupMs });
  writer.flush();
  const wallClockEnd = new Date().toISOString();

  const after = fabInfoConverged();

  // ── Invariant check (1d) ─────────────────────────────────────────────────
  const lines = fs.readFileSync(jsonlPath, 'utf8').trim().split('\n').filter(Boolean);
  const recs = lines.map(l => JSON.parse(l));
  const submitted = recs.length;
  const committed = recs.filter(r => r.status === 'COMMITTED').length;
  const byClass = {};
  for (const c of ALL_ERROR_CLASSES) byClass[c] = 0;
  for (const r of recs) if (r.status !== 'COMMITTED') byClass[r.error_class] = (byClass[r.error_class] || 0) + 1;
  const errSum = Object.values(byClass).reduce((a, b) => a + b, 0);
  const invariantOk = (submitted === committed + errSum);
  if (!invariantOk) {
    console.error(`INVARIANT VIOLATED  submitted=${submitted} committed=${committed} errors=${errSum}`);
  }

  const heightDelta = {};
  for (const org of ['org1', 'org2', 'org3', 'org4']) {
    const b = before.peers && before.peers[org] && before.peers[org].height;
    const a = after.peers  && after.peers[org]  && after.peers[org].height;
    heightDelta[org] = (typeof a === 'number' && typeof b === 'number') ? (a - b) : null;
  }
  const heightsAgreeAfter = new Set(['org1','org2','org3','org4']
    .map(o => after.peers && after.peers[o] && after.peers[o].height)).size === 1;
  const hashesAgreeAfter = new Set(['org1','org2','org3','org4']
    .map(o => after.peers && after.peers[o] && after.peers[o].currentBlockHash)).size === 1;

  const manifest = {
    run_id, condition, run_index, harness_version: HARNESS_VERSION,
    schema_version: 1,
    git_commit_source: extraManifest.git_commit_source,
    source_chaincode_tree_dirty: extraManifest.source_chaincode_tree_dirty,
    git_commit_harness_host: extraManifest.git_commit_harness_host,
    chaincode_sha256_expected: CC_SHA256_EXPECTED,
    chaincode_package_ids: extraManifest.chaincode_package_ids,
    channel_params: extraManifest.channel_params,
    condition_params: { W, total, warmup_count: warmupCount, warmup_ms: warmupMs,
                        read_target_key: isRead ? readTargetKey : null },
    wall_clock_start: wallClockStart, wall_clock_end: wallClockEnd,
    cooldown_observed_ms: cooldownObservedMs,
    timing,
    ledger_before: before, ledger_after: after,
    ledger_convergence: after.convergence || null,
    height_delta: heightDelta,
    peers_agree_after: { height: heightsAgreeAfter, hash: hashesAgreeAfter },
    counts: { submitted, committed, errors_by_class: byClass, error_total: errSum,
              invariant_holds: invariantOk },
    container_inventory: extraManifest.container_inventory,
    chaincode_sha256_observed: extraManifest.chaincode_sha256,
    env_snapshot_captured_at: extraManifest.env_snapshot_captured_at,
    qdisc_state: extraManifest.qdisc_state,
    netem_in_effect: extraManifest.netem_in_effect || null,
    endorsement_policy_in_effect: extraManifest.endorsement_policy_in_effect || 'MAJORITY',
    node_versions: { node: process.version, harness_host: os.hostname() },
  };
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`  submitted=${submitted} committed=${committed} errors=${errSum} invariant=${invariantOk ? 'OK' : 'VIOLATED'}`);
  console.log(`  height delta: ${JSON.stringify(heightDelta)}  peers agree after: h=${heightsAgreeAfter} hash=${hashesAgreeAfter}`);
  console.log(`  steady window ${timing.steady_duration_ms.toFixed(0)} ms of ${timing.total_duration_ms.toFixed(0)} ms total`);

  return { manifest, runDir, invariantOk };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function parseArgs() {
  const a = {};
  for (let i = 2; i < process.argv.length; i++) {
    const t = process.argv[i];
    if (t.startsWith('--')) {
      const [k, v] = t.slice(2).split('=');
      a[k] = (v === undefined) ? true : v;
    }
  }
  return a;
}

async function main() {
  const args = parseArgs();
  const conditions = (args.conditions || 'A,B,C,D,E,F,G,H').split(',');
  const runs       = parseInt(args.runs || '3', 10);
  const cooldownMs = parseInt(args.cooldown || '60000', 10);
  const outRoot    = args.out || path.resolve(process.env.HOME, 'am-unified', 'results',
                       new Date().toISOString().replace(/[:.]/g, '-'));
  const wOverride  = args.W ? parseInt(args.W, 10) : null;
  const nOverride  = args.n ? parseInt(args.n, 10) : null;
  const label      = args.label || '';

  const DEFAULTS = {
    A: { W: 1,  n: 500 },  B: { W: 1,  n: 500 },  C: { W: 1,  n: 500 },  D: { W: 1,  n: 500 },
    E: { W: 20, n: 2000 }, F: { W: 20, n: 2000 }, G: { W: 20, n: 2000 }, H: { W: 20, n: 500 },
  };

  fs.mkdirSync(outRoot, { recursive: true });
  const sessionId = `S${Date.now().toString(36)}`;

  console.log('═'.repeat(72));
  console.log(` bench.js v${HARNESS_VERSION}  session=${sessionId}`);
  console.log(` out=${outRoot}`);
  console.log(` conditions=${conditions.join(',')} runs=${runs} cooldown=${cooldownMs}ms ${label}`);
  console.log('═'.repeat(72));

  // Static environment capture, done once per invocation.
  // D1's am-unified clone is NOT the source of the deployed chaincode; it is an
  // older clone holding the harness scripts. The commit the binary was built
  // from comes from the laptop via env.json. Record both, labelled distinctly.
  const git_commit_harness_host = sh('bash', ['-lc', 'cd $HOME/am-unified 2>/dev/null && git rev-parse HEAD || echo UNKNOWN']);
  const channel_params = decodedChannelParams();

  // Cross-node environment: supplied by the laptop via collect_env.sh, because
  // D1 has no outbound SSH. Refuse to run without it rather than write manifests
  // with missing provenance.
  if (!args['env-file']) {
    console.error('FATAL: --env-file=<path> is required. Generate it on the laptop with collect_env.sh.');
    process.exit(2);
  }
  const envSnapshot = loadEnvFile(args['env-file']);
  if (envSnapshot.error) { console.error(`FATAL: ${envSnapshot.error}`); process.exit(2); }
  const container_inventory   = envSnapshot.container_inventory || null;
  const qdisc_state           = envSnapshot.qdisc_state || null;
  const chaincode_package_ids = envSnapshot.chaincode_package_ids || null;
  const chaincode_sha256      = envSnapshot.chaincode_sha256 || {};

  // Verify the deployed binary digest matches the audited one (P3). Under CCAAS
  // the lifecycle definition does not hash the binary, so this out-of-band
  // digest is the only integrity binding for the whole session.
  const digestMismatch = [];
  for (const node of Object.keys(NODES)) {
    if (chaincode_sha256[node] !== CC_SHA256_EXPECTED) {
      digestMismatch.push(`${node}=${chaincode_sha256[node] || 'MISSING'}`);
    }
  }
  if (digestMismatch.length) {
    console.error(`FATAL: chaincode sha256 mismatch on ${digestMismatch.join(', ')}`);
    console.error(`expected ${CC_SHA256_EXPECTED}`);
    if (!args['allow-digest-mismatch']) process.exit(2);
  } else {
    console.log(`chaincode sha256 verified on all four nodes: ${CC_SHA256_EXPECTED.slice(0, 16)}...`);
  }

  const git_commit_source = envSnapshot.source_git_commit || 'UNKNOWN';
  const source_chaincode_tree_dirty = envSnapshot.source_chaincode_tree_dirty;
  console.log(`chaincode source commit: ${git_commit_source} (chaincode tree dirty: ${source_chaincode_tree_dirty})`);

  const extraManifest = {
    git_commit_source, source_chaincode_tree_dirty, git_commit_harness_host, channel_params, container_inventory, qdisc_state, chaincode_package_ids,
    chaincode_sha256,
    env_snapshot_captured_at: envSnapshot.captured_at || null,
    netem_in_effect: args.netem || null,
    endorsement_policy_in_effect: args.policy || 'MAJORITY',
  };

  // Connect once. Gateways are reused for every transaction in the session.
  const client = await newGrpcConnection();
  const gwAdmin = await newGatewayForUser(client, ADMIN_USER);
  const gwUser  = await newGatewayForUser(client, TEST_USER);
  const netUser = gwUser.getNetwork(channelName);
  const contracts = {
    prov:  netUser.getContract(chaincodeName, PROV_CC),
    rep:   netUser.getContract(chaincodeName, REP_CC),
    integ: netUser.getContract(chaincodeName, INTEG_CC),
  };
  const adminRep = gwAdmin.getNetwork(channelName).getContract(chaincodeName, REP_CC);

  // Setup: config + stake. Idempotent.
  try { await adminRep.submitTransaction('InitConfig'); console.log('setup: InitConfig done'); }
  catch (e) {
    const d = (e.details && e.details[0] && e.details[0].message) || '';
    if (!/already initialized/.test(e.message + d)) throw e;
    console.log('setup: config already initialized');
  }
  for (const [name, gw] of [[ADMIN_USER, gwAdmin], [TEST_USER, gwUser]]) {
    try {
      await gw.getNetwork(channelName).getContract(chaincodeName, REP_CC)
        .submitTransaction('AddStake', MIN_STAKE);
      console.log(`setup: staked ${name}`);
    } catch (e) { console.log(`setup: stake ${name}: ${e.message.slice(0, 90)}`); }
  }

  // Condition D needs a real asset with history to read. Build one once.
  const readTargetKey = `${sessionId}-READTARGET`;
  try {
    await contracts.integ.submitTransaction('RecordProvenanceWithReputation',
      readTargetKey, 'MATERIAL_CERTIFICATION', `sha256:${crypto.randomBytes(16).toString('hex')}`,
      `${sessionId}-READACTOR`, '0.9', 'quality', `sha256:${crypto.randomBytes(16).toString('hex')}`);
    console.log(`setup: read target asset ${readTargetKey} created`);
  } catch (e) { console.log(`setup: read target: ${e.message.slice(0, 120)}`); }

  const index = [];
  let firstRun = true;
  let cooldownObservedMs = 0;

  for (const condition of conditions) {
    const d = DEFAULTS[condition];
    if (!d) { console.error(`skipping unknown condition ${condition}`); continue; }
    const W = wOverride !== null ? wOverride : d.W;
    const total = nOverride !== null ? nOverride : d.n;

    for (let r = 1; r <= runs; r++) {
      if (!firstRun) {
        // 1j: cooldown enforced in code and recorded in the manifest.
        const t = Date.now();
        console.log(`cooldown ${cooldownMs} ms ...`);
        await new Promise(res => setTimeout(res, cooldownMs));
        cooldownObservedMs = Date.now() - t;
      } else { cooldownObservedMs = 0; firstRun = false; }

      const res = await runCondition({
        condition, run_index: r, W, total, outRoot, sessionId,
        gateways: { gwAdmin, gwUser }, contracts, readTargetKey,
        cooldownObservedMs, extraManifest,
      });
      index.push({ condition, run_index: r, W, total, dir: res.runDir,
                   invariant_holds: res.invariantOk });
      fs.writeFileSync(path.join(outRoot, 'index.json'), JSON.stringify(index, null, 2));
    }
  }

  gwAdmin.close(); gwUser.close(); client.close();
  console.log(`\nDone. Results under ${outRoot}`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
