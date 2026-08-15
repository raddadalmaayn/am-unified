# PHASE 11 REPORT — corrected Design B fault model, single-host testbed

**Session:** 2026-08-10 21:19Z → 04:38Z (power loss), resumed 2026-08-11 17:12Z → 17:26Z
**Data:** `atomicity_comparison/logs/run_P11_*`, `run_D4_*`
**Harness:** `run11.js` (Design B), `run.js` (Design A), `bench.js` (C6 baselines),
`reverify11.js`, `reverify_d4.js`, `reverify_pertrial.js`
**Deployment:** single-host 2-org, `mychannel`, Fabric v3.1.0, unified + prov + rep
all committed at sequence 1.

Every figure below was read from a file on disk or from a live query against the
ledger that produced it. Nothing is estimated, interpolated, or reconstructed
from memory. Where a result exists only as a transcript line with no surviving
artifact, it is marked as such and is **not** used as a result (§7).

---

## 1. Headline

**Design B: 0 divergences in 2,900 fault-injected trials, plus 200 no-fault
calibration trials. Design A: 500/500 divergent, twice, bracketing the Design B
conditions.** Both arms are classified by the **same ledger-only predicate**
(§4). The contrast is measured with one ruler.

| | Trials | Divergent | Rate | Rule-of-three UB | Wilson 95% UB |
|---|---|---|---|---|---|
| **Design B, fault-injected** | **2,900** | **0** | 0% | **0.1034%** | **0.1323%** |
| Design B, incl. no-fault calibration | 3,100 | 0 | 0% | 0.0968% | 0.1238% |
| **Design A, window seq (pre-C6)** | 500 | **500** | **100%** | — | — |
| **Design A, window seq (post-C6)** | 500 | **500** | **100%** | — | — |

---

## 2. What ran, per condition

`run11.js` writes `result.json` only on clean termination, so its absence is an
exact truncation marker. Trial counts below are `.prog` file counts, verified
equal to `len(result.json.records)` for every completed run.

| Cond | Directory | N | Trials | Termination | Status |
|---|---|---|---|---|---|
| C1 calibration | `run_P11_C1_calib_1786420116548` | 200 | 200 | clean | ✅ valid |
| P1 pre-endorse | `run_P11_P1_pre_1786420670477` | 500 | 500 | clean | ✅ valid |
| P2 post-endorse (att. 1) | `run_P11_P2_postendorse_1786420906988` | 500 | 75 | operator abort | ⛔ superseded |
| P2 post-endorse (att. 2) | `run_P11_P2_postendorse_1786421087319` | 500 | 500 | clean | ✅ valid |
| P3 post-submit | `run_P11_P3_postsubmit_1786420297369` | 500 | 500 | clean | ✅ valid |
| P4 random (v1) | `run_P11_P4_random_1786421518018` | 500 | 500 | clean | ⛔ **invalid**, §6.1 |
| P4 random (v2) | `run_P11_P4v2_random_1786421901120` | 500 | 500 | clean | ✅ valid |
| C5 MatCert (v1) | `run_P11_C5_matcert_1786421607648` | 300 | 297 | operator abort | ⛔ invalid + partial |
| C5 Print (v1) | `run_P11_C5_print_1786421653268` | 300 | 89 | operator abort | ⛔ invalid + partial |
| C5 Delivery (v1) | `run_P11_C5_delivery_1786421667849` | 300 | 300 | clean | ⛔ **invalid**, §6.1 |
| C5 MatCert (v2) | `run_P11_C5v2_matcert_1786422240462` | 300 | 300 | clean | ✅ valid |
| C5 Print (v2) | `run_P11_C5v2_print_1786422446813` | 300 | 300 | clean | ✅ valid |
| C5 Delivery (v2) | `run_P11_C5v2_delivery_1786422651978` | 300 | 300 | clean | ✅ valid |
| C6 both arms (att. 1) | — | 500×2 | ~1,500 tx | **power loss** | ⛔ **lost**, §7 |
| C6 both arms (re-run) | `run_P11_C6_rerun_1786490203` | 500×2 | 500×2 | clean | ✅ valid |
| C7 / Design A control | `run_D4_A_window_seq_1786418704674` | 500 | 500 | clean | ✅ valid, §5 |
| C7b / Design A bracket | `run_P11_C7b_A_window_seq_postC6_1786490336410` | 500 | 500 | clean | ✅ valid, §5 |

### 2.1 Classifications

| Cond | Policy | killed | NEITHER | ALL_THREE | **PARTIAL** |
|---|---|---|---|---|---|
| C1 | none | 0/200 | 0 | 200 | **0** |
| P1 | `pre` (SIGKILL on START) | 500/500 | 500 | 0 | **0** |
| P2 | `postendorse` (on ENDORSE_DONE) | 500/500 | 500 | 0 | **0** |
| P3 | `postsubmit` (on SUBMIT_RETURNED) | 500/500 | 0 | 500 | **0** |
| P4 | `random` U[0,285] from START | 484/500 | 417 | 83 | **0** |
| C5 MatCert | `random`, MATERIAL_CERTIFICATION/compliance | 289/300 | 247 | 53 | **0** |
| C5 Print | `random`, PRINT_COMPLETION/quality | 284/300 | 233 | 67 | **0** |
| C5 Delivery | `random`, DELIVERY/delivery | 297/300 | 268 | 32 | **0** |

---

## 3. Why this phase exists, and what it establishes that 6,900 did not

The published Table 11 reports 0/6,900 for the unified design. That number is
larger than anything here. It is also, on its own evidence, **unable to show
that any trial entered the divergence window at all.** A fault model that kills
before the transaction starts produces "neither write present" forever and
reports zero divergences without ever testing the invariant.

Phase 11 fixes that by calibrating against the real phase boundaries first and
then killing at each of them deliberately:

- **C1** (no fault, N=200) established the transaction lifetime from `START`:
  675.3 ms per trial end-to-end, P95 285 ms for the transaction itself. All 200
  resolved `ALL_THREE` — the three-key walk sees a complete operation when
  nothing interferes. This is the positive control for the predicate.
- **P1** kills on `START`: 500/500 `NEITHER`. Nothing reached the ledger.
- **P2** kills on `ENDORSE_DONE`: 500/500 `NEITHER`. Endorsement alone commits
  nothing — the read-write set exists but was never ordered.
- **P3** kills on `SUBMIT_RETURNED`: **500/500 `ALL_THREE`**. This is the load-
  bearing condition. The client is dead, yet all three keys are present, because
  once the transaction is ordered the commit is Fabric's to finish, not the
  client's. **These 500 trials demonstrably entered and passed through the
  window.**
- **P4 / C5** kill at a uniform delay over the measured lifetime and produce the
  predicted *mix* — 417/83, 247/53, 233/67, 268/32 across NEITHER/ALL_THREE.
  A mix is the signature of a fault model that is actually sampling the whole
  window rather than one endpoint. **Never a proper subset.**

### 3.1 On the weaker bound, stated plainly

2,900 fault-injected trials give a rule-of-three upper bound of **0.1034%**,
against the published **0.0435%** at 6,900. The new bound is weaker by a factor
of 2.4, and that should be said in the manuscript without softening.

It is nonetheless worth more, for a reason that is about measurement rather than
arithmetic. The published bound is an upper bound on divergences *among trials
whose fault timing was never verified to intersect the window*. If a substantial
fraction of those 6,900 kills landed before the transaction began — which is
exactly the defect §6.1 documents in this phase's own first attempt, where
**500/500 and 300/300 trials produced no markers whatsoever** — then the
effective denominator for the invariant is smaller than 6,900 by an unknown
amount, and a bound computed on the nominal denominator overstates its own
resolution. A narrower interval around an unmeasured quantity is not more
informative than a wider interval around a measured one.

Phase 11's denominator is auditable: every trial's kill point is recorded, the
phase boundaries are calibrated, and P3 shows 500 trials that provably crossed
the commit boundary. **0.1034% is a bound on something that was actually
tested.**

---

## 4. D2 — the cross-arm predicate check

This was run before anything else in the resumed session, because a 100% vs 0%
contrast measured with two different rulers is not a contrast.

### 4.1 The two predicates, verbatim

**Design B** — `run11.js:112-148`. The file's own header states the rule:
"THE THREE KEYS (C4), read with existing read-only APIs, **never from a
marker**."

```js
      const raw = await integ.evaluateTransaction('GetPartTrustReport', op.opId);
      const r = JSON.parse(dec.decode(raw));
      evPresent   = Array.isArray(r.provenanceHistory) && r.provenanceHistory.length > 0;
      linkPresent = Array.isArray(r.linkedRatings) && r.linkedRatings.length > 0;
      ...
      const raw = await rep.evaluateTransaction('GetReputation', op.ratedActor, DIM);
      const s = JSON.parse(dec.decode(raw));
      accPresent = !!(s && s.totalEvents > 0);
      ...
    const n = [evPresent, linkPresent, accPresent].filter(Boolean).length;
    const cls = n === 0 ? 'NEITHER' : n === 3 ? 'ALL_THREE' : 'PARTIAL';
```

**Design A** — `run.js:170-181` (was `:154-165` before the `--rated-per-trial`
addition of §4.4), `MODE === 'twotx'`:

```js
      const repSubmitted = op.markers.includes('REP_SUBMIT');
      const repCommitted = op.markers.includes('REP_COMMITTED');
      if (last === 'ERROR') { cls = 'BIZ_ERROR'; repState = 'n/a'; }
      else if (repCommitted) { cls = provOnChain ? 'CONSISTENT' : 'BROKEN_PROV'; repState = 'committed'; }
      else if (repSubmitted) { cls = 'AMBIGUOUS'; repState = 'submitted_unknown'; }
      else { // rep provably never submitted
        repState = 'never_submitted';
        cls = provOnChain ? 'DIVERGENT' : 'CLEAN_ABORT';
      }
```

**They are not the same predicate, and they differ in kind.** Design B reads all
three presence facts from the ledger. Design A reads provenance from the ledger
(`prov:ReadAsset`) but infers reputation presence **from the worker's fsync'd
markers**. Design A also carries an `AMBIGUOUS` class, excluded rather than
counted divergent, which Design B has no analogue for.

### 4.2 Does the synthesised record apply to the standalone `rep` chaincode?

**Yes. Identically.** Queried against this live ledger:

```
rep:GetReputation("definitely_never_rated_actor_xyz","quality")
  -> {"alpha":2,"beta":2,"score":0.5,"totalEvents":0, ...}
```

The standalone `rep` chaincode synthesises the same `{alpha:2, beta:2,
totalEvents:0}` default as the unified one. **Design A was not immune to the bug
that inverted P1 — it merely never queried the accumulator.** Had `run.js` used
a naive ledger predicate (`alpha>1 || beta>1`), it would have read "reputation
present" for all 500 trials and reported **0/500 divergent**: the exact mirror of
P1's inversion, and it would have destroyed the paper's central claim in the
opposite direction.

Positive control, same query shape, on an actor that did commit a rating:

```
rep:GetReputation("p11c6tt_0","quality")
  -> {"alpha":2.659,"beta":2,"score":0.571,"totalEvents":1, ...}
```

`totalEvents` is the only field that discriminates, on the standalone chaincode
exactly as on the unified one. Verified in both directions before adoption.

### 4.3 Re-verification of the Design A control under the ledger ruler

`reverify_d4.js` re-classified `run_D4_A_window_seq` reading **both** halves from
the ledger:

```
[d2] accumulator d4_aws/quality: totalEvents=0 alpha=2 -> repPresent=false
[d2] ledger summary={"DIVERGENT":500} original={"DIVERGENT":500}
[d2] disagreements=0
```

Artifact: `run_D4_A_window_seq_1786418704674/result_D2_LEDGER_REVERIFY.json`.

**The verdict survives.** After 500 window-seq trials the shared accumulator
reads `totalEvents == 0` — not one rating ever committed — while
`prov:ReadAsset` succeeds on all 500 opIds.

### 4.4 The residual asymmetry, and how it was closed

`run.js` drove every trial against **one shared rated actor** (`--rated=d4_aws`),
whereas `run11.js` uses a per-trial actor. `GetRatingHistory`, which would give
per-trial rating lookup by `evidence=opId`, requires CouchDB rich queries and
this deployment is LevelDB:

```
Error: GET_QUERY_RESULT failed: ExecuteQuery not supported for leveldb
```

So §4.3's reputation half is an **aggregate** fact. It is sound — `totalEvents
== 0` entails reputation-absent for every trial individually — but it could not
localise a partial if one existed.

To close this, `run.js` gained an **opt-in, default-off** `--rated-per-trial=1`
flag (default behaviour byte-identical, so every pre-existing run reproduces),
and the Design A control was re-run under it as **C7b** (§5). `reverify_pertrial.js`
then applied the Design B rule per trial:

```
[d2b] predicate: prov:ReadAsset(opId) AND rep:GetReputation(`${opId}-actor`,dim).totalEvents>0
[d2b] ledger summary={"DIVERGENT":500} original={"DIVERGENT":500}
[d2b] DIVERGENT=500/500 disagreements=0
```

Artifact: `run_P11_C7b_A_window_seq_postC6_1786490336410/result_D2_PERTRIAL_LEDGER.json`.

**Both arms are now classified per trial, ledger-only, by the same rule.**
Design A 500/500; Design B 0/2,900.

---

## 5. C7 and C7b — the Design A controls

**Naming (D5).** There is no directory named C7. The pre-Phase-11 Design A
control is `run_D4_A_window_seq_1786418704674`, internal label
`D4_A_window_seq`, carried over from the Phase 10 Option D nomenclature. **It is
adopted as C7 and the directory is not relabelled.**

**Disclosure (D5).** C7 ran at **2026-08-11T03:25Z, before every Phase 11
Design B condition, not alongside them.** The `prov` and `rep` CCAAS containers
were created at 03:19:34Z and 03:21:17Z, minutes earlier, on the same
`mychannel` and the same unified deployment. Sequence:

| Time (UTC) | Event |
|---|---|
| 2026-08-10T03:57:20Z | `unified` CCAAS container started — **one unbroken lifetime from here** |
| 2026-08-11T03:19:34Z | `prov` CCAAS created |
| 2026-08-11T03:21:17Z | `rep` CCAAS created |
| ~03:25Z | **C7** Design A control, 500/500 divergent |
| 03:48Z–04:34Z | C1, P1, P2, P3, P4, C5 — all Design B conditions |
| 04:35:23Z–04:38:48Z | C6 attempt 1, killed by power loss (§7) |
| 2026-08-11T17:12Z | network restarted with `docker start`; ledger intact, height 18,705, peers agree |
| 17:16Z | **C6 re-run**, both arms |
| 17:18Z–17:26Z | **C7b** Design A bracketing control, 500/500 divergent |

**C7b (W4) was run and is not optional.** Two reasons: it closes §4.4's
per-trial asymmetry, and it brackets the Design B conditions rather than only
preceding them, so a drift in deployment behaviour across the session would show
up as a difference between C7 and C7b. There is none — both are 500/500.

---

## 6. Reported and excluded — the invalid first generations (D6)

Nothing here was deleted. Every run named below is on disk and can be inspected.

### 6.1 P4 v1 and C5 v1 — the `random` kill timed from the wrong origin

`run11.js:84-93` records the defect in the code itself:

> **DEFECT FIX (2026-08-11):** the delay must be measured from START, not from
> spawn(). A Node child needs roughly 450 ms to boot and connect its gateway
> before it writes START, whereas C1 characterised the transaction lifetime
> (P95 285 ms) FROM START. Timing the delay from spawn therefore placed every
> kill inside process startup: the first attempt returned NEITHER 500/500 with
> NO MARKERS AT ALL in any trial, i.e. not one transaction had begun when it was
> killed. Arm on START, then apply the random delay, so the kill is uniform over
> the interval C1 measured.

The evidence is direct and countable — zero-byte `.prog` files, meaning the
worker was killed before it wrote even its first marker:

| Run | Trials | Zero-byte `.prog` | Verdict |
|---|---|---|---|
| `run_P11_P4_random_1786421518018` | 500 | **500** | invalid |
| `run_P11_C5_delivery_1786421667849` | 300 | **300** | invalid |
| `run_P11_C5_matcert_1786421607648` | 297 | 296 | invalid + partial |
| `run_P11_C5_print_1786421653268` | 89 | 88 | invalid + partial |

All four returned `NEITHER` for essentially every trial and therefore **0
divergences** — a clean-looking result produced by a fault model that never
touched the system under test. Corrected runs (`P4v2`, `C5v2_*`) show 0 empty
markers and the predicted NEITHER/ALL_THREE mix.

**This is the implementation insight the paper should carry:** a fault-injection
harness that reports zero divergences is not thereby working. The failure mode
is silent and it flatters the hypothesis. The only reason it was caught is that
the *shape* of the result was wrong — 500/500 at one endpoint where a mix was
predicted. A phase that had not predicted the distribution in advance would have
banked the number.

### 6.2 P1 — the predicate inversion

P1's original ledger walk classified **`PARTIAL` 500/500** — a total-divergence
result that, taken at face value, would have refuted the paper's central claim.

Cause, recorded at `run11.js:131-138`:

> **DEFECT FIX (2026-08-11):** GetReputation SYNTHESISES a default record for an
> actor that has never been rated — `{alpha:2, beta:2, totalEvents:0}`. The
> previous predicate (`alpha>1 || beta>1`) was therefore ALWAYS true, so the
> accumulator always read "present" and NEITHER could never be returned. P1
> (kill before endorsement, nothing written) was misreported as PARTIAL 500/500.
> `totalEvents` is the only field that discriminates: 0 for a never-rated actor,
> >=1 once a rating commits. Verified in both directions against the live ledger
> before adopting.

`reverify11.js` re-walked C1, P1 and P3 under the corrected predicate and
preserved the originals:

| Cond | Before | After | Original preserved as |
|---|---|---|---|
| C1 | `ALL_THREE` 200 | `ALL_THREE` 200 (unchanged) | `result_ORIGINAL_BUGGY.json` |
| **P1** | **`PARTIAL` 500** | **`NEITHER` 500** | `result_ORIGINAL_BUGGY.json` |
| P3 | `ALL_THREE` 500 | `ALL_THREE` 500 (unchanged) | `result_ORIGINAL_BUGGY.json` |

That C1 and P3 were unchanged is itself informative: the bug could only ever
manifest where the true answer was "nothing present", which is precisely the P1
condition. The `_reverified` block in each `result.json` records the reason, the
before/after summaries, and the timestamp.

**Second insight for the paper, and the sharper of the two:** a chaincode
read-only API that synthesises a plausible default for a missing key is a trap
for any external verifier. It cannot be distinguished from a real record by
shape — only by a field that happens to encode "how many times was this
written". §4.2 shows the same trap exists in the standalone `rep` chaincode, so
this is a property of the reputation design, not a slip in one contract.

---

## 7. C6 — the run lost to the power failure, and its replacement

**The first C6 attempt ran and was destroyed.** It is recoverable only as a
narrative, so it is reported here and used for nothing.

`p11_final.sh` directed both arms' output to `/tmp`:

```sh
node bench.js --mode=unified --n=500 --conc=20 --rated=p11c6uni > /tmp/p11_c6_unified.json
node bench.js --mode=twotx   --n=500 --conc=20 --rated=p11c6tt  > /tmp/p11_c6_twotx.json
```

`/tmp` was cleared by the reboot. Both files are gone, as is `/tmp/p11_final.log`.

What survives is the `rep` chaincode's own container log, which was never in
`/tmp`. It shows the Design A arm reaching the chaincode:

- 1,000 distinct rated actors, `p11c6tt_0..499` (sequential) and
  `p11c6tt_c_0..499` (concurrent), between **04:35:23.749Z and 04:36:37.360Z**.
- The Design B arm left no trace in the `unified` container log, which does not
  emit the per-rating debug block the standalone `rep` chaincode does.

The Design B arm **had** completed — a task notification at 04:35:23Z carried its
summary line: `unified seq mean=68.5 p50=66 p95=83 | conc TPS=103.1 mvcc=0/500`.
**Those figures have no artifact and are not used.** The Design A arm produced no
summary at all.

**Both arms were therefore re-run in full** into a durable directory, per the
Phase 3B precedent (DR1/DR2: re-run, new directory, nothing deleted), with fresh
rated-actor labels (`p11c6uni_r2`, `p11c6tt_r2`) so no pre-existing accumulator
state could contaminate the baseline.

### 7.1 C6 results — `run_P11_C6_rerun_1786490203`

| Metric | Design A (twotx) | **Design B (unified)** | Ratio |
|---|---|---|---|
| Invokes per logical tx | 2 | **1** | — |
| Sequential mean | 77.28 ms | **42.71 ms** | **1.81×** |
| Sequential P50 | 74 ms | **40 ms** | 1.85× |
| Sequential P95 | 94 ms | **58 ms** | 1.62× |
| Concurrent TPS (c=20) | 159.77 | **303.95** | **1.90×** |
| MVCC conflicts | 0/500 | 0/500 | — |
| Committed | 498/500 (2 `other`) | 500/500 | — |

**The architectural result reproduces.** Published Table 10 reports ~1.9× on
both axes (206.4→109.8 ms; 76.9→145.1 TPS); this re-run gives **1.81× and
1.90×**. The unified design remains faster, not slower, than the two-chaincode
alternative: atomicity here costs nothing because it removes an ordering and
commit round rather than adding coordination.

**Absolute values differ from Table 10 and should not be compared to it.**
Table 10 was measured through the fault-injection harness — a child process and
a fresh gateway connection per operation — which the manuscript already states
at §5.5.2. `bench.js` reuses one gateway. The meaningful quantity across both is
the ratio, and it holds.

**They also differ from the lost run's transcript figures** (68.5 ms / 103.1 TPS
for Design B, against 42.7 ms / 304.0 TPS here). The lost figures are
unverifiable and no explanation is offered for the gap; the machine had been
running conditions continuously for ~50 minutes at that point and had just been
rebooted before the re-run, but that is a hypothesis, not a measurement. **The
re-run is authoritative because it is the one with an artifact.**

### 7.2 Ledger-size caveat, stated because it is not negligible

C6 and C7b ran at a materially larger ledger than the Design B conditions:

| Checkpoint | Height | `counted_keys` |
|---|---|---|
| Before Phase 11 (2026-08-10T20:55Z) | 13,433 | 67,587 |
| At restart, before C6 (2026-08-11T17:13Z) | **18,705** | **76,415** |
| After C6 + C7b (2026-08-11T17:23Z) | **20,915** | **79,415** |

Phase 8 established that single-host *concurrent* throughput falls as state
grows. C6's baselines are therefore taken at a disadvantage relative to any
earlier absolute number, which strengthens rather than weakens the 1.90×
finding — both arms paid the same cost. It does mean C6's absolute TPS should
not be compared across phases.

---

## 8. Deployment integrity

The comparison requires all conditions on one deployment. That held, and the
power loss did not break it.

- `peer0org1_unified_ccaas` ran from **2026-08-10T03:57:20Z** to the power loss
  at **04:38:48Z** as a single container instance, spanning Phase 8, Phase 4 and
  every Phase 11 Design B condition. It was never redeployed.
- The network was restored with **`docker start` on the existing containers**.
  `network.sh up` was not run and must not be: it would recreate volumes and
  reset the ledger.
- After restart, both peers report identical height and block hash (18,705,
  `ZJt1LwS0sTUDP8emb7A+sWH5Oiv+HLqZuTeAvTi5I4E=`). **The ledger survived the
  power loss intact.**
- `querycommitted` on both orgs: `unified`, `prov`, `rep`, all version 1.0,
  **sequence 1**.
- `unified` binary digest verified inside both CCAAS containers:
  `41f333d6ffcab44b5d2c3f50fb2797ddd21a6093d9c0a17a9836033623029cbe` — matches
  the Phase 8 env snapshot. Source commit `9a9db0ef`, tree clean.
- `prov` and `rep` images are the **June builds** (`sha256:1639c1d98878…`,
  `sha256:3d85e16391a6…`, created 2026-06-22T20:15/20:16). **The asymmetry this
  implies is nominal, not real** — resolved 2026-08-11, see `PHASE_9_REPORT.md`
  §5.1. Neither `am-provenance` nor `am-reputation` has a commit after
  2026-02-06 / 2025-11-15 respectively, both contract sources are clean, and the
  predecessor assertion (`9a9db0e`) touched only `chaincode/unified/` in a
  different repository — neither prov nor rep source contains any lifecycle
  assertion in any revision. Design A ran code identical to its current source.
  **Nothing needs disclosing on this point.**

---

## 9. Deviations from plan

1. **C6 attempt 1 was lost entirely** to the power failure and re-run (§7).
   Only the re-run is reported.
2. **P4 and C5 were each run twice**; the first generation of both is invalid
   (§6.1). Only v2 is reported.
3. **P2 attempt 1 was aborted at 75/500** by the operator and re-run in full.
   Its 74 killed trials all carry the expected `START,ENDORSE_DONE` marker set;
   it was internally consistent, merely incomplete, and was not topped up.
4. **C7b was added** beyond the original matrix (§5), because D2 showed the
   original control could not be verified per trial.
5. `run.js` gained `--rated-per-trial` (opt-in, default off). No existing run's
   behaviour changed.

---

## 10. Contradictions against earlier reports

1. **`RECOVERY_STATUS.md` (2026-08-11) stated C6 was "NOT STARTED" and that
   "zero trials were truncated by the power loss". Both are wrong.** C6 attempt
   1 was running at the moment of failure. The error arose from inferring run
   state from the filesystem alone: `bench.js` writes nothing until it exits, so
   a run that dies mid-flight is indistinguishable from one never launched by
   directory listing. The `rep` container log — outside `/tmp` and outside the
   logs tree — was the only surviving evidence, and it was not consulted until
   the network was restarted. `RECOVERY_STATUS.md` has been corrected in place;
   see its §0.
2. **A session note claimed "3,200 Design B trials"** after C5 Delivery. The
   correct figure is **3,100** (200 + 500 + 500 + 500 + 500 + 900), of which
   **2,900** are fault-injected. An arithmetic slip, corrected here.
3. **`PHASE_10_ASSESSMENT.md` §4** states Design A "is not currently deployed".
   Superseded: `prov` and `rep` were deployed 2026-08-11T03:19–03:21Z and remain
   committed at sequence 1.

---

## 11. What Phase 11 does and does not settle

**Settles:**
- The unified design shows no divergence under a fault model that is
  *demonstrably* sampling the commit window, on the **post-assertion binary**.
- The two-chaincode design diverges in 100% of in-window faults, twice,
  bracketing the Design B conditions, under an identical ledger-only predicate.
- The 1.9× baseline performance advantage of the unified design reproduces.

**Does not settle:**
- The published **0.0435%** bound. Phase 11 reaches 0.1034% and cannot reach the
  published resolution without ~6,900 trials (§3.1).
- ~~The **binary asymmetry**~~ — **RESOLVED 2026-08-11**, moved out of this list.
  Design A's June builds are byte-for-byte current source; the assertion never
  applied to prov or rep. Phase 10 §8 question 3 is closed. See
  `PHASE_9_REPORT.md` §5.1.
- Whether Table 11 should be **replaced, supplemented, or annotated** with these
  numbers. That is a manuscript decision, not a measurement.
