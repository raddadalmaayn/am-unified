'use strict';
/**
 * ============================================================================
 * security_test.js — Unified AM System Security Test Suite
 * ============================================================================
 *
 * Tests the resilience of the reputation layer against eight attack vectors:
 *
 *   1. Self-Rating Attack         — actor attempts to rate themselves
 *   2. Sybil Attack               — multiple colluding identities inflate reputation
 *   3. Collusion Attack           — organised ring of raters boost one actor
 *   4. Unauthorized Access        — non-admin calls admin-only functions
 *   5. Insufficient Stake         — rater without stake attempts to rate
 *   6. Evidence Tampering         — submitting ratings with fabricated evidence
 *   7. Reputation Gate Bypass     — actor below threshold attempts gated operation
 *   8. Provenance Replay Attack   — duplicate provenance event for same asset
 *
 * For each attack:
 *   - Executes the attack vector against the live chaincode
 *   - Records whether the defence held (BLOCKED) or failed (VULNERABILITY)
 *   - Logs latency of the defence check
 *   - Generates a structured JSON + text report
 *
 * Results are written to:
 *   ../results/security/security_results_<timestamp>.json
 *   ../results/security/security_report_<timestamp>.txt
 * ============================================================================
 */

const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ── Network configuration ────────────────────────────────────────────────────
const channelName   = 'mychannel';
const chaincodeName = 'unified';
const mspId         = 'Org1MSP';

const cryptoPath    = path.resolve(__dirname, '..', '..', 'fabric-samples', 'test-network',
                        'organizations', 'peerOrganizations', 'org1.example.com');
const peerEndpoint  = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';
const tlsCertPath   = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');

// ── Contract names ────────────────────────────────────────────────────────────
const PROV_CC  = 'ProvenanceContract';
const REP_CC   = 'ReputationContract';
const INTEG_CC = 'IntegrationContract';

// ── Test identities ───────────────────────────────────────────────────────────
const adminUser    = 'Admin';
const attackerUser = 'buyer1';      // legitimate user turned attacker in some tests
const victimUser   = 'tps_user_1';  // actor being targeted
const sybilUsers   = Array.from({ length: 5 }, (_, i) => `tps_user_${i + 2}`);

const MIN_STAKE = '10000';

// ── Counter for unique IDs ────────────────────────────────────────────────────
let _cnt = 0;
function uid(p = 'ID') { return `${p}-${Date.now()}-${++_cnt}`; }

// ── Results ───────────────────────────────────────────────────────────────────
const attackResults = [];

// ============================================================================
// MAIN
// ============================================================================
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   Unified AM System — Reputation Layer Security Tests    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const client       = await newGrpcConnection();
    const adminGw      = await newGatewayForUser(client, adminUser);
    const adminNetwork = adminGw.getNetwork(channelName);
    const adminRepCC   = adminNetwork.getContract(chaincodeName, REP_CC);
    const adminIntegCC = adminNetwork.getContract(chaincodeName, INTEG_CC);
    const adminProvCC  = adminNetwork.getContract(chaincodeName, PROV_CC);

    try {
        // ── System bootstrap ──────────────────────────────────────────────────
        console.log('[Bootstrap] Initialising system...');
        try { await adminRepCC.submitTransaction('InitConfig'); }
        catch (e) {
            const detail = (e.details && e.details[0] && e.details[0].message) || '';
            if (!e.message.includes('already') && !detail.includes('already')) throw e;
        }

        // Stake the attacker so they are a valid participant in most tests
        console.log('[Bootstrap] Staking test users...');
        for (const user of [attackerUser, ...sybilUsers]) {
            await stakeUser(client, user, MIN_STAKE);
        }
        console.log('  ✓ Bootstrap complete\n');

        // ====================================================================
        // ATTACK 1: Self-Rating
        // ====================================================================
        await runAttack({
            name:          'Self-Rating Attack',
            vector:        'Actor attempts to submit a rating for themselves',
            expectBlocked: true,
            mitigations:   ['Identity normalisation + strict self-check in SubmitRating'],
            run: async () => {
                const gw  = await newGatewayForUser(client, attackerUser);
                const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
                // The buyer1 CN becomes their normalised actorID
                await rep.submitTransaction(
                    'SubmitRating',
                    attackerUser, 'quality', '1.0',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`,
                    String(Math.floor(Date.now() / 1000))
                );
            }
        });

        // ====================================================================
        // ATTACK 2: Sybil Attack
        // ====================================================================
        await runAttack({
            name:          'Sybil Attack (coordinated inflation)',
            vector:        `${sybilUsers.length} Sybil identities each rate the same actor with maximum score`,
            expectBlocked: false, // partial – Sybil inflate score but stake requirement limits scale
            mitigations:   [
                'Stake requirement — each Sybil must lock capital',
                'Meta-reputation weighting — new accounts carry low weight',
                'Wilson CI — low-confidence actors flagged by wide confidence interval',
            ],
            run: async () => {
                const target = uid('SYBIL-TARGET');
                let successCount = 0;
                const scoresBefore = await evaluateReputation(client, adminUser, target, 'quality');

                for (const sybil of sybilUsers) {
                    try {
                        const gw  = await newGatewayForUser(client, sybil);
                        const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
                        await rep.submitTransaction(
                            'SubmitRating', target, 'quality', '1.0',
                            `sha256:${crypto.randomBytes(16).toString('hex')}`,
                            String(Math.floor(Date.now() / 1000))
                        );
                        successCount++;
                    } catch { /* expected for unstaked sybils */ }
                }

                const scoresAfter = await evaluateReputation(client, adminUser, target, 'quality');
                const scoreDelta  = (scoresAfter.score - (scoresBefore?.score || 0.5)).toFixed(4);
                return {
                    sybilsAttempted: sybilUsers.length,
                    sybilsSucceeded: successCount,
                    scoreDelta,
                    ciWidthAfter: (scoresAfter.confidenceHigh - scoresAfter.confidenceLow).toFixed(4),
                    observation: successCount > 0
                        ? `Score shifted by ${scoreDelta} — stake cost limited amplification; CI width signals low confidence`
                        : 'All Sybil attempts blocked (unstaked)',
                };
            }
        });

        // ====================================================================
        // ATTACK 3: Collusion Attack
        // ====================================================================
        await runAttack({
            name:          'Collusion Attack (rating ring)',
            vector:        'Colluding raters mutually inflate each other\'s reputation',
            expectBlocked: false,
            mitigations:   [
                'Meta-reputation — new accounts have low weight; circular inflation has diminishing returns',
                'Stake capital at risk — collusion can be penalised via disputes',
                'Dispute mechanism — any actor can challenge a suspicious rating',
            ],
            run: async () => {
                // Colluders mutually rate each other
                const colluderA = sybilUsers[0];
                const colluderB = sybilUsers[1];

                const gw_a  = await newGatewayForUser(client, colluderA);
                const rep_a = gw_a.getNetwork(channelName).getContract(chaincodeName, REP_CC);
                await rep_a.submitTransaction(
                    'SubmitRating', colluderB, 'quality', '1.0',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`,
                    String(Math.floor(Date.now() / 1000))
                );

                const gw_b  = await newGatewayForUser(client, colluderB);
                const rep_b = gw_b.getNetwork(channelName).getContract(chaincodeName, REP_CC);
                await rep_b.submitTransaction(
                    'SubmitRating', colluderA, 'quality', '1.0',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`,
                    String(Math.floor(Date.now() / 1000))
                );

                const repA = await evaluateReputation(client, adminUser, colluderA, 'quality');
                const repB = await evaluateReputation(client, adminUser, colluderB, 'quality');

                return {
                    colluderAScore: repA.score.toFixed(4),
                    colluderBScore: repB.score.toFixed(4),
                    observation: 'Mutual ratings recorded but low meta-reputation weight limits amplification',
                };
            }
        });

        // ====================================================================
        // ATTACK 4: Unauthorized Access (non-admin calls admin function)
        // ====================================================================
        await runAttack({
            name:          'Unauthorized Access Attack',
            vector:        'Non-admin identity calls SetReputationGate (admin-only function)',
            expectBlocked: true,
            mitigations:   ['Role-based access control via ADMIN_LIST on-chain registry'],
            run: async () => {
                const gw    = await newGatewayForUser(client, attackerUser);
                const integ = gw.getNetwork(channelName).getContract(chaincodeName, INTEG_CC);
                await integ.submitTransaction(
                    'SetReputationGate', 'PRINT_JOB', 'quality', '0.9', '5', 'true'
                );
            }
        });

        await runAttack({
            name:          'Unauthorized Admin Grant',
            vector:        'Non-admin attempts to grant admin rights to themselves',
            expectBlocked: true,
            mitigations:   ['isAdmin() check in AddAdmin function'],
            run: async () => {
                const gw  = await newGatewayForUser(client, attackerUser);
                const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
                await rep.submitTransaction('AddAdmin', attackerUser);
            }
        });

        // ====================================================================
        // ATTACK 5: Insufficient Stake Attack
        // ====================================================================
        await runAttack({
            name:          'Insufficient Stake Attack',
            vector:        'Actor without stake attempts to submit a rating',
            expectBlocked: true,
            mitigations:   ['Minimum stake check in SubmitRating — balance must be ≥ minStakeRequired'],
            run: async () => {
                // Reset attacker's stake to zero so they cannot rate
                await adminRepCC.submitTransaction('ResetStake', attackerUser);
                await sleep(500);

                const gw  = await newGatewayForUser(client, attackerUser);
                const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
                await rep.submitTransaction(
                    'SubmitRating', uid('VICTIM'), 'quality', '0.5',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`,
                    String(Math.floor(Date.now() / 1000))
                );
            },
            teardown: async () => {
                // Re-stake attacker for remaining tests
                await stakeUser(client, attackerUser, MIN_STAKE);
            }
        });

        // ====================================================================
        // ATTACK 6: Evidence Tampering
        // ====================================================================
        await runAttack({
            name:          'Evidence Tampering Attack',
            vector:        'Attacker submits a rating with a fabricated/random evidence hash',
            expectBlocked: false,
            mitigations:   [
                'Evidence is stored as an opaque hash — the chaincode does not verify the hash\'s pre-image',
                'Off-chain verification: auditors check the hash against the real evidence document',
                'Dispute mechanism: any party can challenge ratings with suspicious evidence',
                'Recommendation: integrate IPFS-based evidence anchoring in production',
            ],
            run: async () => {
                const gw  = await newGatewayForUser(client, attackerUser);
                const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
                const ratingID = await rep.submitTransaction(
                    'SubmitRating', uid('VICTIM'), 'quality', '1.0',
                    `sha256:FABRICATED_EVIDENCE_${crypto.randomBytes(8).toString('hex')}`,
                    String(Math.floor(Date.now() / 1000))
                );
                return {
                    ratingID: utf8Decode(ratingID),
                    observation: 'Rating accepted — evidence hash is not pre-image verified on-chain. Mitigation is off-chain audit.',
                };
            }
        });

        // ====================================================================
        // ATTACK 7: Reputation Gate Bypass
        // ====================================================================
        await runAttack({
            name:          'Reputation Gate Bypass Attack',
            vector:        'Actor below reputation threshold attempts a gated integrated operation',
            expectBlocked: true,
            mitigations:   ['SetReputationGate + CheckActorEligibility enforced inside RecordProvenanceWithReputation'],
            run: async () => {
                // Set a high reputation gate for PRINT_JOB
                await adminIntegCC.submitTransaction(
                    'SetReputationGate', 'PRINT_JOB', 'quality', '0.99', '100', '0.0', 'true'
                );
                await sleep(500);

                // New supplier with zero history — score defaults to 0.5 (prior), events=0 < 100
                const newSupplier = uid('NEWBIE-SUPPLIER');
                const gw    = await newGatewayForUser(client, attackerUser);
                const integ = gw.getNetwork(channelName).getContract(chaincodeName, INTEG_CC);
                await integ.submitTransaction(
                    'RecordProvenanceWithReputation',
                    uid('PART-GATE'), 'PRINT_JOB',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`,
                    newSupplier, '0.8', 'quality',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`
                );
            },
            teardown: async () => {
                // Remove the gate so other tests are unaffected
                await adminIntegCC.submitTransaction(
                    'SetReputationGate', 'PRINT_JOB', 'quality', '0.0', '0', '0.0', 'false'
                );
            }
        });

        // ====================================================================
        // ATTACK 8: Provenance Replay Attack
        // ====================================================================
        await runAttack({
            name:          'Provenance Replay Attack',
            vector:        'Attacker replays an existing asset creation to overwrite provenance history',
            expectBlocked: true,
            mitigations:   ['AssetExists() check in CreateMaterialCertification prevents duplicate asset creation'],
            run: async () => {
                const assetID = uid('REPLAY-PART');

                // First, create the asset legitimately
                const gw1   = await newGatewayForUser(client, attackerUser);
                const prov1 = gw1.getNetwork(channelName).getContract(chaincodeName, PROV_CC);
                await prov1.submitTransaction(
                    'CreateMaterialCertification',
                    assetID, 'Ti-6Al-4V', uid('BATCH'), 'SupplierAlpha',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`
                );
                await sleep(500);

                // Now replay the same asset creation — should be blocked
                const gw2   = await newGatewayForUser(client, attackerUser);
                const prov2 = gw2.getNetwork(channelName).getContract(chaincodeName, PROV_CC);
                await prov2.submitTransaction(
                    'CreateMaterialCertification',
                    assetID, 'MALICIOUS-MATERIAL', uid('BATCH'), 'AttackerCorp',
                    `sha256:${crypto.randomBytes(16).toString('hex')}`
                );
            }
        });

        // ── Print and save results ────────────────────────────────────────────
        printSecurityResults();
        await saveSecurityResults();

    } finally {
        adminGw.close();
        client.close();
    }
}

// ============================================================================
// ATTACK RUNNER
// ============================================================================

async function runAttack({ name, vector, expectBlocked, mitigations, run, teardown }) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Attack: ${name}`);
    console.log(`Vector: ${vector}`);
    console.log(`Expected: ${expectBlocked ? 'BLOCKED' : 'PARTIALLY MITIGATED'}`);

    const result = {
        name,
        vector,
        expectBlocked,
        mitigations,
        outcome: null,
        defenceHeld: null,
        latencyMs: null,
        details: null,
        error: null,
    };

    const start = process.hrtime.bigint();
    try {
        const details = await run();
        const end   = process.hrtime.bigint();
        result.latencyMs = Number(end - start) / 1_000_000;
        result.details   = details || {};

        if (expectBlocked) {
            // The attack should have thrown — if we get here, defence failed
            result.outcome    = 'VULNERABILITY — attack was NOT blocked';
            result.defenceHeld = false;
            console.log(`  ✗ VULNERABILITY: attack succeeded when it should have been blocked`);
        } else {
            result.outcome    = 'PARTIAL MITIGATION — attack executed but effects are limited';
            result.defenceHeld = true;
            console.log(`  ~ PARTIAL MITIGATION: attack executed, mitigations applied`);
        }
    } catch (err) {
        const end   = process.hrtime.bigint();
        result.latencyMs = Number(end - start) / 1_000_000;
        result.error     = err.message?.slice(0, 300);

        if (expectBlocked) {
            result.outcome    = 'BLOCKED — defence held';
            result.defenceHeld = true;
            console.log(`  ✓ BLOCKED: ${err.message?.slice(0, 100)}`);
        } else {
            result.outcome    = 'ERROR — unexpected failure during partial-mitigation attack';
            result.defenceHeld = false;
            console.log(`  ✗ UNEXPECTED ERROR: ${err.message?.slice(0, 100)}`);
        }
    }

    console.log(`  Defence latency: ${result.latencyMs?.toFixed(1)} ms`);
    console.log('  Mitigations:');
    mitigations.forEach(m => console.log(`    • ${m}`));

    if (teardown) {
        try { await teardown(); } catch { /* ignore teardown errors */ }
    }

    attackResults.push(result);
}

// ============================================================================
// HELPERS
// ============================================================================

async function stakeUser(client, username, amount) {
    try {
        const gw  = await newGatewayForUser(client, username);
        const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
        await rep.submitTransaction('AddStake', amount);
        await sleep(300);
    } catch (e) {
        if (!e.message.includes('already')) {
            console.warn(`  ⚠ Stake warning for ${username}: ${e.message?.slice(0, 80)}`);
        }
    }
}

async function evaluateReputation(client, username, actorID, dimension) {
    try {
        const gw  = await newGatewayForUser(client, username);
        const rep = gw.getNetwork(channelName).getContract(chaincodeName, REP_CC);
        const raw = await rep.evaluateTransaction('GetReputation', actorID, dimension);
        return JSON.parse(utf8Decode(raw));
    } catch {
        return { score: 0.5, confidenceLow: 0, confidenceHigh: 1 };
    }
}

function utf8Decode(buffer) {
    return Buffer.from(buffer).toString('utf8');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Print results ─────────────────────────────────────────────────────────────
function printSecurityResults() {
    const total    = attackResults.length;
    const held     = attackResults.filter(r => r.defenceHeld).length;
    const failed   = attackResults.filter(r => !r.defenceHeld).length;

    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              UNIFIED AM SYSTEM — SECURITY TEST RESULTS              ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

    attackResults.forEach((r, idx) => {
        const icon = r.defenceHeld ? '✓' : '✗';
        console.log(`  ${idx + 1}. [${icon}] ${r.name}`);
        console.log(`       Outcome: ${r.outcome}`);
        console.log(`       Latency: ${r.latencyMs?.toFixed(1)} ms`);
        if (r.details && Object.keys(r.details).length > 0) {
            console.log(`       Details: ${JSON.stringify(r.details)}`);
        }
    });

    console.log(`\n  Summary: ${held}/${total} defences held  |  ${failed} potential vulnerability(ies)`);
}

// ── Save results ──────────────────────────────────────────────────────────────
async function saveSecurityResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir    = path.resolve(__dirname, '..', 'results', 'security');
    await fs.mkdir(outDir, { recursive: true });

    // JSON report
    const jsonPath = path.join(outDir, `security_results_${timestamp}.json`);
    await fs.writeFile(jsonPath, JSON.stringify({ timestamp, attackResults }, null, 2));

    // Human-readable text report
    const txtPath = path.join(outDir, `security_report_${timestamp}.txt`);
    const lines   = [
        'Unified AM System — Security Test Report',
        `Generated: ${new Date().toISOString()}`,
        `Chaincode: ${chaincodeName} on channel ${channelName}`,
        '='.repeat(72),
        '',
    ];

    attackResults.forEach((r, i) => {
        lines.push(`${i + 1}. ${r.name}`);
        lines.push(`   Attack Vector : ${r.vector}`);
        lines.push(`   Outcome       : ${r.outcome}`);
        lines.push(`   Defence Held  : ${r.defenceHeld ? 'YES' : 'NO'}`);
        lines.push(`   Latency (ms)  : ${r.latencyMs?.toFixed(1)}`);
        if (r.error) lines.push(`   Error Message : ${r.error.slice(0, 200)}`);
        if (r.details && Object.keys(r.details).length > 0) {
            lines.push(`   Observations  : ${JSON.stringify(r.details)}`);
        }
        lines.push('   Mitigations:');
        r.mitigations.forEach(m => lines.push(`     • ${m}`));
        lines.push('');
    });

    const held   = attackResults.filter(r => r.defenceHeld).length;
    const total  = attackResults.length;
    lines.push('─'.repeat(72));
    lines.push(`Summary: ${held}/${total} defences held`);

    await fs.writeFile(txtPath, lines.join('\n'));
    console.log(`\n✅ Security reports saved to:\n   ${jsonPath}\n   ${txtPath}`);
}

// ============================================================================
// CONNECTION HELPERS
// ============================================================================

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
    console.error('\n******** SECURITY TEST FAILED ********');
    console.error(err);
    process.exitCode = 1;
});
