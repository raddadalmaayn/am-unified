# RECOVERY STATUS — post power-loss assessment

**Written:** 2026-08-11. **Zero runs were performed. Nothing was deployed,
started, edited or re-emitted.** Every figure below was read from a file on
disk, from `docker inspect` on stopped containers, or from image metadata.

Where a quantity cannot be measured without starting the network, it is named
as unmeasured and no substitute is offered.

**Power-loss instant, established from container state:** every Fabric and
CCAAS container on the single host records
`State.FinishedAt = 2026-08-11T04:38:48Z` (2026-08-10 22:38:48 local, UTC−6).
The last session transcript ends at 22:38:50 local. These agree.

---

> ## ⚠️ CORRECTION, 2026-08-11 17:30 — two findings below are WRONG
>
> Once the network was restarted, the `rep` chaincode's **container log** —
> which lives outside both `/tmp` and the logs tree, and which this assessment
> did not consult — showed that **C6 attempt 1 was running when the power
> failed**. It drove 1,000 distinct rated actors through the `rep` chaincode
> between 04:35:23Z and 04:36:37Z.
>
> Therefore, in what follows:
> - **"C6 — NOT STARTED" is wrong.** C6 attempt 1 started at ~04:34:42Z. Its
>   Design B arm completed; its Design A arm was killed mid-run.
> - **"Zero trials truncated by the power loss" is wrong.** C6's Design A arm
>   was truncated by it, and C6's Design B arm completed but its output went to
>   `/tmp` and was destroyed by the reboot.
>
> **Root cause of the error:** run state was inferred from the filesystem alone.
> `bench.js` writes nothing until it exits, so a run killed mid-flight is
> indistinguishable by directory listing from one never launched. Every other
> condition used `run11.js`, which writes per-trial `.prog` files continuously —
> which is exactly why the inference held for those and failed for this one.
>
> Everything else in this document was re-checked against the live ledger and
> stands. Both C6 arms have since been re-run in full. See `PHASE_11_REPORT.md`
> §7 and §10.

## 0. The headline, before the detail

**Phase 11 is materially further along than the context block states. One
condition (C6) was lost to the power failure; see the correction above.**

- P2, P4 and all three C5 conditions **completed cleanly** before the power
  loss. They were not still running.
- ~~**No trial anywhere was truncated by the power loss.**~~ **WRONG, see correction above.** No *`run11.js`* trial was truncated; C6, driven by `bench.js`, was.
- ~~**C6 was never started**~~ — **WRONG, see correction above.** C6 attempt 1 was running at the power loss; it wrote no files because `bench.js` emits output only on exit.
- **There is no condition labelled C7.** The Design A control exists under the
  label `D4_A_window_seq` and ran *before* the P11 conditions, not after.
- P4 and C5 each have **two generations**; the first generation of each is
  **invalid** and superseded.

Details and every contradiction are in §8.

---

## S1. Phase 11 state

All Phase 11 data lives in `atomicity_comparison/logs/`, one
directory per run, `<opId>.prog` per trial plus `result.json` written only on
clean termination by `run11.js:192`. Absence of `result.json` is therefore an
exact truncation marker.

| Cond | Directory | Planned N | Trials on disk | result.json | Termination | State |
|---|---|---|---|---|---|---|
| C1 calibration | `run_P11_C1_calib_1786420116548` | 200 | 200 | ✅ | clean | **COMPLETE** |
| P1 pre-endorse | `run_P11_P1_pre_1786420670477` | 500 | 500 | ✅ | clean | **COMPLETE** |
| P2 post-endorse (att. 1) | `run_P11_P2_postendorse_1786420906988` | 500 | 75 | ❌ | operator abort | **PARTIAL — superseded** |
| P2 post-endorse (att. 2) | `run_P11_P2_postendorse_1786421087319` | 500 | 500 | ✅ | clean | **COMPLETE** |
| P3 post-submit | `run_P11_P3_postsubmit_1786420297369` | 500 | 500 | ✅ | clean | **COMPLETE** |
| P4 random (v1) | `run_P11_P4_random_1786421518018` | 500 | 500 | ✅ | clean | **COMPLETE but INVALID** |
| P4 random (v2) | `run_P11_P4v2_random_1786421901120` | 500 | 500 | ✅ | clean | **COMPLETE** |
| C5 matcert (v1) | `run_P11_C5_matcert_1786421607648` | 300 | 297 | ❌ | operator abort | **PARTIAL — superseded** |
| C5 print (v1) | `run_P11_C5_print_1786421653268` | 300 | 89 | ❌ | operator abort | **PARTIAL — superseded** |
| C5 delivery (v1) | `run_P11_C5_delivery_1786421667849` | 300 | 300 | ✅ | clean | **COMPLETE but INVALID** |
| C5 matcert (v2) | `run_P11_C5v2_matcert_1786422240462` | 300 | 300 | ✅ | clean | **COMPLETE** |
| C5 print (v2) | `run_P11_C5v2_print_1786422446813` | 300 | 300 | ✅ | clean | **COMPLETE** |
| C5 delivery (v2) | `run_P11_C5v2_delivery_1786422651978` | 300 | 300 | ✅ | clean | **COMPLETE** |
| C6 arm 1 (Design B) | *(output to `/tmp`, destroyed)* | 500 | 0 files | — | **completed, artifact lost** | ⚠️ **CORRECTED — see top** |
| C6 arm 2 (Design A) | *(output to `/tmp`, destroyed)* | 500 | 0 files | — | **truncated by power loss** | ⚠️ **CORRECTED — see top** |
| C7 / Design A control | `run_D4_A_window_seq_1786418704674` | 500 | 500 | ✅ | clean | **COMPLETE** (label is `D4_A_window_seq`, not C7) |

Smoke runs also present and complete: `run_P11_SMOKE_1786420094791` (n=3),
`run_SMOKE_A/A2/B` (n=2 each).

### Classifications as recorded

| Cond | killed | Summary | PARTIAL (divergent) | Wilson 95% UB |
|---|---|---|---|---|
| C1 (policy `none`) | 0/200 | ALL_THREE 200 | **0** | 1.885% |
| P1 (`pre`) | 500/500 | NEITHER 500 | **0** | 0.762% |
| P2 (`postendorse`) | 500/500 | NEITHER 500 | **0** | 0.762% |
| P3 (`postsubmit`) | 500/500 | ALL_THREE 500 | **0** | 0.762% |
| P4 v2 (`random`, rmax 285) | 484/500 | NEITHER 417, ALL_THREE 83 | **0** | 0.762% |
| C5 v2 matcert | 289/300 | NEITHER 247, ALL_THREE 53 | **0** | 1.264% |
| C5 v2 print | 284/300 | NEITHER 233, ALL_THREE 67 | **0** | 1.264% |
| C5 v2 delivery | 297/300 | NEITHER 268, ALL_THREE 32 | **0** | 1.264% |
| D4 Design A control | 500/500 | DIVERGENT 500 | 500/500 = 100% | — |

**Valid Design B trials to date: 3,100 (200 + 500 + 500 + 500 + 500 + 900).
Zero PARTIAL in every one.** The invalid v1 generations (P4 v1 500, C5 v1
delivery 300) are excluded and are not counted toward any bound.

### Why the v1 generations are invalid

`run11.js:84–93` records the defect in its own comment: under the `random`
policy the kill delay was timed from `spawn()` rather than from the `START`
marker. A Node child needs ~450 ms to boot and connect its gateway, so every
kill landed inside process startup and **no transaction had begun**. This is
directly observable: in P4 v1 and C5 v1 delivery, **500/500 and 300/300 `.prog`
files are zero bytes** — not one marker written in any trial. C5 v1 matcert and
print show the same pattern (296 of 297 and 88 of 89 empty). The v2 runs arm on
`START` and show 0 empty markers.

### Internal consistency of the partial conditions

| Cond | Trials | Empty `.prog` | Markers, no classification | Classification, no markers |
|---|---|---|---|---|
| P2 attempt 1 | 75 | 0 | **75** | 0 |
| C5 v1 matcert | 297 | 296 | 1 | 0 |
| C5 v1 print | 89 | 88 | 1 | 0 |

The 74 complete P2-attempt-1 trials all carry the marker set
`START,ENDORSE_DONE` — exactly what the `postendorse` policy should produce —
plus one un-killed trial with the full `START,ENDORSE_DONE,SUBMIT_RETURNED,
COMMIT_RESOLVED,DONE` set. The markers are internally consistent; they simply
have no ledger walk, because `verify()` runs only after the trial loop.

For **every** run that did terminate cleanly, `len(result.json.records)` equals
the `.prog` file count exactly (checked on all twelve). No run has a
records/markers count mismatch.

---

## S2. Truncation integrity

### Trials with fsync'd markers but no ledger-walk classification

| Condition | Count |
|---|---|
| P2 post-endorse, attempt 1 | 75 |
| C5 v1 matcert | 1 |
| C5 v1 print | 1 |
| **Total** | **77** |

A further **384** trials (296 + 88) have *neither* markers nor classification —
zero-byte `.prog` files in the aborted v1 runs. They are empty by the spawn-timing
defect, not by truncation.

### Trials with a ledger walk but no markers

**800**: P4 v1 (500) and C5 v1 delivery (300). Both runs terminated cleanly and
classified every trial, but every `.prog` is empty. **These are not power-loss
artifacts** — they are the direct signature of the `random`-policy defect, and
both runs are already superseded.

### Trials truncated by the power loss

**⚠️ CORRECTED.** Zero *`run11.js`* trials. But C6, driven by `bench.js`, was
truncated: its Design A arm was mid-run at 04:38:48Z. `bench.js` writes nothing
until it exits, so this left no filesystem trace at all. Original text follows.

~~Zero.~~ The last write of any kind is `run_P11_C5v2_delivery`'s `result.json`
at 2026-08-10 22:34:42 local (04:34:42Z). The machine lost power at 04:38:48Z.
Every truncation on disk is an operator abort that immediately preceded a
deliberate re-run with corrected code.

### Re-run policy I would apply

**Any partial condition is re-run in full, into a new directory, never topped
up.** This is the Phase 3B precedent (`PHASE_3B_REPORT.md:6`, decisions DR1
"E re-run" and DR2 "new directory, nothing deleted"): a condition that did not
complete is re-executed at full N and the partial data is retained but not
merged. Topping up would mix trials taken under two harness revisions and two
ledger sizes within one condition, and would break the pre-registered
"no condition was extended, truncated, or re-run after its divergence rate was
observed" discipline the paper asserts at `main.tex:875`.

**Applied here, no re-run is owed.** All three partial conditions (P2 att. 1,
C5 v1 matcert, C5 v1 print) were already re-run in full into new directories,
and the two "complete but invalid" v1 runs likewise. C6 is not a partial
condition — it is unstarted, and simply needs to be run.

---

## S3. Ledger and deployment state

### Is the network running?

**No.** Every container is stopped.

| Container | Status | Image |
|---|---|---|
| `peer0.org1.example.com` | Exited (0) | `hyperledger/fabric-peer:latest` |
| `peer0.org2.example.com` | Exited (0) | `hyperledger/fabric-peer:latest` |
| `orderer.example.com` | Exited (0) | `hyperledger/fabric-orderer:latest` |
| `ca_org1`, `ca_org2`, `ca_orderer` | Exited (137) | `hyperledger/fabric-ca:latest` |
| `peer0org1_unified_ccaas`, `peer0org2_unified_ccaas` | Exited (2) | `unified_ccaas_image:latest` |
| `peer0org1_prov_ccaas`, `peer0org2_prov_ccaas` | Exited (2) | `prov_ccaas_image:latest` |
| `peer0org1_rep_ccaas`, `peer0org2_rep_ccaas` | Exited (2) | `rep_ccaas_image:latest` |

All twelve stopped at `2026-08-11T04:38:48Z`. **Stopped, not removed.** Ledger
volumes `compose_peer0.org1.example.com`, `compose_peer0.org2.example.com` and
`compose_orderer.example.com` are all present in `docker volume ls`.

### Ledger height and counted_keys

**Cannot be read at rest.** `/var/lib/docker/volumes/.../_data` is root-owned,
there is no passwordless sudo, and reading the height requires either `peer
channel getinfo` against a live peer or root access to the block files. Neither
is available under a read-only assessment.

**Last recorded values**, from
`results/phase8d-seqcheck-20260810T205432Z/A/run1/manifest.json`:

| Quantity | Value | Captured |
|---|---|---|
| Ledger height (org1) | **13,433** | 2026-08-10T20:55:03.937Z |
| Ledger height (org2) | **13,433** | same — peers agree |
| `currentBlockHash` | `ojWLUXFFrNfgoaEXqt/iYF/hgTtuWKTACSWXl9NDzsE=` | same |
| `counted_keys` | **67,587** | 2026-08-10T20:55Z |
| — `activeActors` | 27,014 | |
| — `totalRatings` | 27,065 | |
| — `linkedEvents` | 13,508 | |

**Both figures are stale.** Between that capture and the power loss the ledger
took the D4 Design A run (500 logical ops × 2 transactions) and roughly 4,600
Phase 11 Design B trials — order 11,000 further transactions, none of which
recorded a height. The current height is strictly greater than 13,433 and is
**unmeasured**.

### Versions and digests

| Item | Value | Source |
|---|---|---|
| Fabric peer / orderer / cli | **v3.1.0** | `phase8-.../env_singlehost.json` |
| fabric-peer image (registry digest) | `sha256:995b34aedd61bbd1c7631460c229d48b5a52b4d388aac73c48df433b4daace9d` | `docker images --digests` |
| fabric-orderer image (registry digest) | `sha256:41856f6a38adbad0dcd679c16c5c4f14453137cea633894f0971a203c7d9507c` | `docker images --digests` |
| fabric-peer image (local ID, as recorded) | `sha256:d0c8e53735626da30d66cdc8b81406d45458583d3779be4a1a2aac1eba84e01c` | env snapshot |
| fabric-orderer image (local ID, as recorded) | `sha256:ac3b801a6da5c056e967e9738b0a998df5f9b159df6986196406a757cd03c075` | env snapshot |
| fabric-ca image | `sha256:09cb0b50ebdb4298e0d69c17d314eb8e96826eeafe2b6a7d14a06b7b6e47fb52` | env snapshot |
| **unified** CCAAS image | `sha256:242e80b3871e5c3b7e2170c8d2a556734dbd580d87e5318ec1434f629618945b` | `docker inspect` |
| **unified** chaincode binary sha256 | `41f333d6ffcab44b5d2c3f50fb2797ddd21a6093d9c0a17a9836033623029cbe` | manifest + env snapshot, agree |
| **unified** package ID (org1 = org2) | `unified_1.0:e41a6a4fdeb3050ef7bd45952b4772e5baf0474c553c2928b619916caa2a6153` | manifest |
| **unified** source commit | `9a9db0ef541d2e400effdb08e3b4a135692a2c10`, tree clean | env snapshot |
| **prov** CCAAS image | `sha256:1639c1d988787bd5032fde99182257727e5159e744b1f267adcb255cc5f0f8e4` | `docker inspect` — built ~7 weeks ago (June package) |
| **rep** CCAAS image | `sha256:3d85e16391a6939b1d52d4f2f7b867d348ca6f94faca5a8be72239f0e5a804c7` | `docker inspect` — built ~7 weeks ago (June package) |

### Are prov and rep still committed on the channel?

**Not directly verifiable without a live query.** The positive evidence is
strong: `peer0org1_prov_ccaas` was created at `2026-08-11T03:19:34Z` and
`peer0org1_rep_ccaas` at `03:21:17Z`, and the `D4_A_window_seq` run at
~03:25Z drove 500 two-chaincode logical operations to a 500/500 DIVERGENT
result — which requires both chaincodes committed and endorsing on
`mychannel` at that moment. Chaincode definitions are ledger state and survive
a container stop. Expect them to still be committed; confirm with
`peer lifecycle chaincode querycommitted` before relying on it.

### Is the C5/C6/C7 comparison still on the same deployment as P1/P3? — **YES**

`peer0org1_unified_ccaas` has a single unbroken lifetime:

```
created = 2026-08-10T03:57:20.585Z
started = 2026-08-10T03:57:20.617Z
finished= 2026-08-11T04:38:48.485Z   (power loss)
```

That one container instance spans Phase 8, Phase 4 **and every Phase 11
condition including P1, P3 and all of C5**. The network was never torn down,
never rebuilt, and the chaincode was never re-deployed in that interval. The
same-deployment requirement **holds for everything run so far**.

> **Load-bearing caveat for the restart.** It stays true only if the network is
> brought back with `docker start` on the existing containers. Running
> `network.sh up` would recreate the containers and volumes, reset the ledger,
> and destroy the comparability of C6 against P1/P3. Do not do that.

---

## S4. E1 and E2 status

### E1 — steady-window definition: **NOT applied to `analyze.js`**

`client-tests/analyze.js` was last modified **2026-08-10 14:25:29**, before the
corrections were issued. It still carries the superseded "B2 drain exclusion"
definition:

```js
// analyze.js:102-133  (UNCHANGED — this is the OLD definition)
  const steady = recs.filter(r => r.status === 'COMMITTED' && !r.warmup);
  ...
  // B2: DRAIN EXCLUSION.
  // The last `slots` completions occur while in-flight is decaying from W to 0,
  // so they are not measured under the intended offered load. Sort steady
  ... throughput window over what remains. Both counts are reported so the
  const steadySorted = steady ...
  const dropCount = Math.min(slots, steadySorted.length);
  const retained = steadySorted.slice(0, steadySorted.length - dropCount);
  let steady_tps = null, steady_window_ms = null;
    steady_window_ms = Number(last - first) / 1e6;
    // n-1 completions occur strictly inside the window between first and last.
    steady_tps = steady_window_ms > 0 ? ((retained.length - 1) / (steady_window_ms / 1000)) : null;
```

E1 **was** implemented, but as a **new single-source module**,
`client-tests/steady.js`, created 2026-08-10 22:15:31, which `emit_latex.js`
imports. Its header states the intent explicitly:

```js
/*
 * steady.js — THE single implementation of the steady-state window (amendment E1,
 * 2026-08-11). Every consumer imports this. There is no second definition.
 *
 * DEFINITION. The steady interval is the period during which exactly W
 * transactions were in flight throughout. Derived from txs.jsonl alone:
 *
 *   t_start = max(t_committed_ns) over records with warmup == true
 *   drain   = records with seq >= (total - W)
 *   t_end   = min(t_committed_ns) over drain
 *   count   = committed records with t_start < t_committed_ns <= t_end
 *   steady_tps = count / (t_end - t_start)
 */
```

**The claim "there is no second definition" is currently false.** The old
definition still lives in `analyze.js` and is still reachable by anything that
calls `analyze.js` directly — including the per-condition and per-run markdown
tables it prints ("Steady TPS" columns at `analyze.js:235` and `:282`), and
`analysis.json`'s `steady_state.tps`, which `emit_latex.js:337` still reads as
`tps_prev_analyze`. Whether E1 is considered discharged depends on whether it
required `analyze.js` to change or only required a single authoritative
implementation for emitted numbers. **As literally worded, E1 is not applied.
I have changed nothing.**

### E2 — `total_window_tps` in the Table 9 emitter: **APPLIED**

```js
// emit_latex.js:143 — column emitted
    const twt = P(`T9.${c}.total_window_tps`, f(st.total_window_tps, 2),
                  path.join(PHASE3B, c, '*/txs.jsonl'), ...);

// emit_latex.js:156-166 — the identity is made to close
    const steadyBr = med(runs.map((r) => r.block_rate_per_s).filter((x) => x != null));
    const totalBr  = med(runs.map((r) => r.block_rate_per_s_total_window).filter((x) => x != null));
    // E2: block_rate must share tx_per_block's basis or the identity cannot
    // close. tx_per_block is committed/blocks over the WHOLE run, so the
    ...
    const br = P(`T9.${c}.block_rate_per_s`, f(useTotal ? totalBr : steadyBr, 2), op,
                 `runs[condition=${c}].${useTotal ? 'block_rate_per_s_total_window' : 'block_rate_per_s'} ...`,
                 'TOTAL-window basis, to match tx_per_block (whole-run)');
    P(`T9.${c}.block_rate_steady_NOT_EMITTED`, f(steadyBr, 2), op, ...);
```

And the supporting function in `steady.js`:

```js
/* Whole-run throughput, the basis that block_rate x tx_per_block actually
 * closes against (amendment E2). committed / (last committed - first committed)
 * across the entire run, warm-up and drain included, because height_delta counts
 * every block the run produced. */
function computeTotalWindow(jsonlPath) { ... }
```

The emitted fragment carries the column and the identity closes — e.g. the
provenance row: `3.29 tx/block × 3.63 blocks/s = 11.94 ≈ 11.97` total-window TPS,
against 11.68 steady TPS. The caption clause emitted with it says so directly.

### E3 — corrected Phase 4 steady TPS, three columns: **DONE**

`results/latex_fragments/phase4_throughput_threeway_body.tex`, emitted
2026-08-10 22:17:19, produced by `emit_latex.js:337-354`:

| W | Manifest figure | Previous `analyze.js` figure | **Corrected (E1)** | count | window (s) |
|---|---|---|---|---|---|
| 1 | 2.32 | 2.32 | **2.32** | 94 | 40.5 |
| 5 | 8.39 | 8.28 | **8.27** | 469 | 56.6 |
| 10 | 13.93 | 13.79 | **13.66** | 438 | 32.3 |
| 20 | 13.30 | 12.76 | **12.73** | 414 | 33.5 |
| 50 | 12.10 | 11.78 | **11.75** | 1747 | 148.7 |
| 100 | 13.25 | 12.48 | **12.47** | 1695 | 135.6 |
| 200 | 15.05 | 13.25 | **13.24** | 1531 | 115.6 |
| 400 | 23.34 | 17.05 | **17.44** | 1184 | 68.0 |

The manifest figure is the most inflated at every level; the gap widens with W
(+34% at W=400) exactly as the `steady.js` header predicts. At W=400 the
corrected figure is slightly *above* the previous `analyze.js` figure
(17.44 vs 17.05) — the only level where that happens, and worth a sentence when
Phase 4's report is updated.

**`PHASE_4_REPORT.md` still says "Amendments in force: A1–A5" and does not
mention E1/E2/E3.** The corrected numbers exist only as a LaTeX fragment.

---

## S5. Fragment state

All fragments live in `results/latex_fragments/`. Reference times:

- `steady.js` written **22:15:31.314**
- `emit_latex.js` written **22:17:18.567**

| File | Modified | Relative to E1/E2 | Stale? |
|---|---|---|---|
| `table8_body.tex` | 2026-08-10 22:17:18.968 | **after** | no |
| `table8_body.txt` | 22:17:18.969 | after | no |
| `table9_body.tex` | 22:17:19.174 | after | no |
| `table9_body.txt` | 22:17:19.175 | after | no |
| `table9h_failures_body.tex` | 22:17:19.176 | after | no |
| `table9h_failures_body.txt` | 22:17:19.176 | after | no |
| `phase4_throughput_threeway_body.tex` | 22:17:19.464 | after | no |
| `phase4_throughput_threeway_body.txt` | 22:17:19.465 | after | no |
| `figure4_pgfplots.tex` | 22:17:19.732 | after | no |
| `figure4_pgfplots.txt` | 22:17:19.732 | after | no |
| `table6_body.tex` | 22:17:19.789 | after | no |
| `table6_body.txt` | 22:17:19.789 | after | no |
| `table7_body.tex` | 22:17:19.978 | after | no |
| `table7_body.txt` | 22:17:20.006 | after | no |
| `table7_caption_clause.tex` | 22:17:20.006 | after | no |

**Every one of the 15 fragments was emitted after both E1 and E2 landed**, in a
single `emit_latex.js` run spanning 22:17:18.968 → 22:17:20.006. **Nothing is
stale. Nothing needs re-emitting.** Not re-emitted here in any case.

---

## S6. Paper file state

### Location

**Not `~/Downloads/main.tex`.** That file (2026-07-11, 51 KB) is a different,
older manuscript and contains no `3.1.4` token at all. The live paper is:

```
Downloads/Smart_Cities_journal__Raddad_ (1)/main.tex
```

- **Modified:** 2026-08-10 20:22:04 local (119,546 bytes)
- **Backups, both in the same directory:**
  - `main.tex.backup-20260804-214913` (117,481 bytes)
  - `main.tex.backup-20260804-220112` (119,567 bytes)
- Further copies exist in `~/.local/share/Trash/files/` and in
  `Smart_Cities_journal__Raddad_ (1).zip` (2026-08-03).

**Not edited by this assessment.**

### Fabric version strings, with sections — V1–V5

Diffing the current file against `main.tex.backup-20260804-220112` yields
**exactly six changed hunks, all of them version or footnote work.** Nothing
else in the manuscript has moved since 2026-08-04.

| Line | Section | Text | V-state |
|---|---|---|---|
| 137 | title footnote | *(no version token)* | ✅ |
| 140–141 | **abstract** | "a unified Hyperledger Fabric chaincode" — **version token removed** (was `Fabric~v3.1.4`) | ✅ **V5** |
| 186 | **1.2 contribution 5** | "Chaincode-as-a-Service deployment on Hyperledger Fabric" — **token removed** (was `Fabric~v3.1.4`) | ✅ **V5** |
| 282 | **3.1 Design Rationale** | "the underlying Hyperledger Fabric~**v3.1.4** infrastructure" | ✅ **V1** |
| 326 | **Figure 1 TikZ bar** | `{\textbf{Hyperledger Fabric v3.1.4}\quad` | ✅ **V2** |
| 365 | 3.2 Threat Model | "Fabric~v3 offers a Byzantine fault tolerant…" — major only, no patch token | ✅ acceptable |
| 696 | **4.4 Distributed Four-Org Testbed** | "Fabric\,**v3.1.4** binaries" | ✅ **V3** |
| 704–706 | **Section 5 opening** | "those benchmarks target Fabric~**2.5** and the implementation … runs on the Fabric~**3.1** releases stated in Section~\ref{sec:eval_setup}" | ⚠️ see below |
| 714–715 | **5.1 Experimental Setup** | "the single-host testbed runs Fabric~**v3.1.0** and the distributed four-organization testbed runs Fabric~**v3.1.4**" | ✅ **V4 / V7** |

Each of `v3.1.0` and `v3.1.4` appears **exactly once** in Section 5.1. No
version token appears in the abstract or in contribution 5.

### V6 — landed ✅

Before (backup): *"Methodology follows the conventions of the Hyperledger
Foundation reference benchmarks~\cite{b24}, although the implementation targets
Fabric v3.1.4."*

Now (line 703–706): *"…Methodology follows the conventions of the Hyperledger
Foundation reference benchmarks~\cite{b24}, although those benchmarks target
Fabric~2.5 and the implementation evaluated here runs on the Fabric~3.1
releases stated in Section~\ref{sec:eval_setup}."*

It names Fabric 2.5 and refers to Section 5.1 (`sec:eval_setup`), as V6 asked.

### V7 — landed ✅

Section 5.1 now opens with the two-testbed sentence at lines 713–715, naming
both releases once each and stating that both compile the same chaincode source
revision.

### V8 — landed ✅

The primary-testbed sentence read *"running a two-organization **Fabric~v3.1.0**
network via CCAAS"*; it now reads *"running a two-organization network via
CCAAS"*. The duplicated version is gone. The stale
`% TODO(phase8): verify single-host Fabric version before submission` comment
was removed in the same hunk.

### ⚠️ V5 and V6 are in direct conflict

V5 requires **no version token in the two Section 5 opening sentences**. V6
requires the Hyperledger Foundation benchmarks sentence — which *is* one of
those two sentences — to **name Fabric 2.5**. Both cannot hold. What is on disk
satisfies V6. Flagged, not touched. See §8.

### Section 5.5.1 methodology paragraph — **ORIGINAL, unchanged** ✅

`\subsubsection{Fault Model and Verification}` at line 874, body at line 875.
It appears in neither backup diff, so it is byte-identical to the 2026-08-04
state. First sentence, verbatim:

> A logical operation runs in a child process that a controller terminates with
> \texttt{SIGKILL}; progress markers are \texttt{fsync}'d before each step.

### Tables 6–11 and Figure 4 — **ORIGINAL published numbers, unchanged** ✅

None of them falls in any changed hunk. Table numbering by order of appearance;
one distinctive value from each:

| # | Label | Line | Distinctive value |
|---|---|---|---|
| **6** | `tab:write_latency` | 732 | Integrated Write **P50 = 53.5 ms** (mean 53.6, P95 61.6) |
| **7** | `tab:throughput` | 760 | Reputation (distinct actors) **303.6 TPS**, MVCC 0.0% |
| **8** | `tab:geo_write_latency` | 798 | Bridge **P95 = 481 ms**, failures **0/1,500** |
| **9** | `tab:geo_concurrent` | 837 | High-contention **1.51 TPS at 95.0% MVCC** |
| **10** | `tab:atomicity_baseline` | 884 | Throughput (c=20): Two-CC **76.9** vs Unified **145.1 TPS** |
| **11** | `tab:divergence` | 910 | Two-CC crash random seq: **665/2000 = 33.3% [31.2, 35.4]** |
| **Fig. 4** | `fig:scaling` | 859 | `\includegraphics{figures/scalability_chart_v5.pdf}`; body text plateau **31.2 to 32.1 TPS** |

Figure 4 is an included PDF, not inline numbers — nothing in `main.tex` could
have changed its values, and the referenced PDF is untouched.

### Title footnote and its `\ref` targets — **resolves** ✅

Line 137, now the single active `\firstnote` (the superseded draft and the
duplicate CCNC/CCWC note were both removed):

> This article is a substantially extended version of our conference
> papers~\cite{b12,b13}. The atomic provenance-to-reputation bridge, the
> four-organization physical testbed, and the fault-injection validation of
> Sections~\ref{sec:arch_bridge}, \ref{sec:impl_geo_testbed}, \ref{sec:eval_geo},
> and \ref{sec:eval_atomicity} are new to this work.

- `sec:arch_bridge` — 1 `\label` ✅
- `sec:impl_geo_testbed` — 1 `\label` ✅
- `sec:eval_geo` — 1 `\label` ✅
- `sec:eval_atomicity` — 1 `\label` ✅
- `\bibitem{b12}` and `\bibitem{b13}` both present ✅

Set-differencing every `\ref{...}` against every `\label{...}` in the file
returns **the empty set**: there are no undefined references anywhere in the
manuscript.

### Abstract word count

**193 words** (control sequences and math stripped).

---

## S7. Outstanding work ledger

| # | Item | State | Blocked on |
|---|---|---|---|
| 1 | **Phase 11 — C6 baseline arms (both)** | **NOT STARTED**, no data | Restarting the single-host network with `docker start` (§S3). ~10 min of trial time by the Phase 10 §5 estimate. |
| 2 | **Phase 11 — C7 naming** | Data exists as `D4_A_window_seq`, 500/500 divergent, complete | Decision: adopt D4 as C7, or re-run under the C7 label. Data is sound either way. |
| 3 | **PHASE_11_REPORT.md** | **NOT WRITTEN** | C6. Everything else is on disk and ready to write up. |
| 4 | Phase 11 — record the two harness defects | Fixed in code with comments at `run11.js:84-93` and `:131-138`; not yet written into any report | Item 3. Both belong in the paper's implementation-insights discussion. |
| 5 | Phase 11 — decide status of the v1 generations | P4 v1 and C5 v1 retained on disk, invalid, superseded | Item 3 — needs an explicit "reported and excluded" note, per the project's own precedent of never silently dropping runs. |
| 6 | **E1 — steady window in `analyze.js`** | **NOT applied.** Implemented as `steady.js`; the old definition still lives in `analyze.js` and still feeds `analysis.json` | Decision only: does E1 require `analyze.js` to change, or only a single authoritative implementation for emitted numbers? |
| 7 | **E2 — `total_window_tps`** | ✅ **DONE**, emitted, identity closes | — |
| 8 | **E3 — three-column Phase 4 table** | ✅ **DONE** as a fragment | Not yet folded into `PHASE_4_REPORT.md`, which still says "Amendments in force: A1–A5" |
| 9 | **Phase 9 — archive + consolidated report** | Not started; no `phase9*` directory exists | — |
| 9a | └ `REPORT.md` §8.4/8.5 correction | Pending, inside item 9 | Item 9 |
| 9b | └ Gate 0 harness-scope correction | Pending. `PHASE_10_ASSESSMENT.md:35-42` establishes Gate 0 searched `~/am-unified` only and missed `~/atomicity_comparison/harness/`; true as scoped, false as generalised | Item 9 |
| 9c | └ Phase 4 throughput correction | Numbers ready (E3, item 8); not yet in any report | Items 8 and 9 |
| 10 | **Phase 6 completion (6a rep 2 & 3, 6b, 6c)** | **INCOMPLETE.** 6a has 1 valid repetition of 3 (rep 2 fired the stop at tx 1000 instead of ~400 and is invalid); 6b has no data; 6c partial | **Four-node lab unreachable since 2026-08-10 ~21:50Z** |
| 11 | **Phase 5** | Not started | Lab reachability |
| 12 | **Gate M4** | Not started | Lab reachability |
| 13 | **Phase 7** | Not started; Phase 4 §9 records the 7b trigger branch was taken | Lab reachability |
| 14 | **Paper: apply the emitted fragments** | 15 fragments ready and current; **none applied** to `main.tex` | Decision on item 15 below |
| 15 | **Paper: Table 9 numeric discrepancy** | ⚠️ `table9_body.tex` reports **11.68 / 11.93 / 12.16 TPS**; the published Table 9 (`tab:geo_concurrent`) reports **29.95 / 29.90 / 29.35**. The emitter targets `phase3b-*`, which is the same distributed concurrent measurement. **No report on disk reconciles the ~2.5× gap.** | A decision, and probably an explanation, before any Table 9 edit. See §8. |
| 16 | **Paper: V5 vs V6 conflict** | Unresolved; disk satisfies V6 | Your call (§8) |
| 17 | **Paper: Phase 10 disclosure decision** | Options A/B/C/D laid out in `PHASE_10_ASSESSMENT.md §7`; **no option chosen**. Phase 11 has now partly overtaken it — the post-assertion binary shows 0/3,100 | Decision. Phase 11's completion changes the calculus and should be folded into the choice. |
| 18 | **`PHASE_10_ASSESSMENT.md §4` is now out of date** | It says Design A "is not currently deployed"; prov and rep CCAAS were deployed 2026-08-11T03:19–03:21Z | One-line correction when Phase 9 consolidates |

---

## S8. Contradictions against the context block, stated explicitly

**1. P2, P4 and all three C5 conditions were not still running — they finished.**
All five completed cleanly with `result.json` written, the last at
2026-08-11T04:34:42Z. The power loss was at 04:38:48Z.

**2. Nothing was in flight at the power loss, and nothing was truncated by it.**
Every truncation on disk (P2 attempt 1 at 75/500, C5 v1 matcert at 297/300,
C5 v1 print at 89/300) is an operator abort that preceded a deliberate re-run
with corrected harness code. The premise "a power loss mid-trial can leave a
trial with fsync'd markers but no ledger-walk classification" is sound in
general and did not occur here.

**3. ⚠️ WITHDRAWN — this item was wrong.** It read: *"C6 was not 'still running'
— it was never started."* C6 **was** running at the power loss. The claim was
inferred from the absence of files, which for a `bench.js` run proves nothing.
The context block was right and this assessment was wrong. See the correction at
the top and `PHASE_11_REPORT.md` §7.

**4. There is no condition labelled C7.** The Design A control is
`run_D4_A_window_seq_1786418704674`, internal label `D4_A_window_seq` — the
naming comes from Phase 10 Option D, not from the Phase 11 C-series. Its result
matches what the context claims (500/500 divergent, complete). But it ran at
~03:25Z, **before** every P11 condition, not after — so it is not a control
taken alongside them.

**5. P4 and C5 each have two generations, and the context describes only one.**
The first generation of both is invalid: the `random` kill delay was timed from
`spawn()` instead of from the `START` marker, so every kill landed inside child
startup. `500/500` (P4 v1) and `300/300` (C5 v1 delivery) `.prog` files are zero
bytes — not one transaction had begun. The corrected v2 runs are the usable
data. Anyone reading "P4 random, 500 trials" off a directory listing will pick
up the wrong run.

**6. P1's "500/500 NEITHER" holds only after a second correction.** The original
ledger walk classified P1 as **PARTIAL 500/500** — a total divergence result —
because `GetReputation` synthesises `{alpha:2, beta:2, totalEvents:0}` for a
never-rated actor, so the old predicate `(alpha>1 || beta>1)` was always true.
`reverify11.js` re-walked C1, P1 and P3 with `totalEvents > 0` and preserved the
originals as `result_ORIGINAL_BUGGY.json`. C1 and P3 were unchanged; **P1 flipped
from PARTIAL 500 to NEITHER 500.** The context reports the corrected value with
no indication that the headline result of that condition inverted.

**7. E1 was not applied to `analyze.js`.** It was implemented as a new module,
`steady.js`, whose header asserts "There is no second definition." The old
definition is still in `analyze.js:102-133`, still prints "Steady TPS" columns,
and its output is still consumed by `emit_latex.js:337` as the `tps_prev_analyze`
comparison column. Whether that discharges E1 is your call; I changed nothing.

**8. The V5 and V6 paper corrections contradict each other.** V5 forbids a
version token in the two Section 5 opening sentences; V6 requires the
Hyperledger Foundation benchmarks sentence — one of those two — to name Fabric
2.5. The file satisfies V6. One of the two instructions has to be withdrawn.

**9. The emitted Table 9 fragment is not a column addition — it is a wholesale
number change.** E2 was described as "a `total_window_tps` column in Table 9 so
`block_rate × tx_per_block` closes as an identity." The column is there and the
identity closes. But the fragment's throughput values (11.68 / 11.93 / 12.16 /
2.35 TPS) are roughly 2.5× *below* the published Table 9 (29.95 / 29.90 / 29.35
/ 1.51). The emitter reads `phase3b-*`, which measures the same distributed
concurrent workload. Nothing on disk explains the gap. Applying this fragment
would be a major result change, not a formatting fix, and it should not be
pasted until the discrepancy is understood.

**10. `PHASE_10_ASSESSMENT.md §4` is now stale.** It states Design A "is not
currently deployed". The prov and rep CCAAS containers were created on
2026-08-11 at 03:19:34Z and 03:21:17Z and served the D4 run.

**11. On the lab.** The four-node lab being unreachable since 2026-08-10 ~21:50Z
is consistent with everything on disk, and is **unrelated to the power loss**.
Phase 11 runs entirely on the single host. `PHASE_6_REPORT.md` independently
records the lab dropping at ~21:50Z "for the second time in this session".

---

## Recommended order of work — not begun

1. **Restart the single-host network with `docker start`, never `network.sh up`.**
   Start the three Fabric containers, then the three CAs, then the six CCAAS
   containers. This is the one step that everything else depends on, and the one
   step where a wrong command destroys the P1/P3/C5 ↔ C6 comparability
   established in §S3.
2. **Verify before running anything:** `peer channel getinfo mychannel` on both
   peers (heights agree), `peer lifecycle chaincode querycommitted` (unified,
   prov, rep all present at seq 1), and the unified binary sha256 against
   `41f333d6…`. Record the height — the number between 13,433 and now is
   permanently unrecoverable, so capture the new one.
3. **Run C6, both arms.** It is the only thing standing between here and a
   complete Phase 11, it is cheap (~10 min), and it must run on this deployment.
4. **Write `PHASE_11_REPORT.md`** — items 3, 4, 5 in §S7 together. All the
   inputs except C6 are already on disk.
5. **Settle E1 (§S7 item 6) and the V5/V6 conflict (item 16).** Both are
   one-decision items that unblock report and paper text.
6. **Investigate the Table 9 discrepancy (item 15) before applying any
   fragment.** Until it is explained, no fragment should go into `main.tex` —
   they were emitted as a set and Table 9 is part of it.
7. **Phase 9 archive and consolidated report** (items 9, 9a, 9b, 9c, 18), which
   is lab-independent and can proceed while the lab is down.
8. **When the lab returns:** Phase 6 completion, then Phase 5, Gate M4, Phase 7
   (items 10–13), in that order — Phase 6 has partial data going stale and one
   invalid repetition to redo.
9. **Paper edits last** (items 14, 16, 17), once 5, 6 and 7 have settled what
   the numbers and the disclosure actually are.
