'use strict';
/**
 * app.js — AM Dashboard frontend (4-Tab Edition)
 *
 * Tab 1: Lifecycle      — create parts, advance AM stages, trust report
 * Tab 2: Reputation     — full actor × dimension reputation table
 * Tab 3: CI Gate Demo   — watch CI width narrow until the gate passes
 * Tab 4: Buffer vs Direct — compare MVCC conflict rates side by side
 */

// ── DOM helper ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── State (Tab 1) ─────────────────────────────────────────────────────────────
const state = {
    parts:          [],   // [{ id, completedStages: [0,1,...] }]
    selectedPartId: null,
    stages:         [],   // populated from /api/lifecycle/stages
};

// ── Chart.js setup ────────────────────────────────────────────────────────────
const BLUE_PALETTE = [
    '#1f6feb', '#388bfd', '#79c0ff', '#58a6ff',
    '#3fb950', '#d29922', '#f85149',
];

const repChart = new Chart($('rep-chart').getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend:  { labels: { color: '#8b949e', font: { size: 10 } }, position: 'bottom' },
            tooltip: { mode: 'index', intersect: false },
        },
        scales: {
            x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
            y: { min: 0, max: 1,
                 ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
        },
        animation: { duration: 400 },
    },
});

const actorDatasetIndex = {};

function getOrCreateDataset(actor) {
    if (actorDatasetIndex[actor] !== undefined) return actorDatasetIndex[actor];
    const idx = repChart.data.datasets.length;
    repChart.data.datasets.push({
        label: actor,
        data: [],
        borderColor: BLUE_PALETTE[idx % BLUE_PALETTE.length],
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 4,
        borderWidth: 2,
    });
    actorDatasetIndex[actor] = idx;
    return idx;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'ok') {
    const el = $('toast');
    el.textContent = msg;
    el.className   = `toast ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 4500);
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════════════════════════════════════════

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        $(`tab-${target}`).classList.add('active');
        // Auto-load reputation table when switching to it
        if (target === 'reputation') loadReputation();
    });
});

// ════════════════════════════════════════════════════════════════════════════════
// TAB 1: LIFECYCLE
// ════════════════════════════════════════════════════════════════════════════════

// ── Health polling ────────────────────────────────────────────────────────────
async function checkHealth() {
    try {
        const data = await api('GET', '/api/health');
        if (data.ok) {
            $('status-dot').className    = 'dot dot-ok';
            $('status-text').textContent = 'Connected';
        } else throw new Error(data.error);
    } catch (_) {
        $('status-dot').className    = 'dot dot-error';
        $('status-text').textContent = 'Offline';
    }
}

// ── Stage loading ─────────────────────────────────────────────────────────────
async function loadStages() {
    const data = await api('GET', '/api/lifecycle/stages');
    if (data.stages) state.stages = data.stages;
}

// ── Parts list render ─────────────────────────────────────────────────────────
function renderPartsList() {
    const list = $('parts-list');
    list.innerHTML = '';
    if (state.parts.length === 0) {
        list.innerHTML = '<li class="empty-state">No parts yet.</li>';
        return;
    }
    state.parts.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.id;
        if (p.id === state.selectedPartId) li.classList.add('active');
        li.addEventListener('click', () => selectPart(p.id));
        list.appendChild(li);
    });
}

// ── Stepper render ────────────────────────────────────────────────────────────
function renderStepper() {
    const stepper     = $('stepper');
    const noPartMsg   = $('no-part-msg');
    const advanceForm = $('advance-form');
    const part = state.parts.find(p => p.id === state.selectedPartId);

    if (!part) {
        stepper.classList.add('hidden');
        advanceForm.classList.add('hidden');
        noPartMsg.classList.remove('hidden');
        return;
    }
    noPartMsg.classList.add('hidden');
    stepper.classList.remove('hidden');
    stepper.innerHTML = '';

    const currentStage = part.completedStages.length;

    state.stages.forEach((stage, i) => {
        const li       = document.createElement('li');
        const isDone   = part.completedStages.includes(i);
        const isActive = i === currentStage && currentStage < state.stages.length;

        if (isDone)   li.classList.add('done');
        if (isActive) li.classList.add('active');

        const badgeText  = isDone ? '✓' : isActive ? '●' : '○';
        const badgeClass = isDone ? 'done' : isActive ? 'active' : '';

        li.innerHTML = `
            <div class="step-info">
              <div class="step-label">${stage.eventType.replace(/_/g, ' ')}</div>
              <div class="step-meta">${stage.actor} · ${stage.dimension}</div>
            </div>
            <span class="step-badge ${badgeClass}">${badgeText}</span>
        `;
        stepper.appendChild(li);
    });

    if (currentStage < state.stages.length) {
        advanceForm.classList.remove('hidden');
        const next = state.stages[currentStage];
        $('adv-actor').value  = next.actor;
        $('adv-rating').value = next.defaultRating;
        $('adv-rating-val').textContent = Number(next.defaultRating).toFixed(2);
    } else {
        advanceForm.classList.add('hidden');
    }
}

// ── Reputation bars + evolution chart ────────────────────────────────────────
const DEMO_ACTORS = ['SupplierAlpha', 'DesignStudioX', 'PrinterBeta', 'PostProcGamma', 'QALabDelta'];

async function refreshReputation() {
    const repBars = $('rep-bars');
    repBars.innerHTML = '';

    for (const actor of DEMO_ACTORS) {
        try {
            const data = await api('GET', `/api/actors/${actor}/reputation`);
            if (!data.ok || !data.scores || typeof data.scores !== 'object') continue;
            const scores = data.scores;
            if (Object.keys(scores).length === 0) continue;

            const div = document.createElement('div');
            div.className = 'rep-actor';
            div.innerHTML = `<div class="rep-actor-name">${actor}</div>`;

            for (const [dim, score] of Object.entries(scores)) {
                const pct = (score * 100).toFixed(0);
                const dimEl = document.createElement('div');
                dimEl.className = 'rep-dim';
                dimEl.innerHTML = `
                    <div class="rep-dim-label">
                      <span>${dim}</span><span>${pct}%</span>
                    </div>
                    <div class="bar-track">
                      <div class="bar-fill" style="width:${pct}%"></div>
                    </div>
                `;
                div.appendChild(dimEl);

                if (dim === 'quality') {
                    const dsIdx = getOrCreateDataset(actor);
                    const part  = state.parts.find(p => p.id === state.selectedPartId);
                    const lbl   = part ? `S${part.completedStages.length}` : `T${Date.now()}`;
                    if (repChart.data.labels.at(-1) !== lbl) {
                        repChart.data.labels.push(lbl);
                        repChart.data.datasets.forEach((ds, j) => { if (j !== dsIdx) ds.data.push(null); });
                    }
                    const ds = repChart.data.datasets[dsIdx];
                    while (ds.data.length < repChart.data.labels.length - 1) ds.data.push(null);
                    ds.data.push(score);
                }
            }
            repBars.appendChild(div);
        } catch (_) {}
    }
    repChart.update();
}

// ── Trust report ──────────────────────────────────────────────────────────────
async function refreshTrustReport() {
    if (!state.selectedPartId) return;
    const el = $('report-content');
    try {
        const data = await api('GET', `/api/parts/${state.selectedPartId}/report`);
        if (!data.ok || !data.report) {
            el.innerHTML = `<div class="empty-state">${data.error || 'No report yet.'}</div>`;
            return;
        }
        const r = data.report;
        let html = '';

        if (r.currentStage) {
            html += `<div style="margin-bottom:8px;font-size:12px">
                Current stage: <strong style="color:var(--blue-lt)">${r.currentStage}</strong>
            </div>`;
        }

        const events = r.provenanceHistory || [];
        if (events.length > 0) {
            html += `<div class="report-section-title">Provenance History</div>
                <table class="report-table">
                <thead><tr><th>Event</th><th>Supplier</th><th>Agent MSP</th><th>Timestamp</th></tr></thead>
                <tbody>`;
            events.forEach(ev => {
                html += `<tr>
                    <td>${ev.eventType || '—'}</td>
                    <td>${ev.supplierId || ev.supplierID || '—'}</td>
                    <td>${ev.agentId   || ev.agentID   || '—'}</td>
                    <td style="font-size:10px">${ev.timestamp ? ev.timestamp.slice(0, 19) : '—'}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
        }

        const trustScores = r.actorTrustScores || {};
        if (Object.keys(trustScores).length > 0) {
            html += `<div class="report-section-title">Actor Trust Scores</div>
                <table class="report-table">
                <thead><tr><th>Actor</th><th>Dimension</th><th>Score</th><th>Events</th></tr></thead>
                <tbody>`;
            for (const [actor, summary] of Object.entries(trustScores)) {
                for (const [dim, ds] of Object.entries(summary.dimensions || {})) {
                    html += `<tr>
                        <td>${actor}</td>
                        <td>${dim}</td>
                        <td>${Number(ds.score).toFixed(3)}</td>
                        <td>${ds.totalEvents || 0}</td>
                    </tr>`;
                }
            }
            html += `</tbody></table>`;
        }

        const ratings = r.linkedRatings || [];
        if (ratings.length > 0) {
            html += `<div style="margin-top:6px;font-size:11px;color:var(--muted)">${ratings.length} linked rating(s)</div>`;
        }

        html += `<div style="margin-top:8px;font-size:11px;color:var(--muted)">
            Query latency: <span class="latency-badge">${data.latencyMs}ms</span>
        </div>`;

        el.innerHTML = html || '<div class="empty-state">Report is empty.</div>';
    } catch (e) {
        el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
}

// ── TX log ────────────────────────────────────────────────────────────────────
function addTxLog(fn, txID, latencyMs) {
    const log   = $('tx-log');
    const first = log.querySelector('.empty-state');
    if (first) first.remove();
    const li = document.createElement('li');
    const ts = new Date().toLocaleTimeString();
    const shortId = txID ? txID.slice(0, 16) + '…' : '—';
    li.innerHTML = `
        <span class="tx-fn">${fn}</span>
        <span class="tx-id" title="${txID || ''}">${shortId}</span>
        <span class="tx-lat">${latencyMs}ms</span>
        <span class="tx-time">${ts}</span>
    `;
    log.insertBefore(li, log.firstChild);
}

// ── Select part ───────────────────────────────────────────────────────────────
function selectPart(id) {
    state.selectedPartId = id;
    renderPartsList();
    renderStepper();
    refreshTrustReport();
}

// ── New Part ──────────────────────────────────────────────────────────────────
$('btn-new-part').addEventListener('click', async () => {
    const btn = $('btn-new-part');
    btn.disabled = true;
    try {
        const data = await api('POST', '/api/parts/new', {});
        if (!data.ok) { showToast(`Error: ${data.error}`, 'err'); return; }
        state.parts.unshift({ id: data.assetId, completedStages: [0] });
        renderPartsList();
        selectPart(data.assetId);
        addTxLog('RecordProv+Rep (MATERIAL_CERT)', data.txID, data.latencyMs);
        showToast(`Part created: ${data.assetId} · ${data.latencyMs}ms`, 'ok');
        await refreshReputation();
        await refreshTrustReport();
    } catch (e) {
        showToast(`Error: ${e.message}`, 'err');
    } finally {
        btn.disabled = false;
    }
});

// ── Init System ───────────────────────────────────────────────────────────────
$('btn-init').addEventListener('click', async () => {
    const btn = $('btn-init');
    btn.disabled = true; btn.textContent = 'Initialising…';
    try {
        const data = await api('POST', '/api/system/init', {});
        const log  = (data.log || []).join('\n');
        showToast(data.ok ? `System ready.\n${log}` : `Init error: ${data.error}\n${log}`,
                  data.ok ? 'ok' : 'err');
    } catch (e) {
        showToast(`Error: ${e.message}`, 'err');
    } finally {
        btn.disabled = false; btn.textContent = 'Init System';
    }
});

// ── Advance Stage ─────────────────────────────────────────────────────────────
$('btn-advance').addEventListener('click', async () => {
    const btn  = $('btn-advance');
    const part = state.parts.find(p => p.id === state.selectedPartId);
    if (!part) return;

    const stageIndex = part.completedStages.length;
    if (stageIndex >= state.stages.length) { showToast('All stages complete.', 'ok'); return; }

    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
        const data = await api('POST', `/api/parts/${part.id}/advance`, {
            stageIndex,
            actor:  $('adv-actor').value.trim() || undefined,
            rating: Number($('adv-rating').value),
        });
        if (!data.ok) { showToast(`Error: ${data.error}`, 'err'); return; }

        part.completedStages.push(stageIndex);
        renderStepper();
        addTxLog(`RecordProv+Rep (${state.stages[stageIndex].eventType})`, data.txID, data.latencyMs);
        showToast(`Stage ${stageIndex + 1} recorded · ${data.latencyMs}ms`, 'ok');
        await refreshReputation();
        await refreshTrustReport();
    } catch (e) {
        showToast(`Error: ${e.message}`, 'err');
    } finally {
        btn.disabled = false; btn.textContent = '▶ Advance Stage';
    }
});

$('adv-rating').addEventListener('input', () => {
    $('adv-rating-val').textContent = Number($('adv-rating').value).toFixed(2);
});

// ════════════════════════════════════════════════════════════════════════════════
// TAB 2: REPUTATION TABLE
// ════════════════════════════════════════════════════════════════════════════════

const DIMENSIONS = ['quality', 'delivery', 'compliance', 'warranty'];

async function loadReputation() {
    const wrap = $('rep-table-wrap');
    wrap.innerHTML = '<div class="empty-state">Loading…</div>';
    try {
        const data = await api('GET', '/api/actors');
        if (!data.ok) {
            wrap.innerHTML = `<div class="empty-state">Error: ${data.error}</div>`;
            return;
        }
        const actors = data.actors || {};
        if (Object.keys(actors).length === 0) {
            wrap.innerHTML = '<div class="empty-state">No actor data yet — advance some lifecycle stages first.</div>';
            return;
        }

        let html = `<table class="rep-full-table">
            <thead><tr>
              <th>Actor</th>
              ${DIMENSIONS.map(d =>
                  `<th>${d[0].toUpperCase() + d.slice(1)}</th><th>CI Width</th><th>Events</th>`
              ).join('')}
            </tr></thead>
            <tbody>`;

        for (const [actor, dims] of Object.entries(actors)) {
            html += `<tr><td><strong style="color:var(--text)">${actor}</strong></td>`;
            for (const dim of DIMENSIONS) {
                const d = dims[dim];
                if (d) {
                    const pct    = (d.score * 100).toFixed(1);
                    const ciwCls = d.ciWidth < 0.2 ? 'ciw-low' : d.ciWidth < 0.4 ? 'ciw-mid' : 'ciw-high';
                    html += `
                        <td><div class="score-cell">
                            <div class="score-bar-inner">
                              <div class="score-bar-fill" style="width:${pct}%"></div>
                            </div>
                            <span class="score-pct">${pct}%</span>
                        </div></td>
                        <td class="${ciwCls}" style="font-size:11px">${d.ciWidth.toFixed(3)}</td>
                        <td style="font-size:11px;color:var(--muted)">${d.totalEvents}</td>`;
                } else {
                    html += '<td colspan="3" style="color:var(--muted);font-size:11px;text-align:center">—</td>';
                }
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        wrap.innerHTML = html;
    } catch (e) {
        wrap.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
}

$('btn-refresh-rep').addEventListener('click', loadReputation);

// ════════════════════════════════════════════════════════════════════════════════
// TAB 3: CI GATE DEMO
// ════════════════════════════════════════════════════════════════════════════════

let ciActorId = null;
const ciHistory = [];   // { ts, count, score, ciWidth, totalEvents, eligible }

function renderCIStatus(data) {
    const wrap = $('ci-status-wrap');
    if (!data || !data.ready) {
        wrap.innerHTML = '<div class="empty-state">Click "Reset Demo" to create a new actor and install the CI gate.</div>';
        return;
    }

    const scorePct  = (data.score * 100).toFixed(1);
    const ciw       = data.ciWidth.toFixed(3);
    const ciwBarPct = Math.min((data.ciWidth / 1.0) * 100, 100).toFixed(0);
    const eligCls   = data.eligible ? 'badge-green' : 'badge-red';
    const eligText  = data.eligible ? '✓ ELIGIBLE' : '✗ BLOCKED';

    let reasonHtml = '';
    if (!data.eligible) {
        if (data.ciWidthBlocked) {
            reasonHtml = `<div style="font-size:11px;color:var(--red);margin-bottom:10px">
                CI width ${ciw} &gt; max ${Number(data.maxCIWidth || 0.5).toFixed(2)} — add more ratings to narrow the interval
            </div>`;
        } else if ((data.totalEvents || 0) < 3) {
            reasonHtml = `<div style="font-size:11px;color:var(--red);margin-bottom:10px">
                Only ${data.totalEvents || 0} rating(s) received; need ≥ 3
            </div>`;
        } else {
            reasonHtml = `<div style="font-size:11px;color:var(--red);margin-bottom:10px">
                Score ${scorePct}% is below the minimum threshold
            </div>`;
        }
    }

    const histHtml = ciHistory.slice(-6).reverse().map(h =>
        `<div class="ci-history-entry">
            ${h.ts}: +${h.count} rating → score ${(h.score * 100).toFixed(1)}%,
            CI width ${h.ciWidth.toFixed(3)},
            ${h.eligible
                ? '<span style="color:var(--green)">eligible ✓</span>'
                : '<span style="color:var(--red)">blocked</span>'}
        </div>`
    ).join('');

    // Preserve any gate-test result already in the DOM
    const prevResult = wrap.querySelector('.ci-gate-result');

    wrap.innerHTML = `
        <div class="ci-actor-id">Actor: ${data.actorId}</div>

        <div class="ci-gauge">
            <div class="ci-gauge-label">
                <span>Quality Score</span>
                <strong>${scorePct}%</strong>
            </div>
            <div class="ci-gauge-track">
                <div class="ci-gauge-fill ci-gauge-score" style="width:${scorePct}%"></div>
            </div>
        </div>

        <div class="ci-gauge">
            <div class="ci-gauge-label">
                <span>CI Width (gate threshold: 0.50)</span>
                <strong>${ciw}</strong>
            </div>
            <div class="ci-gauge-track">
                <div class="ci-gauge-fill ci-gauge-ciw" style="width:${ciwBarPct}%"></div>
            </div>
        </div>

        <div class="ci-meta">
            <span>Ratings received:</span>
            <strong>${data.totalEvents || 0}</strong>
            <span class="badge ${eligCls}">${eligText}</span>
        </div>

        ${reasonHtml}

        ${ciHistory.length > 0 ? `
        <div class="report-section-title" style="margin-top:8px">Rating History</div>
        <div class="ci-history-list">${histHtml}</div>` : ''}
    `;

    if (prevResult) wrap.appendChild(prevResult);
}

$('btn-ci-reset').addEventListener('click', async () => {
    const btn = $('btn-ci-reset');
    btn.disabled = true; btn.textContent = 'Resetting…';
    ciHistory.length = 0;
    try {
        const data = await api('POST', '/api/demo/ci/reset', {});
        if (!data.ok) { showToast(`Error: ${data.error}`, 'err'); return; }
        ciActorId = data.actorId;
        ['btn-ci-add1', 'btn-ci-add3', 'btn-ci-add5', 'btn-ci-test'].forEach(id => $(id).disabled = false);
        const status = await api('GET', '/api/demo/ci/status');
        renderCIStatus({ ...status, ready: true });
        showToast(`CI Gate demo ready — Actor: ${ciActorId}`, 'ok');
    } catch (e) {
        showToast(`Error: ${e.message}`, 'err');
    } finally {
        btn.disabled = false; btn.textContent = 'Reset Demo';
    }
});

async function addCIRatings(count) {
    const value = Number($('ci-rating-val').value);
    try {
        const data = await api('POST', '/api/demo/ci/add-rating', { value, count });
        if (!data.ok) { showToast(`Error: ${data.error}`, 'err'); return; }
        ciHistory.push({
            ts: new Date().toLocaleTimeString(),
            count, score: data.score, ciWidth: data.ciWidth,
            totalEvents: data.totalEvents, eligible: data.eligible,
        });
        renderCIStatus({ ...data, ready: true, actorId: ciActorId });
        const eligMsg = data.eligible ? 'ELIGIBLE ✓' : 'still blocked';
        showToast(`+${count} rating(s) — score: ${(data.score * 100).toFixed(1)}%, CI width: ${data.ciWidth.toFixed(3)} — ${eligMsg}`,
                  data.eligible ? 'ok' : 'err');
        addTxLog(`CI AddRating×${count}`, null, 0);
    } catch (e) {
        showToast(`Error: ${e.message}`, 'err');
    }
}

$('btn-ci-add1').addEventListener('click', () => addCIRatings(1));
$('btn-ci-add3').addEventListener('click', () => addCIRatings(3));
$('btn-ci-add5').addEventListener('click', () => addCIRatings(5));

$('ci-rating-val').addEventListener('input', () => {
    $('ci-rating-display').textContent = Number($('ci-rating-val').value).toFixed(2);
});

$('btn-ci-test').addEventListener('click', async () => {
    const btn = $('btn-ci-test');
    btn.disabled = true; btn.textContent = 'Testing…';
    try {
        const data = await api('POST', '/api/demo/ci/test-gate', {});

        // Remove previous gate-test result
        $('ci-status-wrap').querySelectorAll('.ci-gate-result').forEach(el => el.remove());

        const div = document.createElement('div');
        div.className = `ci-gate-result ${data.allowed ? 'passed' : 'blocked'}`;
        div.innerHTML = data.allowed
            ? `✓ Gate PASSED — transaction committed<br>
               <span style="font-size:10px;font-family:monospace;color:var(--muted)">${data.txId || ''}</span>`
            : `✗ Gate BLOCKED${data.reason
                ? `<br><span style="font-size:10px;color:var(--muted)">${data.reason.slice(0, 200)}</span>`
                : ''}`;
        $('ci-status-wrap').appendChild(div);

        showToast(data.allowed ? '✓ Gate test PASSED' : '✗ Gate test BLOCKED (expected — add more ratings)',
                  data.allowed ? 'ok' : 'err');
        addTxLog('CI TestGate', data.txId || null, 0);
    } catch (e) {
        showToast(`Error: ${e.message}`, 'err');
    } finally {
        btn.disabled = false; btn.textContent = 'Test Gate Passage';
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// TAB 4: BUFFER vs DIRECT
// ════════════════════════════════════════════════════════════════════════════════

$('buf-count').addEventListener('input', () => {
    $('buf-count-display').textContent = $('buf-count').value;
});

function renderBufResult(elId, data, mode) {
    const el = $(elId);
    if (!data || !data.ok) {
        el.innerHTML = `<div class="empty-state">Error: ${(data && data.error) || 'unknown'}</div>`;
        return;
    }
    const conflictPct = data.conflictPct || 0;
    const pctColor    = conflictPct > 50 ? 'var(--red)' : conflictPct > 10 ? 'var(--orange)' : 'var(--green)';
    const extra = mode === 'buffer'
        ? `<div style="margin-top:10px;font-size:12px;color:var(--muted)">
               Ratings flushed: <strong style="color:var(--text)">${data.flushed || 0}</strong>
               &nbsp;·&nbsp;
               New score: <strong style="color:var(--text)">${
                   data.newScore != null ? Number(data.newScore).toFixed(3) : '—'
               }</strong>
           </div>`
        : '';

    el.innerHTML = `
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-value">${data.attempted}</div>
                <div class="stat-label">Attempted</div>
            </div>
            <div class="stat-card ok">
                <div class="stat-value">${data.succeeded}</div>
                <div class="stat-label">Succeeded</div>
            </div>
            <div class="stat-card conflict">
                <div class="stat-value">${data.failed}</div>
                <div class="stat-label">Conflicts</div>
            </div>
            <div class="stat-card time">
                <div class="stat-value">${data.elapsed}ms</div>
                <div class="stat-label">Elapsed</div>
            </div>
        </div>
        <div class="conflict-bar-track">
            <div class="conflict-bar-fill" style="width:${conflictPct}%"></div>
        </div>
        <div class="conflict-pct" style="color:${pctColor}">
            Conflict rate: ${conflictPct}%
        </div>
        ${extra}
    `;
}

async function runDirect() {
    const count = parseInt($('buf-count').value);
    $('buf-direct-result').innerHTML = '<div class="empty-state">Running…</div>';
    const data = await api('POST', '/api/demo/direct/run', { count });
    renderBufResult('buf-direct-result', data, 'direct');
    addTxLog(`Direct×${count} (SubmitRating)`, null, data.elapsed || 0);
}

async function runBuffer() {
    const count = parseInt($('buf-count').value);
    $('buf-buffer-result').innerHTML = '<div class="empty-state">Running…</div>';
    const data = await api('POST', '/api/demo/buffer/run', { count });
    renderBufResult('buf-buffer-result', data, 'buffer');
    addTxLog(`Buffer×${count} + Flush`, null, data.elapsed || 0);
}

$('btn-buf-direct').addEventListener('click', async () => {
    const btn = $('btn-buf-direct');
    btn.disabled = true;
    try { await runDirect(); } catch (e) { showToast(`Error: ${e.message}`, 'err'); }
    finally { btn.disabled = false; }
});

$('btn-buf-buffer').addEventListener('click', async () => {
    const btn = $('btn-buf-buffer');
    btn.disabled = true;
    try { await runBuffer(); } catch (e) { showToast(`Error: ${e.message}`, 'err'); }
    finally { btn.disabled = false; }
});

$('btn-buf-both').addEventListener('click', async () => {
    const btn = $('btn-buf-both');
    btn.disabled = true; btn.textContent = 'Running…';
    try {
        await Promise.all([runDirect(), runBuffer()]);
        showToast('Both tests complete — compare conflict rates!', 'ok');
    } catch (e) {
        showToast(`Error: ${e.message}`, 'err');
    } finally {
        btn.disabled = false; btn.textContent = 'Run Both';
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════════════════════
(async () => {
    await loadStages();
    await checkHealth();
    setInterval(checkHealth, 10_000);
    renderPartsList();
    renderStepper();
    $('report-content').innerHTML = '<div class="empty-state">Select a part to load its trust report.</div>';
})();
