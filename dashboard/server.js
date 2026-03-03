'use strict';
/**
 * server.js — AM Supply Chain Dashboard API Server
 *
 * Serves static files from ./public and exposes REST endpoints
 * that proxy to the Fabric chaincode via fabric.js.
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { TextDecoder } = require('util');

const fabric = require('./fabric.js');

const app    = express();
const PORT   = 3000;
const utf8   = new TextDecoder();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Contract name constants ───────────────────────────────────────────────────
const PROV_CC  = 'ProvenanceContract';
const REP_CC   = 'ReputationContract';
const INTEG_CC = 'IntegrationContract';

// buyer1 was staked with 10000 during perf-test setup — use as the rater identity
// Admin is used for config queries and AddStake admin ops
const RATER_USER = 'buyer1';

// ── CI Gate demo state (server-side, resets on server restart) ────────────────
let ciDemoActorId = null;
const CI_GATE_EVENT      = 'DEMO_CI_GATE';
const CI_GATE_DIM        = 'quality';
const CI_GATE_MIN_SCORE  = '0.50';
const CI_GATE_MIN_EVENTS = '3';
const CI_GATE_MAX_CIWIDTH = '0.50';

const BUFFER_DEMO_ACTOR = 'PrinterBeta';
const BUFFER_DEMO_DIM   = 'delivery';

// ── Demo actors & stages ─────────────────────────────────────────────────────
const DEMO_ACTORS = ['SupplierAlpha', 'DesignStudioX', 'PrinterBeta', 'PostProcGamma', 'QALabDelta'];

const STAGES = [
    { index: 0, eventType: 'MATERIAL_CERTIFICATION', actor: 'SupplierAlpha',  dimension: 'quality',     defaultRating: 0.90 },
    { index: 1, eventType: 'DESIGN_FINALIZED',       actor: 'DesignStudioX',  dimension: 'quality',     defaultRating: 0.85 },
    { index: 2, eventType: 'PRINT_JOB_STARTED',      actor: 'PrinterBeta',    dimension: 'quality',     defaultRating: 0.80 },
    { index: 3, eventType: 'PRINT_JOB_COMPLETE',     actor: 'PrinterBeta',    dimension: 'delivery',    defaultRating: 0.88 },
    { index: 4, eventType: 'POST_PROCESSED',          actor: 'PostProcGamma',  dimension: 'compliance',  defaultRating: 0.92 },
    { index: 5, eventType: 'QA_CERTIFIED',            actor: 'QALabDelta',     dimension: 'quality',     defaultRating: 0.95 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function decode(resultBytes) {
    const str = utf8.decode(resultBytes);
    try { return JSON.parse(str); } catch (_) { return str; }
}

function ms(start) { return Date.now() - start; }

function errMsg(e) {
    // Fabric errors can be nested
    if (e && e.details && e.details.length > 0) {
        const d = e.details[0];
        return d.message || d.toString();
    }
    return e.message || String(e);
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Evaluates GetConfig on the reputation contract — cheap peer liveness check.
 */
app.get('/api/health', async (req, res) => {
    try {
        const contract = await fabric.getContract('Admin', REP_CC);
        const t0 = Date.now();
        const raw = await contract.evaluateTransaction('GetConfig');
        const config = decode(raw);
        res.json({ ok: true, latencyMs: ms(t0), config });
    } catch (e) {
        res.status(503).json({ ok: false, error: errMsg(e) });
    }
});

/**
 * POST /api/system/init
 * Initialises the reputation system and stakes the Admin identity (the rater).
 * Safe to call again — "already initialized" is suppressed.
 *
 * Note: AddStake(amount) stakes the *caller's* identity (from their cert).
 * The dashboard calls all transactions as Admin, so we stake Admin once.
 * Demo actors like "SupplierAlpha" are string IDs used as ratedActorID only —
 * they never submit transactions and don't need stake.
 */
app.post('/api/system/init', async (req, res) => {
    const log = [];
    try {
        const repContract = await fabric.getContract('Admin', REP_CC);

        // InitConfig takes no arguments — chaincode uses its own defaults
        try {
            await repContract.submitTransaction('InitConfig');
            log.push('InitConfig: OK');
        } catch (e) {
            const msg = errMsg(e);
            if (msg.toLowerCase().includes('already')) {
                log.push('InitConfig: already initialized (skipped)');
            } else {
                throw e;
            }
        }

        // Stake buyer1 (the rater identity used for RecordProvenanceWithReputation).
        // buyer1 was likely already staked by perf-test setup; errors are logged only.
        try {
            const buyerContract = await fabric.getContract(RATER_USER, REP_CC);
            await buyerContract.submitTransaction('AddStake', '10000');
            log.push('AddStake(buyer1): OK');
        } catch (e) {
            log.push(`AddStake(buyer1): ${errMsg(e)} (may already be staked)`);
        }

        res.json({ ok: true, log });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e), log });
    }
});

/**
 * GET /api/lifecycle/stages
 * Returns the ordered stage list so the frontend can render the stepper.
 */
app.get('/api/lifecycle/stages', (req, res) => {
    res.json({ stages: STAGES });
});

/**
 * POST /api/parts/new
 * Creates a new part by recording the first lifecycle stage (MATERIAL_CERTIFICATION).
 * Body: { assetId? }   — if omitted a UUID is generated
 *
 * RecordProvenanceWithReputation signature (7 params):
 *   assetID, eventType, offChainDataHash, ratedActorID, ratingValueStr, dimension, evidenceHash
 * Admin is the rater (caller identity from cert); ratedActorID is the demo actor string.
 */
app.post('/api/parts/new', async (req, res) => {
    const assetId    = req.body.assetId || `PART-${uuidv4().slice(0, 8).toUpperCase()}`;
    const stage      = STAGES[0];
    const evidenceId = `EV-${uuidv4()}`;

    try {
        const contract = await fabric.getContract(RATER_USER, INTEG_CC);
        const t0 = Date.now();
        const raw = await contract.submitTransaction(
            'RecordProvenanceWithReputation',
            assetId,                      // assetID
            stage.eventType,              // eventType
            evidenceId,                   // offChainDataHash (placeholder hash)
            stage.actor,                  // ratedActorID (e.g. SupplierAlpha)
            String(stage.defaultRating),  // ratingValueStr [0,1]
            stage.dimension,              // dimension
            evidenceId                    // evidenceHash
        );
        const latencyMs = ms(t0);
        const ratingId  = decode(raw);    // chaincode returns the generated ratingID
        res.json({ ok: true, assetId, stageIndex: 0, txID: ratingId, latencyMs });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

/**
 * POST /api/parts/:id/advance
 * Advances a part to the next lifecycle stage.
 * Body: { stageIndex, actor?, rating? }
 */
app.post('/api/parts/:id/advance', async (req, res) => {
    const assetId    = req.params.id;
    const { stageIndex, actor, rating } = req.body;

    if (stageIndex == null || stageIndex < 1 || stageIndex >= STAGES.length) {
        return res.status(400).json({ ok: false, error: `stageIndex must be 1–${STAGES.length - 1}` });
    }

    const stage      = STAGES[stageIndex];
    const effectiveActor  = actor  || stage.actor;
    const effectiveRating = rating != null ? Number(rating) : stage.defaultRating;
    const ratingId   = `RATING-${uuidv4()}`;
    const evidenceId = `EV-${uuidv4()}`;

    try {
        const contract = await fabric.getContract(RATER_USER, INTEG_CC);
        const t0 = Date.now();
        const raw = await contract.submitTransaction(
            'RecordProvenanceWithReputation',
            assetId,                        // assetID
            stage.eventType,                // eventType
            evidenceId,                     // offChainDataHash
            effectiveActor,                 // ratedActorID
            String(effectiveRating),        // ratingValueStr [0,1]
            stage.dimension,                // dimension
            evidenceId                      // evidenceHash
        );
        const latencyMs = ms(t0);
        const ratingId  = decode(raw);      // chaincode returns generated ratingID
        res.json({ ok: true, assetId, stageIndex, ratingId, txID: ratingId, latencyMs });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

/**
 * GET /api/parts/:id/report
 * Returns the full PartTrustReport for a part.
 */
app.get('/api/parts/:id/report', async (req, res) => {
    try {
        const contract = await fabric.getContract('Admin', INTEG_CC);
        const t0  = Date.now();
        const raw = await contract.evaluateTransaction('GetPartTrustReport', req.params.id);
        const latencyMs = ms(t0);
        const report    = decode(raw);
        res.json({ ok: true, latencyMs, report });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

// Valid dimensions from chaincode config
const DIMENSIONS = ['quality', 'delivery', 'compliance', 'warranty'];

/**
 * GET /api/actors/:id/reputation
 * Returns reputation scores across all dimensions for a given actor.
 * Calls GetReputation(actorID, dimension) once per dimension.
 */
app.get('/api/actors/:id/reputation', async (req, res) => {
    try {
        const contract = await fabric.getContract('Admin', REP_CC);
        const t0     = Date.now();
        const scores = {};

        await Promise.all(DIMENSIONS.map(async (dim) => {
            try {
                const raw  = await contract.evaluateTransaction('GetReputation', req.params.id, dim);
                const data = decode(raw);
                if (data && data.score != null) {
                    scores[dim] = data.score;
                }
            } catch (_) {
                // Dimension not yet rated — omit from results
            }
        }));

        res.json({ ok: true, latencyMs: ms(t0), actor: req.params.id, scores });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

// ── All Actors Full Reputation ────────────────────────────────────────────────
/**
 * GET /api/actors
 * Returns reputation (score + CI bounds + totalEvents) across all 4 dimensions
 * for every demo actor.
 */
app.get('/api/actors', async (req, res) => {
    try {
        const contract = await fabric.getContract('Admin', REP_CC);
        const t0 = Date.now();
        const actors = {};

        await Promise.all(DEMO_ACTORS.map(async (actor) => {
            const dims = {};
            await Promise.all(DIMENSIONS.map(async (dim) => {
                try {
                    const raw = await contract.evaluateTransaction('GetReputation', actor, dim);
                    const d   = decode(raw);
                    if (d && d.score != null) {
                        dims[dim] = {
                            score:       d.score,
                            alpha:       d.alpha,
                            beta:        d.beta,
                            totalEvents: d.totalEvents || 0,
                            ciLow:       d.confidenceLow  || 0,
                            ciHigh:      d.confidenceHigh || 0,
                            ciWidth:     ((d.confidenceHigh || 0) - (d.confidenceLow || 0)),
                        };
                    }
                } catch (_) {}
            }));
            if (Object.keys(dims).length > 0) actors[actor] = dims;
        }));

        res.json({ ok: true, latencyMs: ms(t0), actors });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

// ── CI Gate Demo ──────────────────────────────────────────────────────────────
/**
 * POST /api/demo/ci/reset
 * Generates a fresh demo actor and (re-)configures the CI gate.
 */
app.post('/api/demo/ci/reset', async (req, res) => {
    const { v4: uuid } = require('uuid');
    ciDemoActorId = `CIDemoActor-${uuid().slice(0, 8).toUpperCase()}`;
    try {
        const integ = await fabric.getContract('Admin', INTEG_CC);
        await integ.submitTransaction(
            'SetReputationGate',
            CI_GATE_EVENT, CI_GATE_DIM,
            CI_GATE_MIN_SCORE, CI_GATE_MIN_EVENTS,
            CI_GATE_MAX_CIWIDTH, 'true',
        );
        res.json({ ok: true, actorId: ciDemoActorId,
            gate: { minScore: +CI_GATE_MIN_SCORE, minEvents: +CI_GATE_MIN_EVENTS, maxCIWidth: +CI_GATE_MAX_CIWIDTH } });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

/**
 * GET /api/demo/ci/status
 * Returns current reputation + CI gate eligibility for the demo actor.
 */
app.get('/api/demo/ci/status', async (req, res) => {
    if (!ciDemoActorId) return res.json({ ok: true, ready: false });
    try {
        const repC   = await fabric.getContract('Admin', REP_CC);
        const integC = await fabric.getContract('Admin', INTEG_CC);
        const t0     = Date.now();
        const rep    = decode(await repC.evaluateTransaction('GetReputation', ciDemoActorId, CI_GATE_DIM));
        const elig   = decode(await integC.evaluateTransaction('CheckActorEligibility', ciDemoActorId, CI_GATE_EVENT));
        res.json({
            ok: true, ready: true, latencyMs: ms(t0),
            actorId:    ciDemoActorId,
            score:      rep.score,
            ciLow:      rep.confidenceLow,
            ciHigh:     rep.confidenceHigh,
            ciWidth:    (rep.confidenceHigh || 0) - (rep.confidenceLow || 0),
            totalEvents: rep.totalEvents || 0,
            eligible:    elig.eligible,
            ciWidthBlocked: elig.ciWidthBlocked,
            maxCIWidth:  elig.maxCIWidth,
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

/**
 * POST /api/demo/ci/add-rating
 * Submits 1–5 ratings to the demo actor and returns updated status.
 * Body: { value?, count? }
 */
app.post('/api/demo/ci/add-rating', async (req, res) => {
    if (!ciDemoActorId) return res.status(400).json({ ok: false, error: 'No demo actor. Call /reset first.' });
    const value = req.body.value != null ? Number(req.body.value) : 0.85;
    const count = Math.min(parseInt(req.body.count) || 1, 5);
    try {
        const repC = await fabric.getContract(RATER_USER, REP_CC);
        const t0   = Date.now();
        for (let i = 0; i < count; i++) {
            await repC.submitTransaction('SubmitRating', ciDemoActorId, CI_GATE_DIM,
                String(value.toFixed(2)), `ci-ev-${uuidv4()}`, '0');
        }
        // Return updated status inline
        const repC2  = await fabric.getContract('Admin', REP_CC);
        const integC = await fabric.getContract('Admin', INTEG_CC);
        const rep    = decode(await repC2.evaluateTransaction('GetReputation', ciDemoActorId, CI_GATE_DIM));
        const elig   = decode(await integC.evaluateTransaction('CheckActorEligibility', ciDemoActorId, CI_GATE_EVENT));
        res.json({
            ok: true, latencyMs: ms(t0), count,
            score:       rep.score,
            ciWidth:     (rep.confidenceHigh || 0) - (rep.confidenceLow || 0),
            totalEvents: rep.totalEvents || 0,
            eligible:    elig.eligible,
            ciWidthBlocked: elig.ciWidthBlocked,
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

/**
 * POST /api/demo/ci/test-gate
 * Tries RecordProvenanceWithReputation for the demo actor.
 * Returns allowed=true/false.
 */
app.post('/api/demo/ci/test-gate', async (req, res) => {
    if (!ciDemoActorId) return res.status(400).json({ ok: false, error: 'No demo actor.' });
    const assetId = `GT-${uuidv4().slice(0, 6).toUpperCase()}`;
    const evId    = `EV-${uuidv4()}`;
    try {
        const integ = await fabric.getContract(RATER_USER, INTEG_CC);
        const t0    = Date.now();
        const raw   = await integ.submitTransaction(
            'RecordProvenanceWithReputation',
            assetId, CI_GATE_EVENT, evId, ciDemoActorId, '0.85', CI_GATE_DIM, evId,
        );
        res.json({ ok: true, allowed: true, latencyMs: ms(t0), txId: decode(raw) });
    } catch (e) {
        const detail = e?.details?.[0]?.message || e.message || '';
        res.json({ ok: true, allowed: false, reason: detail.slice(0, 200) });
    }
});

// ── Buffer vs Direct Demo ─────────────────────────────────────────────────────
/**
 * POST /api/demo/direct/run
 * N concurrent SubmitRating calls on the same hot key — expect MVCC conflicts.
 * Body: { count }
 */
app.post('/api/demo/direct/run', async (req, res) => {
    const count = Math.min(parseInt(req.body.count) || 10, 20);
    try {
        const contract = await fabric.getContract(RATER_USER, REP_CC);
        const t0       = Date.now();
        const results  = await Promise.allSettled(
            Array.from({ length: count }, (_, i) =>
                contract.submitTransaction('SubmitRating',
                    BUFFER_DEMO_ACTOR, BUFFER_DEMO_DIM,
                    String((0.75 + (i % 5) * 0.02).toFixed(2)),
                    `d-${uuidv4()}`, '0')
            )
        );
        const elapsed   = ms(t0);
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed    = results.filter(r => r.status === 'rejected').length;
        res.json({ ok: true, attempted: count, succeeded, failed, elapsed,
            conflictPct: Math.round(failed / count * 100) });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

/**
 * POST /api/demo/buffer/run
 * N concurrent BufferRating calls (unique keys) then 1 FlushRatings — 0 conflicts.
 * Body: { count }
 */
app.post('/api/demo/buffer/run', async (req, res) => {
    const count = Math.min(parseInt(req.body.count) || 10, 20);
    try {
        const contract = await fabric.getContract(RATER_USER, REP_CC);
        const t0       = Date.now();
        const results  = await Promise.allSettled(
            Array.from({ length: count }, (_, i) =>
                contract.submitTransaction('BufferRating',
                    BUFFER_DEMO_ACTOR, BUFFER_DEMO_DIM,
                    String((0.75 + (i % 5) * 0.02).toFixed(2)),
                    `b-${uuidv4()}`)
            )
        );
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed    = results.filter(r => r.status === 'rejected').length;
        let   flushed   = 0;
        let   newScore  = null;
        if (succeeded > 0) {
            const fr = decode(await contract.submitTransaction('FlushRatings', BUFFER_DEMO_ACTOR, BUFFER_DEMO_DIM));
            flushed  = fr.ratingsFlushed || 0;
            newScore = fr.newScore;
        }
        res.json({ ok: true, attempted: count, succeeded, failed, elapsed: ms(t0),
            conflictPct: Math.round(failed / count * 100), flushed, newScore });
    } catch (e) {
        res.status(500).json({ ok: false, error: errMsg(e) });
    }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT',  () => { fabric.closeAll(); process.exit(0); });
process.on('SIGTERM', () => { fabric.closeAll(); process.exit(0); });

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`AM Dashboard running at http://localhost:${PORT}`);
    console.log('Fabric: mychannel / unified (CCAAS)');
});
