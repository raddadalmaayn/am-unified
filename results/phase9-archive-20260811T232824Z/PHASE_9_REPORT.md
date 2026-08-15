# PHASE 9 REPORT — consolidation, archive, and corrections to earlier reports

**Written:** 2026-08-11. **No measurement runs were performed for this document.**
Every figure was read from a file already on disk or from a live query against
the single-host ledger.

Phase 9's job is not to produce new results. It is to (a) reconcile the one
finding that is established across two reports and stated in neither, (b) correct
the earlier reports that are now known to be wrong, and (c) archive the raw
evidence so every number in the manuscript traces to a file in one step.

---

## 1. FINDING 1 — the throughput drop is a block-occupancy effect, not a regression

**This is the headline of the re-measurement, and it is the reason the
re-measurement exists.** It has been sitting in two reports as separate facts
and has never been stated as one finding.

### 1.1 The two numbers

| | Provenance | Reputation | Bridge |
|---|---|---|---|
| **Published** (Table 9, `tab:geo_concurrent`) | 29.95 TPS | 29.90 | 29.35 |
| **Re-measured** (Phase 3B, E/F/G) | **11.68** | 11.93 | 12.16 |

A naive reading is a 2.5× throughput regression. **It is not a regression.
Nothing about the system got slower.** The two harnesses offer load in
fundamentally different shapes, and the orderer's batching turns that shape
difference into a throughput difference.

### 1.2 The mechanism

The channel is configured `max_message_count = 10`, `batch_timeout = 50ms`
(verified in every Phase 3B manifest: `channel_params.batch_size.max_message_count
= 10`, `config_sequence = 6`). The orderer cuts a block when **either** ten
transactions are queued **or** 50 ms elapse, whichever comes first.

- The **wave-barrier** harness that produced the published figure dispatched all
  W transactions simultaneously and waited for the whole wave before dispatching
  the next. Arrivals are bursty by construction: ten transactions are in the
  orderer's queue essentially at once, so blocks fill toward
  `max_message_count` and the count-trigger fires.
- The **closed-loop** harness holds W transactions in flight and dispatches a
  replacement only as an earlier one commits. Arrivals are smooth by
  construction: the queue rarely reaches ten, so the **timeout** trigger fires
  instead and blocks are cut about a third full.

**Block rate is essentially unchanged. Occupancy is what changed.**

### 1.3 The evidence, from Phase 3B

Throughput is `tx_per_block × block_rate_per_s`, and under E2 both are measured
on the whole-run basis so the identity closes:

| Cond | tx/block | blocks/s | product | measured total-window TPS |
|---|---|---|---|---|
| E provenance | 3.29 | 3.63 | **11.94** | 11.97 |
| F reputation | 3.40 | 3.57 | **12.14** | 12.17 |
| G bridge | 3.48 | 3.54 | **12.32** | 12.52 |

Raw check, `phase3b-*/E/run1/manifest.json`: 2,000 committed in a
`height_delta` of 576 blocks on all four peers = **3.47 tx/block**.

**The arithmetic that settles it:** at the *same* block rate of 3.63 blocks/s,
reaching the published 29.95 TPS requires

```
29.95 / 3.63 = 8.25 transactions per block
```

against the 3.29 actually observed. **8.25 of a 10-transaction maximum is a
nearly-full block; 3.29 is a third-full block.** The published figure is not
a different throughput ceiling — it is the same ceiling reached with fuller
blocks, which is exactly what a barrier-synchronised load generator produces
and a closed-loop one does not.

### 1.4 Corroboration, from Phase 4

If occupancy were rising with offered load, closed-loop throughput would climb
toward the published figure at high W. It does not. Across the whole sweep,
occupancy stays flat around a third of capacity while block rate barely moves:

| W | tx/block | blocks/s | product |
|---|---|---|---|
| 1 | 1.00 | 2.52 | 2.52 |
| 5 | 2.86 | 3.10 | 8.87 |
| 10 | 4.10 | 3.83 | 15.70 |
| 20 | 3.55 | 4.32 | 15.34 |
| 50 | 3.31 | 4.07 | 13.47 |
| 100 | 3.58 | 4.11 | 14.71 |
| 200 | 3.99 | 4.31 | 17.20 |
| 400 | 4.94 | 5.87 | 29.00 |

From W=10 to W=200 — a twentyfold increase in offered load — occupancy moves
between 3.3 and 4.1 tx/block and never approaches 10. **Adding closed-loop
concurrency does not fill blocks**, because each new worker still waits for its
own predecessor to commit before dispatching. Only at W=400, where the client
begins to saturate (Phase 4 §8), does occupancy start to climb.

Single-host Phase 8 supplies the contrast that completes the argument: at W=100
on a host fast enough to cut ~70 blocks/s, occupancy does reach **7.58, 7.52,
7.30 tx/block** (condition E, three runs). So occupancy *can* approach
`max_message_count` — it just requires arrivals dense relative to the batch
timeout, which is precisely what the barrier harness manufactured and the
distributed closed-loop workload does not.

### 1.5 What this obliges the manuscript to do

1. **Table 9's numbers change**, from ~30 TPS to ~12 TPS, and the change must be
   explained as a load-shape effect rather than reported as a regression.
2. **The existing explanatory sentence in §5.4.2 is now wrong.** It currently
   reads that saturation "follows from MaxMessageCount = 10: the orderer cuts a
   block once ten transactions are queued, so sustained throughput is bounded by
   ten transactions per block cycle." Under closed-loop load the orderer
   **does not** cut on the count trigger — it cuts on the 50 ms timeout with
   about three transactions aboard. The bound is real but the stated mechanism
   is the wrong one.
3. **The closed-loop figure is the more honest one to publish.** It is a
   closed-loop measurement at a stated concurrency, which the manuscript already
   describes at §5.1 ("the offered arrival rate falls as latency rises, and the
   throughput figures reported below are closed-loop values at the stated
   concurrency rather than open-loop capacity"). The wave-barrier figure
   measures batching efficiency under synthetic bursts as much as it measures
   the system.
4. Neither figure is wrong as a measurement. They answer different questions,
   and the paper should say which one it is answering.

**With this reconciliation recorded, the Table 9 fragment
(`results/latex_fragments/table9_body.tex`) is cleared for use.**

---

## 2. CORRECTION 1 — Gate 0 §1.5, the fault-injection harness

**`REPORT.md` §1.5 states, in bold: "It does not exist."** In full:

> **It does not exist.** Repo-wide search for `SIGKILL`, `child_process`,
> `fork(`, `docker stop`, `docker network disconnect`, `fsync` returns zero
> matches on D1 and one match on the laptop (`scripts/deploy-4org.sh:35`, a
> teardown line). … Table 10's matrix has no reproducible harness. Phase 6
> builds this from nothing.

**This is true as scoped and false as generalised.** The search covered *the
repository*, `~/am-unified`. The harness lives at
`atomicity_comparison/harness/` — a **sibling directory, not part of
that repo**. It is complete and implements every mechanism the statement says is
missing:

| Mechanism | Location |
|---|---|
| child process per logical operation | `run.js:71` — `spawn('node', ['worker.js'])` |
| SIGKILL at pre-registered timings | `run.js:91,104` — `window` and `random` policies |
| fsync'd progress markers | `worker.js:48` — `fs.fsyncSync(fd)` |
| `docker stop` for the two-chaincode arm | `run_ccfault.js:73` |
| `docker network disconnect` | `run_ccfault.js:75` |
| independent key-based ledger walk | `run.js:127-176` — `verify()` |

**Consequences that must be tracked:**

- "Table 10's matrix has no reproducible harness" is **false**. It has a
  harness, a pre-specified condition matrix, per-condition confidence intervals,
  and raw per-trial markers on disk (2,001 files per 2,000-trial condition).
- "Phase 6 builds this from nothing" is **false**. Nothing needed building.
- The **Phase 10 brief inherited this error** and framed its entire decision
  around the cost of rebuilding a harness that already existed. Phase 10's own
  assessment caught this (`PHASE_10_ASSESSMENT.md` §1.1); this is the formal
  correction to the source.
- Phase 11 subsequently used that harness, extended it (`run11.js`,
  `worker11.js`, `reverify*.js`), and produced 2,900 fault-injected trials on the
  current binary.

**Lesson worth keeping:** a repo-scoped search reported as an absolute finding.
The statement should have read "no fault-injection harness exists *in this
repository*", which would have prompted the obvious next question.

---

## 3. CORRECTION 2 — `REPORT.md` §8.4 and §8.5, Phase 3 completion state

Both sections describe a state that Phase 3B superseded on 2026-08-09.

### 3.1 §8.4 — the truncated `E/run1`

§8.4 correctly disclosed `phase3-20260804T213214Z/E/run1/txs.jsonl` as a
1,100-of-2,000 partial with no manifest, and correctly refused to derive a
throughput figure from it. **That handling was right and is not being revised.**

What is now stale is its forward-looking clause, "Condition E requires a full
re-run of all three runs when the testbed returns." **That re-run happened.**
Phase 3B decision **DR1 (E re-run)** with **DR2 (new directory, nothing
deleted)** produced three complete E runs in `phase3b-20260809T210708Z/E/`. The
partial remains on disk, undeleted, and is still not used for anything.

**This is the precedent that governs partial conditions project-wide, and it was
applied again twice in Phase 11** (P2 attempt 1 at 75/500; both C6 arms after
the power loss): a partial condition is re-run **in full, into a new directory,
never topped up**, and the partial is retained and disclosed rather than deleted.

### 3.2 §8.5 — the completion table

The table in §8.5 is superseded in four rows. Corrected state:

| Condition | §8.5 said | **Actual, as of 2026-08-11** |
|---|---|---|
| A seq provenance | 3/3 ✅ | 3/3 ✅ (`phase3-*`) |
| B seq reputation | 3/3 ✅ | 3/3 ✅ (`phase3-*`) |
| C seq bridge | 3/3 ✅ | 3/3 ✅ (`phase3-*`) |
| D read W=1 | 3/3 ✅ | 3/3 ✅ (`phase3-*`) |
| **E conc provenance** | 0/3 ❌ truncated | **3/3 ✅** (`phase3b-*/E`) |
| **F conc reputation** | 0/3 ❌ not started | **3/3 ✅** (`phase3b-*/F`) |
| **G conc bridge** | 0/3 ❌ not started | **3/3 ✅** (`phase3b-*/G`) |
| **H high contention** | 0/3 ❌ not started | **3/3 ✅** (`phase3b-*/H`) |

**Phase 3 is complete.** All twelve Phase 3B runs converged with all four peers
agreeing on height *and* current block hash; no run met a pre-registered
exclusion criterion; no Raft election occurred; nothing was discarded
(`PHASE_3B_REPORT.md` §2).

§8.6 item 4 ("Re-run Phase 3 conditions E, F, G, H") is therefore **discharged**.

---

## 4. CORRECTION 3 — Phase 4 throughput, the steady-window definition

Three different steady-state throughput definitions were in circulation, and two
of them were wrong. Amendment **E1** resolved this by making `steady.js` the
single implementation; **D3** completed it by refactoring `analyze.js` to import
that module instead of carrying a second copy.

### 4.1 The three definitions

- **Manifest** (`counts.steady_count / timing.steady_duration_ms`): counts every
  non-warm-up transaction, including drain transactions that resolve after the
  in-flight count has already fallen below W, over a window many of them fall
  outside. **Inflates throughput.**
- **Old `analyze.js`** (B2 drain exclusion): dropped the trailing W completions
  but opened the window at the first non-warm-up record rather than at the
  moment the last warm-up transaction resolved. **Opened too early.**
- **E1 / `steady.js`** (authoritative): the interval during which exactly W
  transactions were in flight throughout — bounded below by the last warm-up
  completion and above by the first drain completion. Derived from `txs.jsonl`
  alone.

### 4.2 The corrected sweep, all three side by side

| W | Manifest | Old `analyze.js` | **Corrected (E1)** | count | window (s) |
|---|---|---|---|---|---|
| 1 | 2.32 | 2.32 | **2.32** | 94 | 40.5 |
| 5 | 8.39 | 8.28 | **8.27** | 469 | 56.6 |
| 10 | 13.93 | 13.79 | **13.66** | 438 | 32.3 |
| 20 | 13.30 | 12.76 | **12.73** | 414 | 33.5 |
| 50 | 12.10 | 11.78 | **11.75** | 1747 | 148.7 |
| 100 | 13.25 | 12.48 | **12.47** | 1695 | 135.6 |
| 200 | 15.05 | 13.25 | **13.24** | 1531 | 115.6 |
| 400 | 23.34 | 17.05 | **17.44** | 1184 | 68.0 |

The manifest figure is the most inflated at every level and the error grows with
W — **+34% at W=400**, where the drain is longest. W=400 is also the only level
where the corrected figure lands *above* the old `analyze.js` figure (17.44 vs
17.05), because there the too-early window opening hurt more than the drain
exclusion helped.

**No manifest or old-`analyze.js` figure should appear in the manuscript.**

### 4.3 D3 — the second definition is gone

`analyze.js` now imports `computeSteady` from `steady.js`. Its `steady_state.tps`
**is** the E1 figure. The superseded computation is retained, computed alongside,
and reported under the explicit key `steady_state_legacy_superseded`, for exactly
one consumer: the middle column of the table in §4.2. `emit_latex.js` reads that
explicitly-legacy key and **throws** if it is absent, so an `analysis.json` that
predates the refactor cannot silently produce a wrong column.

**Verification.** All eight Phase 4 `analysis.json` files were regenerated, then
every fragment was re-emitted. The E1 column computed *through `analyze.js`* now
reproduces, to the digit, the column `emit_latex.js` computes independently from
`txs.jsonl` — and **all eight `.tex` fragments are byte-identical to their
pre-refactor versions**:

```
IDENTICAL  figure4_pgfplots.tex
IDENTICAL  phase4_throughput_threeway_body.tex
IDENTICAL  table6_body.tex
IDENTICAL  table7_body.tex
IDENTICAL  table7_caption_clause.tex
IDENTICAL  table8_body.tex
IDENTICAL  table9_body.tex
IDENTICAL  table9h_failures_body.tex
```

The refactor changed no number. The `steady.js` header claim — "There is no
second definition" — is now true.

---

## 5. CORRECTION 4 — `PHASE_10_ASSESSMENT.md` §4

§4 states, under "Does the two-chaincode deployment still exist?":

> **Partly. The artifacts exist; the deployment does not.** … Currently committed
> on `mychannel`: **NO** — only `unified` v1.0 seq 1.

**Superseded on 2026-08-11.** `prov` and `rep` were deployed as CCAAS containers
at 03:19:34Z and 03:21:17Z and remain committed. Verified live on both orgs:

```
Committed chaincode definitions on channel 'mychannel':
Name: unified, Version: 1.0, Sequence: 1, ...
Name: prov,    Version: 1.0, Sequence: 1, ...
Name: rep,     Version: 1.0, Sequence: 1, ...
```

The rest of §4 stands, and **its central caveat is unchanged and still
load-bearing**: `prov.tar.gz` and `rep.tar.gz` are the **June binaries**, so
Design A is study-era code measured against a post-assertion Design B. That
asymmetry survived into Phase 11 and must be stated in the manuscript.

---

## 6. Corrections issued elsewhere, indexed here

Not repeated in full; recorded so the correction ledger is in one place.

| # | Report | Correction | Where |
|---|---|---|---|
| 6.1 | `RECOVERY_STATUS.md` | "C6 NOT STARTED" and "zero trials truncated by the power loss" are **wrong** — C6 attempt 1 was running at the failure | corrected in place, §0; `PHASE_11_REPORT.md` §10 |
| 6.2 | session note | "3,200 Design B trials" → **3,100** (2,900 fault-injected) | `PHASE_11_REPORT.md` §10 |
| 6.3 | `PHASE_4_REPORT.md` | still reads "Amendments in force: A1–A5"; E1/E2/E3 are not recorded there | **open**, §8 |
| 6.4 | `main.tex` §5.4.2 | stated saturation mechanism (blocks cut on the count trigger) is wrong under closed-loop load | **open**, §1.5 item 2 |

---

## 7. Archive

Raw evidence for every manuscript number, on the laptop, one directory per phase.

| Phase | Directory | Contents | Status |
|---|---|---|---|
| Gate 0 | `probe-20260804T212237Z/` | connection-multiplicity probe | on disk |
| Phase 0 | `phase0-20260804T202038Z/` | harness snapshot, `analyze.js` as-shipped | on disk |
| Phase 2 | `phase2-20260804T211001Z/` | — | on disk |
| Phase 3 | `phase3-20260804T213214Z/` | A–D complete; E/run1 partial, **retained** | on disk |
| Phase 3B | `phase3b-20260809T210708Z/` | E, F, G, H × 3, all complete | on disk |
| Phase 4 | `phase4-20260809T221329Z/` | W ∈ {1,5,10,20,50,100,200,400}, `analysis.json` **regenerated 2026-08-11** | on disk |
| Phase 6 | `phase6-20260810T205940Z/` | 6a rep 1 valid; rep 2 invalid; 6b absent | **incomplete** |
| Phase 8 | `phase8-20260810T040300Z/` + `8b`, `8c`, `8d` | single-host A–H, occupancy, env snapshot | on disk |
| Phase 11 | `atomicity_comparison/logs/run_P11_*`, `run_D4_*` | 16 run directories, per-trial `.prog` + `result.json` | on disk |
| Atomicity study (June) | `atomicity_comparison/logs/run_FG*` | 2,001 files per 2,000-trial condition | on disk |
| Fragments | `latex_fragments/` | 15 files, re-emitted 2026-08-11 post-D3 | current |

**Gaps, stated rather than glossed:**

- `probe-20260804T212237Z/` was analysed over SSH and never pulled from D1
  (`REPORT.md` §8.3). Whether the D1 copy survives is **unverified** — the lab
  has been unreachable since 2026-08-10 ~21:50Z.
- **Phase 11's C6 attempt 1 is unrecoverable.** Both arms wrote to `/tmp`, which
  the reboot cleared. Re-run in full; see `PHASE_11_REPORT.md` §7.
- **Archiving rule adopted:** no run may direct its only output to `/tmp`.
  Phase 11's C6 re-run writes into `atomicity_comparison/logs/run_P11_C6_rerun_*`.

---

## 8. Still open after Phase 9

| Item | State | Blocked on |
|---|---|---|
| `PHASE_4_REPORT.md` amendments line | says A1–A5; E1/E2/E3 not recorded | nothing — a text edit |
| Phase 6 completion (6a rep 2 & 3, 6b, 6c) | incomplete | **lab reachability** |
| Phase 5 | not started | lab reachability |
| Gate M4 | not started | lab reachability |
| Phase 7 | not started; 7b trigger branch taken (Phase 4 §9) | Gate M4 + lab |
| Phase 10 disclosure decision (A/B/C/D) | **no option chosen**; Phase 11 has partly overtaken it | your decision |
| prov/rep rebuild from current source | open since Phase 10 §8 q3 | your decision |
| Paper: apply the 15 fragments | none applied; Table 9 now cleared (§1) | §1.5 items 1–4 |
| Paper: §5.4.2 saturation mechanism | wrong under closed-loop load | §1.5 item 2 |
| Paper: Table 11 / atomicity disclosure | Phase 11 supplies post-assertion data at lower resolution | Phase 10 decision |
| Paper: binary asymmetry disclosure | Design A on June binaries vs Design B on current | §5 |
