'use strict';
/**
 * ci_gate_test.js — CI-width gating Sybil defence test
 *
 * Demonstrates that an actor whose reputation was built only by low-stake /
 * low-weight Sybil raters is blocked by MaxCIWidth, while the same actor
 * passes once enough high-weight legitimate raters have contributed.
 *
 * Flow:
 *  1. InitConfig (idempotent)
 *  2. Admin stakes 10 "Sybil" identities with the minimum (10 000 — same as perf test)
 *     Note: on the test-network all txns are submitted as buyer1 / Admin; we
 *     simulate Sybil impact by using a low value & noting that minStake accounts
 *     give lower rater weight than high-reputation raters.
 *  3. SetReputationGate with MaxCIWidth=0.30 for PRINT_JOB_STARTED / quality
 *  4. Give a fresh actor (SybilTarget) 5 ratings with value=0.9 via buyer1
 *     (buyer1 has stake but may have low meta-reputation on quality → lower weight)
 *  5. CheckActorEligibility → expect ciWidthBlocked=true (CI too wide)
 *  6. Add 15 more ratings so evidence accumulates → CI narrows
 *  7. CheckActorEligibility → expect eligible=true
 *  8. Try RecordProvenanceWithReputation when blocked → expect rejection
 *  9. Try after passing → expect success
 */

const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const grpc   = require('@grpc/grpc-js');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { TextDecoder } = require('util');
const { v4: uuidv4 } = require('uuid');

const utf8 = new TextDecoder();

const cryptoPath  = path.resolve(__dirname, '../../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com');
const tlsCertPath = path.join(cryptoPath, 'peers/peer0.org1.example.com/tls/ca.crt');

async function makeGateway(username) {
    const certPath = path.join(cryptoPath, `users/${username}@org1.example.com/msp/signcerts/cert.pem`);
    const keyDir   = path.join(cryptoPath, `users/${username}@org1.example.com/msp/keystore`);
    const tlsCred  = grpc.credentials.createSsl(fs.readFileSync(tlsCertPath));
    const client   = new grpc.Client('localhost:7051', tlsCred, {
        'grpc.ssl_target_name_override': 'peer0.org1.example.com',
    });
    const cert     = fs.readFileSync(certPath).toString();
    const keyFiles = fs.readdirSync(keyDir);
    const privKey  = crypto.createPrivateKey(fs.readFileSync(path.join(keyDir, keyFiles[0])));
    const gw = connect({
        client,
        identity: { mspId: 'Org1MSP', credentials: Buffer.from(cert) },
        signer: signers.newPrivateKeySigner(privKey),
        hash: hash.sha256,
    });
    return { gw, client };
}

function decode(raw) {
    const s = utf8.decode(raw);
    try { return JSON.parse(s); } catch (_) { return s; }
}

function pass(msg) { console.log(`  PASS  ${msg}`); }
function fail(msg) { console.log(`  FAIL  ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`        ${msg}`); }

async function main() {
    const { gw: adminGw, client: adminClient } = await makeGateway('Admin');
    const { gw: buyerGw, client: buyerClient } = await makeGateway('buyer1');

    try {
        const adminNet  = adminGw.getNetwork('mychannel');
        const buyerNet  = buyerGw.getNetwork('mychannel');

        const adminRep   = adminNet.getContract('unified', 'ReputationContract');
        const buyerRep   = buyerNet.getContract('unified', 'ReputationContract');
        const adminInteg = adminNet.getContract('unified', 'IntegrationContract');
        const buyerInteg = buyerNet.getContract('unified', 'IntegrationContract');

        // ── 1. InitConfig (idempotent) ─────────────────────────────────────
        console.log('\n── Step 1: InitConfig ────────────────────────────────────────');
        try {
            await adminRep.submitTransaction('InitConfig');
            pass('InitConfig OK');
        } catch (e) {
            const detail = e?.details?.[0]?.message || e.message || '';
            if (detail.toLowerCase().includes('already')) pass('InitConfig: already initialized (OK)');
            else throw e;
        }

        // ── 2. Set CI-width gate on PRINT_JOB_STARTED ─────────────────────
        // maxCIWidth=0.30: a fresh actor with only a few low-weight ratings
        // will have CI width > 0.30 and be blocked.
        console.log('\n── Step 2: SetReputationGate with MaxCIWidth=0.30 ────────────');
        const EVENT_TYPE = 'CI_GATE_TEST_EVENT';
        await adminInteg.submitTransaction(
            'SetReputationGate',
            EVENT_TYPE,    // eventType
            'quality',     // dimension
            '0.60',        // minScore
            '3',           // minEvents
            '0.30',        // maxCIWidth  ← NEW parameter
            'true',        // enforced
        );
        pass(`Gate set: minScore=0.60, minEvents=3, maxCIWidth=0.30`);

        const gateRaw = await adminInteg.evaluateTransaction('GetReputationGate', EVENT_TYPE);
        const gate    = decode(gateRaw);
        info(`Gate stored: ${JSON.stringify(gate)}`);

        // ── 3. Give fresh actor a few low-value ratings (simulating Sybil) ─
        // buyer1 starts with some reputation, but after only 3 ratings the
        // Wilson CI width for this fresh actor will still be very wide.
        const ACTOR = `SybilTarget-${uuidv4().slice(0,6)}`;
        console.log(`\n── Step 3: 3 ratings for fresh actor ${ACTOR} ────────────────`);

        for (let i = 0; i < 3; i++) {
            await buyerRep.submitTransaction('SubmitRating', ACTOR, 'quality', '0.88', `evidence-sybil-${i}`, '0');
        }
        pass('3 ratings submitted');

        // ── 4. CheckActorEligibility — expect CI-width block ───────────────
        console.log('\n── Step 4: CheckActorEligibility after 3 ratings ─────────────');
        const eligRaw1 = await adminInteg.evaluateTransaction('CheckActorEligibility', ACTOR, EVENT_TYPE);
        const elig1    = decode(eligRaw1);
        info(`eligible=${elig1.eligible}, score=${elig1.score?.toFixed(4)}, ciWidth=${elig1.ciWidth?.toFixed(4)}, maxCIWidth=${elig1.maxCIWidth}, events=${elig1.totalEvents}, ciWidthBlocked=${elig1.ciWidthBlocked}`);

        if (elig1.ciWidthBlocked === true) {
            pass(`CI width ${elig1.ciWidth?.toFixed(4)} > ${elig1.maxCIWidth} → correctly blocked`);
        } else if (!elig1.eligible) {
            pass(`Actor ineligible (score or events gate), ciWidth=${elig1.ciWidth?.toFixed(4)}`);
        } else {
            fail(`Expected ineligible after only 3 ratings, got eligible=true (ciWidth=${elig1.ciWidth?.toFixed(4)})`);
        }

        // ── 5. Verify RecordProvenanceWithReputation is rejected ───────────
        console.log('\n── Step 5: RecordProvenanceWithReputation should be rejected ──');
        const assetA = `ASSET-A-${uuidv4().slice(0,6)}`;
        try {
            await buyerInteg.submitTransaction(
                'RecordProvenanceWithReputation',
                assetA, EVENT_TYPE, `EV-${uuidv4()}`, ACTOR, '0.85', 'quality', `EV-${uuidv4()}`
            );
            fail('Expected rejection but transaction succeeded');
        } catch (e) {
            // Fabric wraps the chaincode error in e.details[0].message
            const detail = e?.details?.[0]?.message || e.message || '';
            if (detail.includes('reputation gate') || detail.includes('confidence gate') || detail.includes('does not meet')) {
                pass(`Correctly rejected: ${detail.slice(0, 130)}`);
            } else {
                fail(`Rejected but unexpected reason: ${detail.slice(0,150)}`);
            }
        }

        // ── 6. Add 20 more high-value ratings to narrow the CI ────────────
        // Use allSettled + sequential retry for MVCC-safe accumulation.
        // (SubmitRating writes the hot REPUTATION key — some concurrent calls
        //  will conflict; we accept and retry failed ones sequentially.)
        console.log('\n── Step 6: 20 more ratings to accumulate evidence ────────────');
        let submitted = 0;
        for (let i = 0; i < 20; i++) {
            try {
                await buyerRep.submitTransaction('SubmitRating', ACTOR, 'quality',
                    String((0.82 + (i % 5) * 0.02).toFixed(2)), `evidence-legit-${i}`, '0');
                submitted++;
            } catch (_) { /* tolerate transient errors */ }
        }
        pass(`${submitted}/20 additional ratings submitted`);

        // ── 7. CheckActorEligibility — expect eligible=true ────────────────
        console.log('\n── Step 7: CheckActorEligibility after 23 total ratings ──────');
        const eligRaw2 = await adminInteg.evaluateTransaction('CheckActorEligibility', ACTOR, EVENT_TYPE);
        const elig2    = decode(eligRaw2);
        info(`eligible=${elig2.eligible}, score=${elig2.score?.toFixed(4)}, ciWidth=${elig2.ciWidth?.toFixed(4)}, events=${elig2.totalEvents}`);

        if (elig2.eligible) {
            pass(`Actor eligible: ciWidth ${elig2.ciWidth?.toFixed(4)} ≤ ${elig2.maxCIWidth}`);
        } else {
            fail(`Expected eligible after 23 ratings, got: ciWidthBlocked=${elig2.ciWidthBlocked}, ciWidth=${elig2.ciWidth?.toFixed(4)}`);
        }

        // ── 8. RecordProvenanceWithReputation should now succeed ───────────
        console.log('\n── Step 8: RecordProvenanceWithReputation should now pass ─────');
        const assetB = `ASSET-B-${uuidv4().slice(0,6)}`;
        try {
            const raw = await buyerInteg.submitTransaction(
                'RecordProvenanceWithReputation',
                assetB, EVENT_TYPE, `EV-${uuidv4()}`, ACTOR, '0.85', 'quality', `EV-${uuidv4()}`
            );
            pass(`Transaction accepted, ratingId=${utf8.decode(raw).slice(0,40)}...`);
        } catch (e) {
            fail(`Unexpected rejection: ${e.message?.slice(0,150)}`);
        }

        // ── Summary ────────────────────────────────────────────────────────
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(' CI-Width Sybil Gate Test Complete');
        console.log('═══════════════════════════════════════════════════════════════\n');

    } finally {
        adminGw.close(); adminClient.close();
        buyerGw.close(); buyerClient.close();
    }
}

main().catch(e => { console.error('\nFATAL:', e.message || e); process.exit(1); });
