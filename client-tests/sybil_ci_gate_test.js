'use strict';
/**
 * sybil_ci_gate_test.js
 *
 * Focused test: do 5 staked Sybil raters generate enough confidence
 * to pass a CI-width gate?
 *
 * Protocol:
 *   1. Install CI gate on SYBIL_TEST_EVENT (quality, maxCIWidth=0.50, minEvents=3, minScore=0.40)
 *   2. 5 Sybils each submit rating=1.0 for SYBIL_TARGET
 *   3. Read reputation → record score + CI width
 *   4. Call CheckActorEligibility → is the actor eligible?
 *   5. Try RecordProvenanceWithReputation for SYBIL_TARGET on SYBIL_TEST_EVENT → blocked or allowed?
 *   6. Repeat with 20 Sybil ratings to find the break-even point
 */

const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc   = require('@grpc/grpc-js');
const crypto = require('crypto');
const fs     = require('fs').promises;
const path   = require('path');
const { TextDecoder } = require('util');

const utf8 = new TextDecoder();

const channelName   = 'mychannel';
const chaincodeName = 'unified';
const mspId         = 'Org1MSP';

const cryptoPath    = path.resolve(__dirname, '..', '..', 'fabric-samples', 'test-network',
                        'organizations', 'peerOrganizations', 'org1.example.com');
const peerEndpoint  = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';
const tlsCertPath   = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');

const REP_CC   = 'ReputationContract';
const INTEG_CC = 'IntegrationContract';

const SYBIL_EVENT = 'SYBIL_TEST_EVENT';
const CI_MAX_WIDTH = 0.50;

// Use the same 5 sybils as the security test
const sybilUsers = Array.from({ length: 5 }, (_, i) => `tps_user_${i + 2}`);
// Extra pool for the break-even test (up to 20 total)
const extraSybils = Array.from({ length: 15 }, (_, i) => `tps_user_${i + 7}`);
const adminUser   = 'Admin';
const raterUser   = 'buyer1';

let _cnt = 0;
function uid(p = 'ID') { return `${p}-${Date.now()}-${++_cnt}`; }
function dec(b) { try { return JSON.parse(utf8.decode(b)); } catch { return utf8.decode(b); } }

async function newGrpcClient() {
    const tls = await fs.readFile(tlsCertPath);
    return new grpc.Client(peerEndpoint, grpc.credentials.createSsl(tls), {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity(username) {
    const cert = await fs.readFile(
        path.resolve(cryptoPath, 'users', `${username}@org1.example.com`, 'msp', 'signcerts', 'cert.pem')
    );
    return { mspId, credentials: cert };
}

async function newSigner(username) {
    const dir   = path.resolve(cryptoPath, 'users', `${username}@org1.example.com`, 'msp', 'keystore');
    const files = await fs.readdir(dir);
    const pem   = await fs.readFile(path.resolve(dir, files[0]));
    return signers.newPrivateKeySigner(crypto.createPrivateKey(pem));
}

async function gwFor(client, username) {
    return connect({
        client,
        identity: await newIdentity(username),
        signer:   await newSigner(username),
        evaluateOptions:     () => ({ deadline: Date.now() + 5_000 }),
        endorseOptions:      () => ({ deadline: Date.now() + 15_000 }),
        submitOptions:       () => ({ deadline: Date.now() + 20_000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
    });
}

function cc(gw, contract) {
    return gw.getNetwork(channelName).getContract(chaincodeName, contract);
}

async function getRep(client, actor, dim) {
    const gw   = await gwFor(client, adminUser);
    const rep  = cc(gw, REP_CC);
    const raw  = await rep.evaluateTransaction('GetReputation', actor, dim);
    gw.close();
    return dec(raw);
}

async function checkElig(client, actor, event) {
    const gw    = await gwFor(client, adminUser);
    const integ = cc(gw, INTEG_CC);
    const raw   = await integ.evaluateTransaction('CheckActorEligibility', actor, event);
    gw.close();
    return dec(raw);
}

function bar(val, max = 1.0, width = 30) {
    const filled = Math.round((val / max) * width);
    return '[' + '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, width - filled)) + ']';
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║        Sybil Attack vs CI-Width Gate — Targeted Test         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const client = await newGrpcClient();

    try {
        // ── 1. Install CI gate ────────────────────────────────────────────────
        console.log(`Installing CI gate on ${SYBIL_EVENT}:`);
        console.log(`  minScore=0.40  minEvents=3  maxCIWidth=${CI_MAX_WIDTH}  enabled=true\n`);

        const adminGw    = await gwFor(client, adminUser);
        const adminInteg = cc(adminGw, INTEG_CC);
        await adminInteg.submitTransaction(
            'SetReputationGate',
            SYBIL_EVENT, 'quality',
            '0.40',                    // minScore (low — not the limiting factor)
            '3',                       // minEvents
            String(CI_MAX_WIDTH),      // maxCIWidth = 0.50 (the key threshold)
            'true'
        );
        console.log('  ✓ Gate installed\n');

        // ── 2. Phase 1: 5 Sybils inflate target ──────────────────────────────
        const target5 = uid('SYBIL-5');
        console.log(`Phase 1 — 5 staked Sybils rate ${target5} with score=1.0`);

        let succeeded = 0;
        for (const sybil of sybilUsers) {
            try {
                const gw  = await gwFor(client, sybil);
                const rep = cc(gw, REP_CC);
                await rep.submitTransaction(
                    'SubmitRating', target5, 'quality', '1.0',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`,
                    String(Math.floor(Date.now() / 1000))
                );
                gw.close();
                succeeded++;
                process.stdout.write(`  ✓ ${sybil}\n`);
            } catch (e) {
                process.stdout.write(`  ✗ ${sybil}: ${e.message?.slice(0, 60)}\n`);
            }
        }

        const rep5  = await getRep(client, target5, 'quality');
        const ciw5  = (rep5.confidenceHigh - rep5.confidenceLow);
        const elig5 = await checkElig(client, target5, SYBIL_EVENT);

        console.log(`\n  Ratings succeeded: ${succeeded}/${sybilUsers.length}`);
        console.log(`  Score:    ${bar(rep5.score)} ${(rep5.score * 100).toFixed(1)}%`);
        console.log(`  CI width: ${bar(ciw5, 1.0)}  ${ciw5.toFixed(4)}  (gate threshold: ${CI_MAX_WIDTH})`);
        console.log(`  Eligible: ${elig5.eligible ? '✓ YES' : '✗ NO'}`);
        if (!elig5.eligible && elig5.ciWidthBlocked) {
            console.log(`  Blocked by: CI width ${ciw5.toFixed(4)} > maxCIWidth ${CI_MAX_WIDTH}`);
        }

        // ── 3. Try to use target5 in a gated transaction ──────────────────────
        console.log(`\n  Testing gate passage for ${target5}...`);
        try {
            const raterGw   = await gwFor(client, raterUser);
            const integRater = cc(raterGw, INTEG_CC);
            const assetId   = uid('PART');
            const evId      = `ev-${crypto.randomBytes(8).toString('hex')}`;
            await integRater.submitTransaction(
                'RecordProvenanceWithReputation',
                assetId, SYBIL_EVENT, evId, target5, '0.85', 'quality', evId
            );
            raterGw.close();
            console.log(`  ✗ VULNERABILITY: gate PASSED for Sybil-inflated actor!`);
        } catch (e) {
            const detail = e?.details?.[0]?.message || e.message || '';
            console.log(`  ✓ BLOCKED by gate: ${detail.slice(0, 120)}`);
        }

        // ── 4. Break-even analysis: how many Sybils are needed to pass? ───────
        console.log('\n' + '═'.repeat(66));
        console.log('Break-even analysis: ratings needed to pass CI gate');
        console.log('(Each additional rating narrows CI width toward passing threshold)');
        console.log('═'.repeat(66));

        const targetBE  = uid('SYBIL-BREAKEVEN');
        const allRaters = [raterUser, ...sybilUsers, ...extraSybils];
        let ratingCount = 0;
        let passed      = false;

        for (const rater of allRaters) {
            if (passed) break;
            try {
                const gw  = await gwFor(client, rater);
                const rep = cc(gw, REP_CC);
                // Check if rater has stake first
                await rep.submitTransaction(
                    'SubmitRating', targetBE, 'quality', '1.0',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`,
                    String(Math.floor(Date.now() / 1000))
                );
                gw.close();
                ratingCount++;

                const repBE   = await getRep(client, targetBE, 'quality');
                const ciwBE   = (repBE.confidenceHigh - repBE.confidenceLow);
                const eligBE  = await checkElig(client, targetBE, SYBIL_EVENT);

                process.stdout.write(
                    `  n=${String(ratingCount).padStart(2)} score=${(repBE.score*100).toFixed(1).padStart(5)}%` +
                    `  CIw=${ciwBE.toFixed(4)}  ${ciwBE <= CI_MAX_WIDTH ? '✓ PASSES GATE' : '✗ still blocked'}\n`
                );

                if (eligBE.eligible) {
                    passed = true;
                    console.log(`\n  *** Gate passes at n=${ratingCount} ratings ***`);

                    // Try actual gated tx
                    try {
                        const raterGw2   = await gwFor(client, raterUser);
                        const integRater2 = cc(raterGw2, INTEG_CC);
                        const assetId = uid('PART');
                        const evId    = `ev-${crypto.randomBytes(8).toString('hex')}`;
                        await integRater2.submitTransaction(
                            'RecordProvenanceWithReputation',
                            assetId, SYBIL_EVENT, evId, targetBE, '0.85', 'quality', evId
                        );
                        raterGw2.close();
                        console.log(`  ✗ VULNERABILITY: gated tx committed at n=${ratingCount} Sybil ratings`);
                    } catch (e2) {
                        console.log(`  ✓ gated tx still blocked: ${(e2?.details?.[0]?.message || e2.message).slice(0,80)}`);
                    }
                }
            } catch (e) {
                // Rater has no stake — skip silently
            }
        }

        if (!passed) {
            console.log(`\n  Gate never passed within ${ratingCount} ratings from staked pool`);
        }

        // ── 5. Teardown ───────────────────────────────────────────────────────
        await adminInteg.submitTransaction(
            'SetReputationGate', SYBIL_EVENT, 'quality', '0.0', '0', '0.0', 'false'
        );
        adminGw.close();
        console.log('\n  Gate removed.\n');

        // ── 6. Summary ────────────────────────────────────────────────────────
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                         SUMMARY                             ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log(`  CI gate maxCIWidth=${CI_MAX_WIDTH} with 5 staked Sybils:`);
        console.log(`    Score delta: +${((rep5.score - 0.5) * 100).toFixed(1)}pp (from prior 50% to ${(rep5.score*100).toFixed(1)}%)`);
        console.log(`    CI width: ${ciw5.toFixed(4)} → ${ciw5 > CI_MAX_WIDTH ? 'ABOVE threshold ✓ gate blocked' : 'BELOW threshold ✗ gate passed'}`);
        console.log(`  Break-even: gate passes at n=${passed ? ratingCount : '>'+ratingCount} unique staked ratings`);
        console.log(`  Stake cost to pass gate: ≥ ${passed ? ratingCount : ratingCount}× ${10000} = ${(passed ? ratingCount : ratingCount) * 10000} stake units\n`);

    } finally {
        client.close();
    }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
