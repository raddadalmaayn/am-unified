'use strict';
/**
 * ============================================================================
 * performance_test.js — Unified AM System Performance Benchmark Suite
 * ============================================================================
 *
 * Measures six performance dimensions for the combined provenance + reputation
 * system and compares them against the individual system baselines:
 *
 *  1. Sequential latency – Provenance-only writes
 *  2. Sequential latency – Reputation-only writes (SubmitRating)
 *  3. Sequential latency – Integrated writes (RecordProvenanceWithReputation)
 *  4. Sequential latency – Read operations (GetPartTrustReport)
 *  5. Concurrent throughput – Provenance writes (TPS + MVCC rate)
 *  6. Concurrent throughput – Reputation writes (TPS + MVCC rate)
 *  7. Concurrent throughput – Integrated writes (TPS + MVCC rate)
 *  8. Concurrent throughput under high contention (same asset)
 *  9. Storage cost estimates per operation type
 *
 * Results are written to:
 *   ../results/performance/performance_results_<timestamp>.csv
 *   ../results/performance/performance_results_<timestamp>.json
 * ============================================================================
 */

const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const crypto = require('crypto');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const utf8Decoder = new TextDecoder();

// ── Network configuration ────────────────────────────────────────────────────
const channelName    = 'mychannel';
const chaincodeName  = 'unified';
const mspId          = 'Org1MSP';

const cryptoPath     = path.resolve(__dirname, '..', '..', 'fabric-samples', 'test-network',
                         'organizations', 'peerOrganizations', 'org1.example.com');
const peerEndpoint   = 'localhost:7051';
const peerHostAlias  = 'peer0.org1.example.com';
const tlsCertPath    = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');

// ── Test parameters ───────────────────────────────────────────────────────────
const SEQUENTIAL_RUNS  = 50;   // iterations for stable latency average
const CONCURRENT_RUNS  = 500;  // total transactions for throughput tests
const CONCURRENCY_LEVEL = 100; // parallel requests per batch
const MIN_STAKE        = '10000';

// ── Test identities ───────────────────────────────────────────────────────────
const adminUser        = 'Admin';
const raterUser        = 'buyer1';                                           // submits ratings
const concurrentRaters = Array.from({ length: 30 }, (_, i) => `tps_user_${i + 1}`);
const allTestUsers     = [raterUser, ...concurrentRaters];

// ── Contract names (multi-contract chaincode) ─────────────────────────────────
const PROV_CC   = 'ProvenanceContract';
const REP_CC    = 'ReputationContract';
const INTEG_CC  = 'IntegrationContract';

// ── Results store ─────────────────────────────────────────────────────────────
const results = [];

// ── Unique ID helpers ─────────────────────────────────────────────────────────
let _seqCounter = 0;
function uid(prefix = 'ID') {
    return `${prefix}-${Date.now()}-${++_seqCounter}`;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   Unified AM System — Comprehensive Performance Benchmark ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const client = await newGrpcConnection();
    const adminGateway = await newGatewayForUser(client, adminUser);
    const adminNetwork = adminGateway.getNetwork(channelName);
    const repContract   = adminNetwork.getContract(chaincodeName, REP_CC);
    const integContract = adminNetwork.getContract(chaincodeName, INTEG_CC);

    try {
        // ── Initialise system ─────────────────────────────────────────────────
        console.log('[Setup] Initialising reputation system config...');
        try {
            await repContract.submitTransaction('InitConfig');
            console.log('  ✓ InitConfig done');
        } catch (e) {
            const detail = (e.details && e.details[0] && e.details[0].message) || '';
            if (!e.message.includes('already initialized') && !detail.includes('already initialized')) throw e;
            console.log('  ✓ Config already initialised');
        }

        // ── Stake all test users ──────────────────────────────────────────────
        console.log(`[Setup] Staking ${allTestUsers.length} test users...`);
        for (let i = 0; i < allTestUsers.length; i++) {
            const user = allTestUsers[i];
            process.stdout.write(`  Staking ${i + 1}/${allTestUsers.length} (${user})...`);
            await stakeUser(client, user, MIN_STAKE);
            process.stdout.write(' ✓\n');
        }
        console.log('  ✓ All users staked\n');

        // ====================================================================
        // TEST 1: Sequential Provenance Write Latency
        // ====================================================================
        console.log(`[Test 1] Sequential provenance write latency (${SEQUENTIAL_RUNS} runs)...`);
        const provLatencies = [];
        for (let i = 0; i < SEQUENTIAL_RUNS; i++) {
            const assetID = uid('PART-SEQ-PROV');
            const start = process.hrtime.bigint();
            const gw = await newGatewayForUser(client, raterUser);
            const prov = gw.getNetwork(channelName).getContract(chaincodeName, PROV_CC);
            await prov.submitTransaction(
                'CreateMaterialCertification',
                assetID, 'Ti-6Al-4V', uid('BATCH'), 'SupplierAlpha', `sha256:${crypto.randomBytes(16).toString('hex')}`
            );
            const end = process.hrtime.bigint();
            provLatencies.push(Number(end - start) / 1_000_000);
        }
        recordLatencyResult('Provenance', 'Sequential Write Latency', provLatencies);

        // ====================================================================
        // TEST 2: Sequential Reputation Write Latency (SubmitRating)
        // ====================================================================
        console.log(`[Test 2] Sequential reputation write latency (${SEQUENTIAL_RUNS} runs)...`);
        const repLatencies = [];
        for (let i = 0; i < SEQUENTIAL_RUNS; i++) {
            const victim = uid('ACTOR');
            const start = process.hrtime.bigint();
            const gw = await newGatewayForUser(client, raterUser);
            const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
            await rep.submitTransaction(
                'SubmitRating',
                victim, 'quality', '0.8',
                `sha256:${crypto.randomBytes(16).toString('hex')}`,
                String(Math.floor(Date.now() / 1000))
            );
            const end = process.hrtime.bigint();
            repLatencies.push(Number(end - start) / 1_000_000);
        }
        recordLatencyResult('Reputation', 'Sequential Write Latency', repLatencies);

        // ====================================================================
        // TEST 3: Sequential Integrated Write Latency
        //         (RecordProvenanceWithReputation)
        // ====================================================================
        console.log(`[Test 3] Sequential integrated write latency (${SEQUENTIAL_RUNS} runs)...`);
        const integLatencies = [];
        for (let i = 0; i < SEQUENTIAL_RUNS; i++) {
            const assetID  = uid('PART-INTEG');
            const supplier = uid('SUPPLIER');
            const start = process.hrtime.bigint();
            const gw = await newGatewayForUser(client, raterUser);
            const integ = gw.getNetwork(channelName).getContract(chaincodeName, INTEG_CC);
            await integ.submitTransaction(
                'RecordProvenanceWithReputation',
                assetID, 'MATERIAL_CERTIFICATION',
                `sha256:${crypto.randomBytes(16).toString('hex')}`,
                supplier, '0.9', 'quality',
                `sha256:${crypto.randomBytes(16).toString('hex')}`
            );
            const end = process.hrtime.bigint();
            integLatencies.push(Number(end - start) / 1_000_000);
        }
        recordLatencyResult('Integrated', 'Sequential Write Latency (Atomic Prov+Rep)', integLatencies);

        // ====================================================================
        // TEST 4: Sequential Read Latency (GetPartTrustReport)
        // ====================================================================
        console.log(`[Test 4] Sequential read latency — GetPartTrustReport (${SEQUENTIAL_RUNS} runs)...`);
        // Use the last created integrated asset
        const sampleAssetID = `PART-INTEG-${Date.now() - 10}-${_seqCounter - 2}`;
        // Create a fresh asset to query
        const readTestAsset = uid('PART-READ');
        {
            const gw = await newGatewayForUser(client, raterUser);
            const integ = gw.getNetwork(channelName).getContract(chaincodeName, INTEG_CC);
            await integ.submitTransaction(
                'RecordProvenanceWithReputation',
                readTestAsset, 'MATERIAL_CERTIFICATION',
                `sha256:${crypto.randomBytes(16).toString('hex')}`,
                uid('SUP'), '0.85', 'quality',
                `sha256:${crypto.randomBytes(16).toString('hex')}`
            );
        }

        const readLatencies = [];
        for (let i = 0; i < SEQUENTIAL_RUNS; i++) {
            const start = process.hrtime.bigint();
            const gw = await newGatewayForUser(client, raterUser);
            const integ = gw.getNetwork(channelName).getContract(chaincodeName, INTEG_CC);
            await integ.evaluateTransaction('GetPartTrustReport', readTestAsset);
            const end = process.hrtime.bigint();
            readLatencies.push(Number(end - start) / 1_000_000);
        }
        recordLatencyResult('Integrated', 'Sequential Read Latency (GetPartTrustReport)', readLatencies);

        // ====================================================================
        // TEST 5: Concurrent Provenance Throughput
        // ====================================================================
        console.log(`[Test 5] Concurrent provenance throughput (${CONCURRENT_RUNS} txs, concurrency=${CONCURRENCY_LEVEL})...`);
        const provTPS = await runConcurrentThroughput(client, CONCURRENT_RUNS, CONCURRENCY_LEVEL,
            (user, i) => submitProvenance(client, user, uid(`PART-CONC-PROV-${i}`)));
        results.push({ category: 'Provenance', metric: 'Concurrent Write TPS', result: `${provTPS.tps.toFixed(2)} TPS` });
        results.push({ category: 'Provenance', metric: 'MVCC Conflict Rate', result: `${provTPS.mvccRate}%` });
        console.log(`  → ${provTPS.tps.toFixed(2)} TPS, MVCC: ${provTPS.mvccRate}%`);

        // ====================================================================
        // TEST 6: Concurrent Reputation Throughput (low-conflict)
        // ====================================================================
        console.log(`[Test 6] Concurrent reputation throughput (${CONCURRENT_RUNS} txs, concurrency=${CONCURRENCY_LEVEL})...`);
        const repTPS = await runConcurrentThroughput(client, CONCURRENT_RUNS, CONCURRENCY_LEVEL,
            (user, i) => submitRating(client, user, uid(`ACTOR-REP-${i}`), 0.8));
        results.push({ category: 'Reputation', metric: 'Concurrent Write TPS', result: `${repTPS.tps.toFixed(2)} TPS` });
        results.push({ category: 'Reputation', metric: 'MVCC Conflict Rate', result: `${repTPS.mvccRate}%` });
        console.log(`  → ${repTPS.tps.toFixed(2)} TPS, MVCC: ${repTPS.mvccRate}%`);

        // ====================================================================
        // TEST 7: Concurrent Integrated Throughput (low-conflict)
        // ====================================================================
        console.log(`[Test 7] Concurrent integrated throughput (${CONCURRENT_RUNS} txs, concurrency=${CONCURRENCY_LEVEL})...`);
        const integTPS = await runConcurrentThroughput(client, CONCURRENT_RUNS, CONCURRENCY_LEVEL,
            (user, i) => submitIntegrated(client, user, uid(`PART-INTEG-CONC-${i}`), uid(`SUP-${i}`)));
        results.push({ category: 'Integrated', metric: 'Concurrent Write TPS', result: `${integTPS.tps.toFixed(2)} TPS` });
        results.push({ category: 'Integrated', metric: 'MVCC Conflict Rate (low-conflict)', result: `${integTPS.mvccRate}%` });
        console.log(`  → ${integTPS.tps.toFixed(2)} TPS, MVCC: ${integTPS.mvccRate}%`);

        // ====================================================================
        // TEST 8: High-Contention Throughput (same asset attacked by many raters)
        // ====================================================================
        console.log(`[Test 8] High-contention reputation throughput (same actor, ${CONCURRENT_RUNS} txs)...`);
        const highConflictVictim = uid('ACTOR-HI-CONTENTION');
        const hiTPS = await runConcurrentThroughput(client, CONCURRENT_RUNS, CONCURRENCY_LEVEL,
            (user) => submitRating(client, user, highConflictVictim, 0.7));
        results.push({ category: 'Reputation', metric: 'High-Contention TPS', result: `${hiTPS.tps.toFixed(2)} TPS` });
        results.push({ category: 'Reputation', metric: 'MVCC Conflict Rate (high-contention)', result: `${hiTPS.mvccRate}%` });
        console.log(`  → ${hiTPS.tps.toFixed(2)} TPS, MVCC: ${hiTPS.mvccRate}%`);

        // ====================================================================
        // TEST 9: Storage Cost Estimation
        // ====================================================================
        console.log('[Test 9] Estimating storage costs per operation type...');
        const costs = estimateStorageCosts();
        results.push({ category: 'Storage', metric: 'Asset Record (bytes)', result: `${costs.asset}` });
        results.push({ category: 'Storage', metric: 'ProvenanceEvent Record (bytes)', result: `${costs.provenanceEvent}` });
        results.push({ category: 'Storage', metric: 'Stake Record (bytes)', result: `${costs.stake}` });
        results.push({ category: 'Storage', metric: 'Rating Record (bytes)', result: `${costs.rating}` });
        results.push({ category: 'Storage', metric: 'Reputation Record (bytes)', result: `${costs.reputation}` });
        results.push({ category: 'Storage', metric: 'IntegratedEvent Record (bytes)', result: `${costs.integratedEvent}` });
        results.push({ category: 'Storage', metric: 'ProvenanceRepLink Record (bytes)', result: `${costs.provRepLink}` });

        // ── Print and save results ────────────────────────────────────────────
        printResults();
        await saveResults();

    } finally {
        adminGateway.close();
        client.close();
    }
}

// ============================================================================
// SUBMIT HELPERS
// ============================================================================

async function submitProvenance(client, username, assetID) {
    const gw = await newGatewayForUser(client, username);
    try {
        const prov = gw.getNetwork(channelName).getContract(chaincodeName, PROV_CC);
        await prov.submitTransaction(
            'CreateMaterialCertification',
            assetID, 'Ti-6Al-4V', uid('BATCH'), 'SupplierAlpha',
            `sha256:${crypto.randomBytes(16).toString('hex')}`
        );
    } finally {
        // gateway.close() intentionally omitted – reuse connection pool
    }
}

async function submitRating(client, username, victimID, ratingValue) {
    const gw = await newGatewayForUser(client, username);
    try {
        const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
        await rep.submitTransaction(
            'SubmitRating',
            victimID, 'quality', String(ratingValue),
            `sha256:${crypto.randomBytes(16).toString('hex')}`,
            String(Math.floor(Date.now() / 1000))
        );
    } finally { /* intentional */ }
}

async function submitIntegrated(client, username, assetID, supplierID) {
    const gw = await newGatewayForUser(client, username);
    try {
        const integ = gw.getNetwork(channelName).getContract(chaincodeName, INTEG_CC);
        await integ.submitTransaction(
            'RecordProvenanceWithReputation',
            assetID, 'MATERIAL_CERTIFICATION',
            `sha256:${crypto.randomBytes(16).toString('hex')}`,
            supplierID, '0.9', 'quality',
            `sha256:${crypto.randomBytes(16).toString('hex')}`
        );
    } finally { /* intentional */ }
}

async function stakeUser(client, username, amount) {
    try {
        const gw = await newGatewayForUser(client, username);
        const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
        await rep.submitTransaction('AddStake', amount);
        await sleep(300);
    } catch (e) {
        if (!e.message.includes('already') && !e.message.includes('failed to endorse')) {
            // Ignore stake-already-set errors; surface real errors
            console.warn(`  ⚠ Stake warning for ${username}: ${e.message.slice(0, 80)}`);
        }
    }
}

// ============================================================================
// THROUGHPUT ENGINE
// ============================================================================

async function runConcurrentThroughput(client, totalRuns, concurrency, taskFn) {
    let successCount = 0;
    let mvccCount    = 0;
    const promises   = [];
    const users      = concurrentRaters;

    const start = process.hrtime.bigint();

    for (let i = 0; i < totalRuns; i++) {
        const user = users[i % users.length];
        promises.push(taskFn(user, i));

        if (promises.length >= concurrency || i === totalRuns - 1) {
            const { successes, mvccErrors } = await settleAll(promises);
            successCount += successes;
            mvccCount    += mvccErrors;
            promises.length = 0;
        }
    }

    const end      = process.hrtime.bigint();
    const totalSec = Number(end - start) / 1_000_000_000;
    const tps      = totalSec > 0 ? successCount / totalSec : 0;
    const mvccRate = ((mvccCount / totalRuns) * 100).toFixed(1);

    return { tps, mvccRate };
}

async function settleAll(promises) {
    const settled = await Promise.allSettled(promises);
    let successes = 0;
    let mvccErrors = 0;

    for (const result of settled) {
        if (result.status === 'fulfilled') {
            successes++;
        } else {
            const msg = result.reason?.message || '';
            if (msg.includes('MVCC_READ_CONFLICT') || result.reason?.code === 11) {
                mvccErrors++;
            } else if (!msg.includes('failed to endorse')) {
                console.error('\n  Unexpected error:', msg.slice(0, 120));
            }
        }
    }
    return { successes, mvccErrors };
}

// ============================================================================
// RESULTS HELPERS
// ============================================================================

function recordLatencyResult(category, metric, latenciesMs) {
    const sorted = [...latenciesMs].sort((a, b) => a - b);
    const mean   = latenciesMs.reduce((s, v) => s + v, 0) / latenciesMs.length;
    const p50    = sorted[Math.floor(sorted.length * 0.5)];
    const p95    = sorted[Math.floor(sorted.length * 0.95)];
    const p99    = sorted[Math.floor(sorted.length * 0.99)];
    const stddev = Math.sqrt(latenciesMs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / latenciesMs.length);

    results.push({ category, metric: `${metric} — Mean (ms)`,   result: mean.toFixed(2) });
    results.push({ category, metric: `${metric} — P50 (ms)`,    result: p50.toFixed(2) });
    results.push({ category, metric: `${metric} — P95 (ms)`,    result: p95.toFixed(2) });
    results.push({ category, metric: `${metric} — P99 (ms)`,    result: p99.toFixed(2) });
    results.push({ category, metric: `${metric} — StdDev (ms)`, result: stddev.toFixed(2) });

    console.log(`  Mean=${mean.toFixed(1)}ms  P50=${p50.toFixed(1)}ms  P95=${p95.toFixed(1)}ms  P99=${p99.toFixed(1)}ms  σ=${stddev.toFixed(1)}ms`);
}

function estimateStorageCosts() {
    const asset = {
        assetID: 'PART-SMOKE-001', owner: 'Org1MSP',
        currentLifecycleStage: 'MATERIAL_CERTIFIED',
        historyTxIDs: ['abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab']
    };

    const provenanceEvent = {
        eventType: 'MATERIAL_CERTIFICATION', agentID: 'Org1MSP',
        timestamp: '2025-01-01T00:00:00Z',
        offChainDataHash: 'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        materialType: 'Ti-6Al-4V', materialBatchID: 'MAT-BATCH-001',
        supplierID: 'SupplierAlpha', linkedRatingID: 'RATING:abcdef1234567890abcdef1234567890'
    };

    const stake = { actorId: 'buyer1', balance: 10000, locked: 0, updatedAt: 1762325500 };

    const rating = {
        ratingId: 'RATING:abcdef1234567890abcdef1234567890',
        raterId: 'buyer1', actorId: 'SupplierAlpha',
        dimension: 'quality', value: 0.9, weight: 1.2,
        evidence: 'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        timestamp: 1762325500, txId: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        linkedAssetId: 'PART-SMOKE-001', linkedEventTx: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
    };

    const reputation = {
        actorId: 'SupplierAlpha', dimension: 'quality',
        alpha: 10.0, beta: 2.0, totalEvents: 8, lastTs: 1762325500
    };

    const integratedEvent = { ...provenanceEvent, printJobID: '', machineID: '', materialUsedID: '',
        primaryInspectionResult: '', testStandardApplied: '', finalTestResult: '', certificateID: '' };

    const provRepLink = {
        assetId: 'PART-SMOKE-001',
        eventTxId: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        ratingId: 'RATING:abcdef1234567890abcdef1234567890',
        eventType: 'MATERIAL_CERTIFICATION', ratedActor: 'SupplierAlpha', createdAt: 1762325500
    };

    return {
        asset:          Buffer.byteLength(JSON.stringify(asset)),
        provenanceEvent: Buffer.byteLength(JSON.stringify(provenanceEvent)),
        stake:          Buffer.byteLength(JSON.stringify(stake)),
        rating:         Buffer.byteLength(JSON.stringify(rating)),
        reputation:     Buffer.byteLength(JSON.stringify(reputation)),
        integratedEvent: Buffer.byteLength(JSON.stringify(integratedEvent)),
        provRepLink:    Buffer.byteLength(JSON.stringify(provRepLink)),
    };
}

function printResults() {
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              UNIFIED AM SYSTEM — PERFORMANCE RESULTS                ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.table(results.map(r => ({ Category: r.category, Metric: r.metric, Result: r.result })));
}

async function saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir    = path.resolve(__dirname, '..', 'results', 'performance');
    await fs.mkdir(outDir, { recursive: true });

    // JSON
    const jsonPath = path.join(outDir, `performance_results_${timestamp}.json`);
    await fs.writeFile(jsonPath, JSON.stringify({ timestamp, results }, null, 2));

    // CSV
    const csvPath = path.join(outDir, `performance_results_${timestamp}.csv`);
    const csvRows = ['Category,Metric,Result', ...results.map(r => `"${r.category}","${r.metric}","${r.result}"`)];
    await fs.writeFile(csvPath, csvRows.join('\n'));

    console.log(`\n✅ Results saved to:\n   ${jsonPath}\n   ${csvPath}`);
}

// ============================================================================
// CONNECTION HELPERS
// ============================================================================

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function newGrpcConnection() {
    const tlsRootCert    = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newGatewayForUser(client, username) {
    const identity = await newIdentity(username);
    const signer   = await newSigner(username);
    return connect({
        client, identity, signer,
        evaluateOptions:     () => ({ deadline: Date.now() + 5_000 }),
        endorseOptions:      () => ({ deadline: Date.now() + 15_000 }),
        submitOptions:       () => ({ deadline: Date.now() + 20_000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
    });
}

async function newIdentity(username) {
    const certPath = path.resolve(cryptoPath, 'users', `${username}@org1.example.com`, 'msp', 'signcerts', 'cert.pem');
    const cert     = await fs.readFile(certPath);
    return { mspId, credentials: cert };
}

async function newSigner(username) {
    const keyDir = path.resolve(cryptoPath, 'users', `${username}@org1.example.com`, 'msp', 'keystore');
    const files  = await fs.readdir(keyDir);
    const pem    = await fs.readFile(path.resolve(keyDir, files[0]));
    return signers.newPrivateKeySigner(crypto.createPrivateKey(pem));
}

// ── Entry point ───────────────────────────────────────────────────────────────
main().catch(err => {
    console.error('\n******** PERFORMANCE TEST FAILED ********');
    console.error(err);
    process.exitCode = 1;
});
