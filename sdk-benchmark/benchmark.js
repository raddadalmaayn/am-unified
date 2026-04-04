'use strict';

const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const { promises: fs } = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Configuration ────────────────────────────────────────────────────────────

const NETWORK_DIR = path.resolve(__dirname, '../network');
const ORG1_DIR    = path.join(NETWORK_DIR, 'organizations/peerOrganizations/org1.example.com');
const TLS_CERT    = path.join(ORG1_DIR, 'peers/peer0.org1.example.com/tls/ca.crt');
const CERT_DIR    = path.join(ORG1_DIR, 'users/Admin@org1.example.com/msp/signcerts');
const KEY_DIR     = path.join(ORG1_DIR, 'users/Admin@org1.example.com/msp/keystore');

const PEER_ENDPOINT    = process.env.PEER_ENDPOINT    || 'peer0.org1.example.com:7051';
const PEER_HOST_ALIAS  = process.env.PEER_HOST_ALIAS  || 'peer0.org1.example.com';
const MSP_ID           = process.env.MSP_ID           || 'Org1MSP';
const CHANNEL_NAME     = process.env.CHANNEL_NAME     || 'amchannel';
const CHAINCODE_NAME   = process.env.CHAINCODE_NAME   || 'unified';

const RESULTS_DIR = path.resolve(__dirname, '../results/geo-distributed');

// Benchmark parameters
const SEQ_TXN_COUNT    = 100;   // sequential transactions per test
const CONC_TXN_COUNT   = 500;   // total transactions for concurrent tests
const READ_COUNT       = 200;   // read queries
const CONCURRENT_LEVELS = [10, 20, 50];

// Target actor IDs (different from caller to avoid self-rating block)
const TARGET_ACTOR = 'target-supplier-geo-001';
const DIMENSION    = 'quality';

// Dimensions available in the system (must match InitConfig ValidDimensions)
const DIMENSIONS = ['quality', 'delivery', 'compliance', 'warranty'];

// ── Utility ──────────────────────────────────────────────────────────────────

function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sha256hex(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function percentile(sortedArr, p) {
    const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, idx)];
}

function stats(latencies) {
    if (!latencies.length) return { mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
    const sorted = [...latencies].sort((a, b) => a - b);
    const mean   = latencies.reduce((s, v) => s + v, 0) / latencies.length;
    return {
        mean: +mean.toFixed(2),
        p50:  +percentile(sorted, 50).toFixed(2),
        p95:  +percentile(sorted, 95).toFixed(2),
        p99:  +percentile(sorted, 99).toFixed(2),
        min:  +sorted[0].toFixed(2),
        max:  +sorted[sorted.length - 1].toFixed(2),
    };
}

// ── Connection helpers ────────────────────────────────────────────────────────

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(TLS_CERT);
    const tlsCreds = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(PEER_ENDPOINT, tlsCreds, {
        'grpc.ssl_target_name_override': PEER_HOST_ALIAS,
        'grpc.max_receive_message_length': 10 * 1024 * 1024,
        'grpc.max_send_message_length': 10 * 1024 * 1024,
    });
}

async function newIdentity() {
    const files = await fs.readdir(CERT_DIR);
    const certPem = await fs.readFile(path.join(CERT_DIR, files[0]));
    return { mspId: MSP_ID, credentials: certPem };
}

async function newSigner() {
    const files = await fs.readdir(KEY_DIR);
    const keyPem = await fs.readFile(path.join(KEY_DIR, files[0]));
    const privateKey = crypto.createPrivateKey(keyPem);
    return signers.newPrivateKeySigner(privateKey);
}

// ── Setup phase ───────────────────────────────────────────────────────────────

async function setupChaincode(gateway) {
    const network = gateway.getNetwork(CHANNEL_NAME);
    const repContract = network.getContract(CHAINCODE_NAME, 'ReputationContract');

    // InitConfig — ignore "already initialized" error
    try {
        await repContract.submitTransaction('InitConfig');
        console.log('  InitConfig: OK');
    } catch (e) {
        const msg = e.message || '';
        const detailMsg = (e.details && e.details[0] && e.details[0].message) || '';
        if (msg.includes('already initialized') || detailMsg.includes('already initialized')) {
            console.log('  InitConfig: already initialized (OK)');
        } else {
            throw e;
        }
    }

    // AddStake: give the caller plenty of stake (MinStakeRequired = 10000)
    try {
        await repContract.submitTransaction('AddStake', '50000');
        console.log('  AddStake(50000): OK');
    } catch (e) {
        console.log(`  AddStake: ${e.message} (may already have stake)`);
    }

    console.log('  Setup complete.\n');
}

// ── Sequential benchmark helpers ──────────────────────────────────────────────

async function runSequential(label, txnFn, count) {
    const latencies = [];
    let failures = 0;

    for (let i = 0; i < count; i++) {
        const t0 = Date.now();
        try {
            await txnFn(i);
        } catch (e) {
            failures++;
            if (failures <= 3) console.error(`    [${label}] txn ${i} error: ${e.message}`);
        }
        latencies.push(Date.now() - t0);
    }

    const elapsed = latencies.reduce((s, v) => s + v, 0);
    const tps     = (count - failures) / (elapsed / 1000);
    const s       = stats(latencies);

    return { label, mode: 'sequential', count, failures, tps: +tps.toFixed(2), ...s, elapsed };
}

// ── Concurrent benchmark helper ───────────────────────────────────────────────

async function runConcurrent(label, txnFn, totalCount, workers) {
    const latencies  = [];
    let failures = 0;
    const wallStart = Date.now();

    // Split work into worker batches
    const perWorker = Math.ceil(totalCount / workers);

    const workerFn = async (workerId) => {
        const myCount = Math.min(perWorker, totalCount - workerId * perWorker);
        if (myCount <= 0) return;
        const offset = workerId * perWorker;
        for (let i = 0; i < myCount; i++) {
            const t0 = Date.now();
            try {
                await txnFn(offset + i);
            } catch (e) {
                failures++;
                if (failures <= 3) console.error(`    [${label}] worker ${workerId} txn ${i} error: ${e.message}`);
            }
            latencies.push(Date.now() - t0);
        }
    };

    await Promise.all(Array.from({ length: workers }, (_, w) => workerFn(w)));

    const wallElapsed = Date.now() - wallStart;
    const tps = (totalCount - failures) / (wallElapsed / 1000);
    const s   = stats(latencies);

    return {
        label: `${label} [${workers} workers]`,
        mode: 'concurrent',
        workers,
        count: totalCount,
        failures,
        tps: +tps.toFixed(2),
        ...s,
        elapsed: wallElapsed,
    };
}

// ── Read benchmark helper ─────────────────────────────────────────────────────

async function runReadTest(label, readFn, count) {
    const latencies = [];
    let failures = 0;

    for (let i = 0; i < count; i++) {
        const t0 = Date.now();
        try {
            await readFn(i);
        } catch (e) {
            failures++;
            if (failures <= 3) console.error(`    [${label}] query ${i} error: ${e.message}`);
        }
        latencies.push(Date.now() - t0);
    }

    const s   = stats(latencies);
    const tps = (count - failures) / (latencies.reduce((s, v) => s + v, 0) / 1000);

    return { label, mode: 'read', count, failures, tps: +tps.toFixed(2), ...s };
}

// ── Main benchmark ────────────────────────────────────────────────────────────

async function main() {
    console.log('============================================================');
    console.log('  AM-Unified SDK Benchmark — 4-Org Geo-Distributed Testbed');
    console.log(`  ${new Date().toISOString()}`);
    console.log('============================================================\n');

    await fs.mkdir(RESULTS_DIR, { recursive: true });

    // Connect
    console.log('Connecting to peer...');
    const client = await newGrpcConnection();
    const identity = await newIdentity();
    const signer   = await newSigner();

    const gateway = connect({ client, identity, signer });

    try {
        const network = gateway.getNetwork(CHANNEL_NAME);
        const provContract = network.getContract(CHAINCODE_NAME, 'ProvenanceContract');
        const repContract  = network.getContract(CHAINCODE_NAME, 'ReputationContract');
        const intContract  = network.getContract(CHAINCODE_NAME, 'IntegrationContract');

        // ── Setup ────────────────────────────────────────────────────────────
        console.log('=== Setup phase ===');
        await setupChaincode(gateway);

        // Pre-create a read-test asset and write a rating for read queries
        const readAssetID = uid('read-asset');
        await provContract.submitTransaction(
            'CreateMaterialCertification',
            readAssetID, 'titanium', 'batch-read-001', TARGET_ACTOR, sha256hex('read-setup')
        );
        console.log(`  Pre-created read asset: ${readAssetID}`);

        const results = [];

        // ── Test 1: Sequential Provenance Write ───────────────────────────────
        console.log('=== Test 1: Sequential Provenance Write (CreateMaterialCertification) ===');
        const r1 = await runSequential('Provenance Sequential', async (i) => {
            const assetID = uid(`prov-seq-${i}`);
            await provContract.submitTransaction(
                'CreateMaterialCertification',
                assetID, 'titanium', `batch-${i}`, TARGET_ACTOR, sha256hex(`prov-${i}`)
            );
        }, SEQ_TXN_COUNT);
        results.push(r1);
        printResult(r1);

        // ── Test 2: Sequential Reputation Write ───────────────────────────────
        console.log('=== Test 2: Sequential Reputation Write (SubmitRating) ===');
        const r2 = await runSequential('Reputation Sequential', async (i) => {
            const ts = Math.floor(Date.now() / 1000);
            await repContract.submitTransaction(
                'SubmitRating',
                TARGET_ACTOR, DIMENSION, '0.8', sha256hex(`evidence-${i}`), String(ts + i)
            );
        }, SEQ_TXN_COUNT);
        results.push(r2);
        printResult(r2);

        // ── Test 3: Sequential Bridge Write ───────────────────────────────────
        console.log('=== Test 3: Sequential Integrated Write (RecordProvenanceWithReputation) ===');
        const r3 = await runSequential('Bridge Sequential', async (i) => {
            const assetID = uid(`bridge-seq-${i}`);
            await intContract.submitTransaction(
                'RecordProvenanceWithReputation',
                assetID, 'MATERIAL_CERTIFICATION', sha256hex(`bridge-${i}`),
                TARGET_ACTOR, '0.8', DIMENSION, sha256hex(`evidence-bridge-${i}`)
            );
        }, SEQ_TXN_COUNT);
        results.push(r3);
        printResult(r3);

        // ── Test 4: Read Latency ──────────────────────────────────────────────
        console.log('=== Test 4: Read Latency (ReadAsset + GetReputation) ===');
        const r4a = await runReadTest('ReadAsset', async (_i) => {
            await provContract.evaluateTransaction('ReadAsset', readAssetID);
        }, READ_COUNT);
        results.push(r4a);
        printResult(r4a);

        const r4b = await runReadTest('GetReputation', async (_i) => {
            await repContract.evaluateTransaction('GetReputation', TARGET_ACTOR, DIMENSION);
        }, READ_COUNT);
        results.push(r4b);
        printResult(r4b);

        // ── Tests 5-7: Concurrent Provenance Write ────────────────────────────
        for (const workers of CONCURRENT_LEVELS) {
            console.log(`=== Test: Concurrent Provenance Write (${workers} workers, ${CONC_TXN_COUNT} txns) ===`);
            const r = await runConcurrent('Provenance Concurrent', async (i) => {
                const assetID = uid(`prov-conc-w${workers}-${i}`);
                await provContract.submitTransaction(
                    'CreateMaterialCertification',
                    assetID, 'titanium', `batch-c${i}`, TARGET_ACTOR, sha256hex(`conc-prov-${i}`)
                );
            }, CONC_TXN_COUNT, workers);
            results.push(r);
            printResult(r);
        }

        // ── Tests 8-10: Concurrent Reputation Write ────────────────────────────
        // Each transaction uses a unique (actorID, dimension) pair keyed on its
        // global index i, so no two concurrent txns share the REPUTATION:<actor>:<dim>
        // write key. This eliminates artificial MVCC conflicts caused by all workers
        // hammering the same state key.
        for (const workers of CONCURRENT_LEVELS) {
            console.log(`=== Test: Concurrent Reputation Write (${workers} workers, ${CONC_TXN_COUNT} txns) ===`);
            const r = await runConcurrent('Reputation Concurrent', async (i) => {
                const actor = `target-actor-conc-${i}`;
                const dim   = DIMENSIONS[i % DIMENSIONS.length];
                const ts    = Math.floor(Date.now() / 1000);
                await repContract.submitTransaction(
                    'SubmitRating',
                    actor, dim, '0.8', sha256hex(`conc-ev-${i}`), String(ts + i)
                );
            }, CONC_TXN_COUNT, workers);
            results.push(r);
            printResult(r);
        }

        // ── Tests 11-13: Concurrent Bridge Write ──────────────────────────────
        // Same fix: unique ratedActorID per transaction index i, cycling through
        // all 4 dimensions, so REPUTATION:<actor>:<dim> writes never collide.
        for (const workers of CONCURRENT_LEVELS) {
            console.log(`=== Test: Concurrent Bridge Write (${workers} workers, ${CONC_TXN_COUNT} txns) ===`);
            const r = await runConcurrent('Bridge Concurrent', async (i) => {
                const assetID = uid(`bridge-conc-w${workers}-${i}`);
                const actor   = `target-actor-bridge-${i}`;
                const dim     = DIMENSIONS[i % DIMENSIONS.length];
                await intContract.submitTransaction(
                    'RecordProvenanceWithReputation',
                    assetID, 'MATERIAL_CERTIFICATION', sha256hex(`bridge-conc-${i}`),
                    actor, '0.8', dim, sha256hex(`ev-conc-${i}`)
                );
            }, CONC_TXN_COUNT, workers);
            results.push(r);
            printResult(r);
        }

        // ── Save results ──────────────────────────────────────────────────────
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const csvPath  = path.join(RESULTS_DIR, `sdk_benchmark_${ts}.csv`);
        const jsonPath = path.join(RESULTS_DIR, `sdk_benchmark_${ts}.json`);

        await fs.writeFile(csvPath,  toCsv(results));
        await fs.writeFile(jsonPath, JSON.stringify({ timestamp: new Date().toISOString(), config: {
            peer: PEER_ENDPOINT, channel: CHANNEL_NAME, chaincode: CHAINCODE_NAME,
            seqCount: SEQ_TXN_COUNT, concCount: CONC_TXN_COUNT, readCount: READ_COUNT,
        }, results }, null, 2));

        console.log('\n============================================================');
        console.log('  BENCHMARK COMPLETE');
        console.log(`  CSV:  ${csvPath}`);
        console.log(`  JSON: ${jsonPath}`);
        console.log('============================================================\n');
        console.log(toCsv(results));

    } finally {
        gateway.close();
        client.close();
    }
}

function printResult(r) {
    console.log(
        `  TPS: ${r.tps.toFixed(2).padStart(8)} | ` +
        `mean: ${r.mean.toFixed(1).padStart(7)}ms | ` +
        `P50: ${r.p50.toFixed(1).padStart(7)}ms | ` +
        `P95: ${r.p95.toFixed(1).padStart(7)}ms | ` +
        `P99: ${r.p99.toFixed(1).padStart(7)}ms | ` +
        `failures: ${r.failures}/${r.count}\n`
    );
}

function toCsv(results) {
    const header = 'label,mode,workers,count,failures,tps,mean_ms,p50_ms,p95_ms,p99_ms,min_ms,max_ms,elapsed_ms';
    const rows = results.map(r =>
        [r.label, r.mode, r.workers ?? 1, r.count, r.failures,
         r.tps, r.mean, r.p50, r.p95, r.p99, r.min, r.max, r.elapsed ?? ''].join(',')
    );
    return [header, ...rows].join('\n');
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
