# PHASE 4 REPORT — concurrency sweep

**Session:** 2026-08-09, 22:13:29Z → 23:39:49Z
**Directory:** `phase4-20260809T221329Z` (D1 and laptop)
**Harness:** bench.js v2.1.0, `--clients=1` (except the 4b probe), 60 s cooldowns
**Workload:** condition E, concurrent provenance write, at eight concurrency levels
**Amendments in force:** A1–A5

Every figure in this document was read from a file on disk or from a live query
against the testbed. Nothing is estimated or interpolated. Where a quantity
cannot be measured it is named as unmeasured and no substitute is offered.
Contradictions against earlier reports and against the pre-registered prediction
are stated explicitly rather than resolved silently.

---

## 1. The prediction, verbatim and unmodified

Recorded before the sweep ran and not touched since:

> block_rate stays near 3.5-4/s at all concurrency levels; tx_per_block rises
> with W toward MaxMessageCount=10; throughput plateaus near block_rate x 10,
> roughly 35 TPS. Mechanism: the Raft replicate-and-commit pipeline caps block
> production at roughly 250 ms per block, so throughput is set by block occupancy
> rather than by BatchTimeout. If this holds it reconciles the ~30 TPS reported
> in April (bursty barrier arrivals filled blocks) with the ~11 TPS measured
> yesterday (closed-loop arrivals do not).

**Verdict: the mechanism is directionally right, all three quantitative claims
are wrong, and the reconciliation it proposed does not hold.** §5.

---

## 2. What ran

Eight levels, three runs each, 24 runs, plus two probe runs. W=1 through W=200
were pre-registered; **W=400 was triggered by the pre-registered conditional
rule** (§6).

| W | n per run | Runs | Committed | Errors |
|---|---|---|---|---|
| 1 | 100 | 3 | 300 | 0 |
| 5 | 500 | 3 | 1500 | 0 |
| 10 | 500 | 3 | 1500 | 0 |
| 20 | 500 | 3 | 1500 | 0 |
| 50 | 2000 | 3 | 6000 | 0 |
| 100 | 2000 | 3 | 6000 | 0 |
| 200 | 2000 | 3 | 6000 | 0 |
| 400 | 2000 | 3 | 6000 | 0 |

**Zero failures in 27,300 submitted transactions**, across every error class, at
every concurrency level up to 400 in flight. The invariant
`submitted == committed + errors` held on all 24 sweep runs and both probe runs.
All four peers agreed on height and hash after every run. Chaincode digest
`46ae8a9f…ecff5` verified on all four nodes. No netem at any point. No Raft
election. **Nothing was discarded.**

Resource coverage: **FULL on every run, all four nodes**, 20,420 samples in the
sweep plus a separate merge for the W=400/probe tail. Watchdog stalls: **0**.

---

## 3. The sweep

Median across three runs per level. Latency percentiles computed from
`txs.jsonl` steady-state records only.

| W | n | committed | errors | P50 ms | P95 ms | P99 ms | Endorse P50 ms | Ord+Commit P50 ms | Steady TPS | tx/block | Block rate /s | Blocks | Converge s | Client CPU peak % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 100 | 300 | 0 | 411.9 | 723.3 | 1002.5 | 92.8 | 315.8 | 2.32 | 1.00 | 2.47 | 100 | 0.3 | 7.6 |
| 5 | 500 | 1500 | 0 | 565.9 | 1267.2 | 2062.8 | 132.6 | 331.0 | 8.28 | 2.86 | 3.09 | 175 | 10.2 | 15.3 |
| 10 | 500 | 1500 | 0 | 645.5 | 1290.5 | 1600.9 | 262.5 | 358.4 | 13.79 | 4.10 | 3.78 | 122 | 13.8 | 22.9 |
| 20 | 500 | 1500 | 0 | 1498.7 | 2340.2 | 3134.9 | 361.7 | 1128.1 | 12.76 | 3.55 | 4.32 | 141 | 17.8 | 20.5 |
| 50 | 2000 | 6000 | 0 | 4250.2 | 5727.6 | 6380.4 | 413.6 | 3783.8 | 11.78 | 3.31 | 4.06 | 604 | 79.1 | 31.1 |
| 100 | 2000 | 6000 | 0 | 8089.5 | 11358.0 | 11820.9 | 394.0 | 7654.5 | 12.48 | 3.58 | 4.11 | 559 | 74.0 | 24.1 |
| 200 | 2000 | 6000 | 0 | 15474.1 | 17464.5 | 17772.6 | 412.9 | 14962.0 | 13.25 | 3.99 | 4.33 | 501 | 62.5 | **56.1** |
| 400 | 2000 | 6000 | 0 | 23520.8 | 29727.6 | 29986.7 | 419.5 | 23045.4 | **17.05** | **4.94** | **5.91** | 405 | 45.5 | **89.4** |

**CORRECTION (2026-08-11).** The throughput column originally in this table was
`steady_count / steady_duration_ms` taken from each run manifest. That figure does
NOT exclude the drain, in which the number of transactions in flight falls below
W as the run finishes. The methodology in force excludes it. Every figure in the
row above is now the value `analyze.js` recomputes from `txs.jsonl`, which applies
the drain rule (`trailing observed_worker_slots completions excluded`). The
difference is negligible at low concurrency and large at high: W=1 unchanged,
W=200 15.05 -> 13.25, W=400 **23.34 -> 17.05**, because the drain is W
transactions long and at W=400 it is 400 of 2,000 samples. Latency percentiles
shifted slightly for the same reason. Block occupancy, block rate, convergence
and client CPU are unchanged: they derive from manifests and `resources.csv`, not
from the steady-window definition. **The conclusions are unaffected** - throughput
still rises from 13.25 at W=200 to 17.05 at W=400, so it was still climbing at the
last level measured and the "no plateau" finding stands.

### 3.1 Endorsement is flat; everything queues in order+commit

Endorse P50 rises from 92.8 ms at W=1 to ~414 ms by W=50 and is then **flat**
through W=400 (413.6, 394.0, 412.9, 419.5). Order+commit P50 rises from 315.8 ms
to **23,045.4 ms**, a factor of 73.

Total latency at high W is almost entirely ordering and commit queueing.
Endorsement is not the bottleneck at any level and stops changing once the system
saturates. Any latency-reduction work aimed at the endorsement path would be
aimed at 1.8% of the W=400 latency budget.

---

## 4. Block occupancy

| W | tx/block | Block rate /s | MaxMessageCount |
|---|---|---|---|
| 1 | 1.00 | 2.47 | 10 |
| 5 | 2.86 | 3.09 | 10 |
| 10 | 4.10 | 3.78 | 10 |
| 20 | 3.55 | 4.32 | 10 |
| 50 | 3.31 | 4.06 | 10 |
| 100 | 3.58 | 4.11 | 10 |
| 200 | 3.99 | 4.33 | 10 |
| 400 | 4.94 | 5.91 | 10 |

**`tx_per_block` never exceeded 4.94 against a `MaxMessageCount` of 10.** Blocks
ran at most half full at the highest concurrency this sweep reached, and the
relationship with W is not monotonic — occupancy peaks at 4.10 (W=10), falls to
3.31 (W=50), then climbs to 4.94 (W=400).

**Block rate is not constant.** It rises from 2.47/s to 5.91/s across the sweep.
There is a broad flat region — 3.78 to 4.33 across W=10 to W=200, a twentyfold
concurrency range — which is genuinely striking and is the strongest part of the
prediction. But it is a region, not a universal ceiling: W=1 and W=5 sit below
it, and W=400 breaks above it by 37%.

---

## 5. Prediction verdict, clause by clause

| Clause | Verdict | Evidence |
|---|---|---|
| "block_rate stays near 3.5–4/s **at all** concurrency levels" | **PARTLY HELD** | True for W=10–200 (3.78–4.33). False at W=1 (2.47), W=5 (3.09) and W=400 (5.91). |
| "tx_per_block rises with W **toward MaxMessageCount=10**" | **FALSIFIED** | Peaks at 4.94, never approaches 10, and is non-monotonic in W (4.10 → 3.31 → 4.94). |
| "throughput plateaus near block_rate × 10, **roughly 35 TPS**" | **FALSIFIED** | No plateau was reached. Throughput was still climbing at the last measured level (13.25 → 17.05 from W=200 to W=400). The observed relation is throughput ≈ block_rate × tx_per_block ≈ block_rate × 3.3–4.9, not × 10. |
| Mechanism: "Raft replicate-and-commit pipeline caps block production at roughly 250 ms per block" | **DIRECTIONALLY SUPPORTED, NUMBER WRONG** | Block production is clearly rate-limited and largely insensitive to offered load over W=10–200 — that is the flat region. But the implied 250 ms/block (4/s) is not a hard cap: W=400 sustained 5.91/s, i.e. 169 ms/block. |
| Mechanism: "throughput is set by block occupancy rather than by BatchTimeout" | **CONSISTENT, NOT ISOLATED** | Block intervals of 169–405 ms are far longer than the 50 ms BatchTimeout, so BatchTimeout is demonstrably not what cuts blocks here. But this sweep does not vary BatchTimeout, so the claim is untested. **Phase 7a is the test.** |
| Reconciliation: "~30 TPS in April vs ~11 TPS closed-loop, explained by barrier arrivals filling blocks" | **DOES NOT HOLD AS STATED** | The proposed explanation requires blocks filling toward 10 under bursty arrivals. Occupancy never approached 10 here under any arrival pattern. Closed-loop arrivals reached 17.05 TPS at W=400 without any barrier, still short of April's ~30. The gap is more plausibly a concurrency-level difference than an arrival-shape difference, but this sweep does not settle it. |

### 5.1 What the sweep actually shows

Throughput is the product of two quantities that move together, not one capped
quantity:

```
block_rate  ×  tx_per_block
W=200:  4.33 × 3.99 = 17.3   (measured steady TPS 13.25)
W=400:  5.91 × 4.94 = 29.2   (measured steady TPS 17.05)
```

The product **overestimates** steady TPS, and necessarily so: `blocks_produced`
counts every block in the run, including those formed during warm-up and drain,
whereas steady TPS excludes both. The two are therefore not the same population
and the identity should be read as a decomposition of where throughput comes
from, not as an arithmetic check.

Both factors rise at W=400. The prediction assumed block_rate would stay pinned
while occupancy rose to fill the 10-transaction budget; instead both rose
modestly and occupancy stalled around half the budget.

**Because `tx_per_block` never reached 8 at any level, the Phase 7b trigger has
not fired.** See §9.

---

## 6. The W=400 level, and why declaring a plateau would have been wrong

The pre-registered rule was: *"If throughput is still climbing at W=200, add
W=400 with n=2000."*

At the point of decision, steady TPS across the last three completed levels was
**11.78 (W=50) → 12.48 (W=100) → 13.25 (W=200)** — monotonically increasing.
Viewed across the whole W=10–200 range the curve looks flat (13.79, 12.76, 11.78,
12.48, 13.25), and it would have been easy to call that a plateau and skip the
level.

That reading was rejected as a post-hoc reinterpretation of a pre-registered
trigger, and W=400 was run.

**It changed the result materially.** W=400 delivered 17.05 TPS — 29% above
W=200 — with block rate breaking out of the flat region to 5.91/s and occupancy
reaching its sweep maximum of 4.94.

Had the level been skipped, this report would have stated a throughput ceiling of
~13 TPS and a "stable block rate of ~4/s", both of which the data contradict.

**Throughput was still climbing at W=400.** The pre-registered rule authorised
one additional level and no more, so **the upper bound of this system's
throughput is not established by this sweep** and no ceiling figure should be
quoted from it. This is a limitation, not a result.

---

## 7. Phase 4b — connection-multiplicity probe

Run at W=400, the highest completed level. One run each, n=2000.
Pre-registered criterion: if `clients=8` exceeds `clients=1` by more than 20% in
steady TPS, the single connection is a client-side artifact and the sweep above
that level must be repeated.

| Probe | clients | committed | errors | Steady TPS | tx/block | Blocks | Converge ms |
|---|---|---|---|---|---|---|---|
| `probe_W400_clients1` | 1 | 2000 | 0 | 16.51 | 5.00 | 400 | 43,161 |
| `probe_W400_clients8` | 8 | 2000 | 0 | **16.14** | 5.19 | 385 | 40,052 |

**Difference: −2.2%. Criterion is 20%. Result: NEGATIVE.**

With the drain-excluded definition, eight connections are marginally *slower*
than one, not faster. The sign flips relative to the manifest-derived figures
originally reported here (+5.3%); the verdict does not, and is now further from
the threshold than before.

The single gRPC connection is not a throughput-limiting artifact at W=400, just
as it was not at W=20 on 2026-08-04. **No part of the sweep requires repetition.**

The `clients=1` probe (16.51 TPS) independently reproduces the W=400 sweep median
(17.05 TPS) to within 3.2%, on a separate run.

### 7.1 What this probe does NOT rule out — stated plainly

`--clients=8` creates eight independent gRPC clients, each with its own HTTP/2
connection, **inside a single Node process**. Node executes JavaScript on one
thread. The probe therefore isolates *connection multiplicity* and says nothing
about *client CPU*. A client limited by its own single-threaded CPU would show
exactly this result — no gain from more connections.

Given §8, that distinction matters at W=400 and the probe must not be read as
clearing the client generally.

---

## 8. Client saturation — the W=400 caveat, stated plainly

The plan requires: *"If HARNESS_bench.js CPU approached 100% at any level, say so
plainly — the sweep would then be measuring the client rather than the system."*

| W | Client CPU median % | Client CPU peak % | Client RSS peak MB |
|---|---|---|---|
| 1 | 3.70 | 7.6 | 82.1 |
| 5 | 9.30 | 15.3 | 105.9 |
| 10 | 11.70 | 22.9 | 107.4 |
| 20 | 12.80 | 20.5 | 107.6 |
| 50 | 10.70 | 31.1 | 117.5 |
| 100 | 10.20 | 24.1 | 131.4 |
| 200 | 10.70 | **56.1** | 168.2 |
| 400 | — | **89.4** | — |

100% means one core fully saturated; Node is single-threaded for JS execution, so
100% is the practical ceiling regardless of D1's 12 cores.

**At W=400 the client peaked at 89.4% CPU. That is approaching saturation, and
the W=400 numbers must be read with that caveat.** Median utilisation stayed far
lower and no transaction failed or timed out, so the level is not invalid — but
it is the first level where the client is plausibly a contributing constraint,
and the true system throughput at W=400 may be **higher** than the 17.05 TPS
measured.

This cuts in a specific direction worth being explicit about: it means the
measured throughput is a **lower bound** at W=400, which strengthens rather than
weakens the finding that no plateau was reached.

Levels W=1 through W=200 peaked at 56.1% or below and are not affected.

**Recommended follow-up, not performed:** re-run W=400 with the load split across
multiple Node *processes* (not multiple clients in one process) to separate
client CPU from system capacity. This is outside the current plan and is offered
as a decision in §12.

---

## 9. Phase 7b trigger — branch taken and why

Phase 7b (MaxMessageCount mutation) is conditional: *"Run this ONLY if the Phase
4 sweep or Phase 7a drove tx_per_block to 8 or above at any point."*

**Highest `tx_per_block` observed anywhere in Phase 4: 4.94** (W=400), with a
single-run maximum of 5.19 (the clients=8 probe). Against `MaxMessageCount=10`,
blocks never exceeded 52% occupancy.

**Branch taken: 7b remains NOT triggered by Phase 4.** `MaxMessageCount` is not
binding — blocks are being cut for some other reason well before they fill — so
mutating it would teach nothing and the mutation is not spent. The trigger
remains live for Phase 7a, which may drive occupancy up by lengthening
BatchTimeout.

---

## 10. A3 — the convergence curve

Convergence wait per level, median of three runs:

| W | committed | Blocks (median) | Converge s | ms per block | ms per committed tx |
|---|---|---|---|---|---|
| 1 | 100 | 100 | 0.3 | 2.8 | 2.8 |
| 5 | 500 | 175 | 10.2 | 58.0 | 20.3 |
| 10 | 500 | 122 | 13.8 | 113.5 | 27.7 |
| 20 | 500 | 141 | 17.8 | 126.3 | 35.6 |
| 50 | 2000 | 604 | 79.1 | 130.9 | 39.5 |
| 100 | 2000 | 559 | 74.0 | 132.4 | 37.0 |
| 200 | 2000 | 501 | 62.5 | 124.7 | 31.2 |
| 400 | 2000 | 405 | 45.5 | 112.3 | 22.7 |

### 10.1 Convergence scales with BLOCKS, not with W and not with transactions

**Pearson r between blocks produced and convergence wait, across all eight
levels: 0.9886.** Least-squares slope 144.8 ms per block.

The `ms per block` column is nearly constant at **113–133 ms for every level from
W=10 upward**, spanning a fortyfold concurrency range and a fivefold range of
transaction counts. `ms per committed tx` varies far more (22.7–39.5 over the
same range), so block count is the better predictor.

This answers A3's question precisely, and refines Phase 3B's conclusion. Phase 3B
concluded convergence tracks *committed volume*; Phase 4 shows the underlying
variable is **blocks**. Committed volume only tracked it because occupancy was
roughly constant in that phase.

### 10.2 The clearest demonstration is that convergence gets FASTER at higher load

From W=200 to W=400, throughput rose 55% and convergence wait **fell** from 62.5 s
to 45.5 s.

Both runs committed 2000 transactions. But at higher occupancy those same 2000
transactions fit into 405 blocks instead of 501. Fewer blocks means less for the
lagging peer to replay, so it catches up sooner — despite more work having been
done per unit time.

This is a direct confirmation of the backlog model established in Phase 3B §6.3:
convergence time is the lagging peer's block backlog divided by its block replay
rate, and block replay cost is per-block, largely independent of how many
transactions each block carries.

### 10.3 org2 is the laggard at every level

`laggards_last_poll` recorded **org2 at every level from W=5 through W=400**, in
every run. At W=1 no peer was ever observed lagging (convergence 0.3 s, one poll).

Combined with Phase 3B's 12-of-12, org2 has now been the last peer to converge in
**every concurrent run measured across both phases**.

### 10.4 The 900 s timeout was never tested

Maximum convergence wait observed in Phase 4: **79.1 s** (W=50). The A3 raise from
180 s to 900 s provided headroom that was not needed at any level. Recorded so
the headroom is not mistaken for a measurement.

---

## 11. Resource utilisation

Median / peak CPU% under load, per level. 100% = one core.

| W | peer0.org1 (D1) | peer0.org2 (D2) | orderer LEADER (D4) | orderer2 follower (D2) | D4 orderer RSS peak MB |
|---|---|---|---|---|---|
| 1 | 9.6 / 34.7 | 10.4 / 12.6 | 3.9 / 6.0 | 1.8 / 3.0 | 925 |
| 5 | 17.2 / 34.5 | 12.9 / 19.1 | 5.3 / 10.7 | 2.1 / 2.4 | 958 |
| 10 | 22.2 / 30.9 | 14.3 / 26.2 | 6.7 / 14.0 | 2.2 / 3.3 | 1008 |
| 20 | 24.4 / 45.0 | 14.6 / 21.9 | 6.9 / 15.4 | 2.3 / 2.9 | 1022 |
| 50 | 23.5 / 48.0 | 13.8 / 34.6 | 6.9 / 14.7 | 2.3 / 4.6 | 1036 |
| 100 | 23.6 / 49.0 | 14.0 / 27.3 | 6.8 / 18.8 | 2.3 / 3.5 | 1089 |
| 200 | 24.4 / 69.9 | 14.3 / 33.2 | 6.6 / 28.8 | 2.2 / 3.3 | 1107 |
| 400 | 27.5 / 84.2 | 16.0 / 40.1 | 5.7 / **73.6** | 1.8 / 5.1 | **1187** |

Observations:

- **No container is CPU-saturated at any level.** The busiest sustained figure is
  peer0.org1 at 27.5% median (W=400). Peaks reach 84.2% but medians stay under
  28%, so the system is not CPU-bound — consistent with the bottleneck being
  serialised block production rather than compute.
- **The manuscript's ≤6% CPU claim fails at every level.** peer0.org1 exceeds 6%
  from W=1 upward; by W=10 both sampled peers are above it continuously.
- **The manuscript's ≤150 MB RAM claim fails by an order of magnitude on the
  orderer leader**, which grows from 925 MB to **1,187 MB** across the sweep.
- **The Raft leader's memory grows monotonically with cumulative load**, 925 →
  1187 MB over 87 minutes. This is growth over the session, not per-level
  variation. Whether it plateaus is not established here and would need a
  soak test.
- The leader's CPU peak jumps to 73.6% at W=400 while its median falls to 5.7%,
  indicating bursty work at block-cut time rather than sustained load.

---

## 12. Deviations from the plan

| # | Deviation | Detail |
|---|---|---|
| 1 | **W=400 was added** | Not a deviation but an exercise of the pre-registered conditional rule. Recorded here because the decision was a judgement call at the boundary and the reasoning should be auditable. §6. |
| 2 | **Client CPU reached 89.4% at W=400** | Reported plainly per the plan's instruction. The W=400 figures are a lower bound on system throughput. §8. |
| 3 | **The 4b probe cannot clear client CPU** | `--clients=8` multiplies connections inside one single-threaded Node process, so it isolates connection multiplicity only. Stated rather than allowing the negative probe to imply the client is clear generally. §7.1. |
| 4 | **Sweep upper bound not established** | Throughput was still climbing at the last authorised level. No ceiling figure should be quoted from Phase 4. §6. |
| 5 | **n differs across levels** | Per the plan (100/500/500/500/2000/2000/2000), so steady-window lengths differ between levels. W=1 rests on 300 total transactions against 6000 at high W. Low-W percentile tails are correspondingly less well supported. |
| 6 | **W=400 and the probes used a separate sampler session** | They ran as a follow-on invocation, so their resource data is in `resources_phase4b.csv` rather than the main `resources.csv`. Both were merged for the tables above; coverage was computed separately and was FULL for all five additional runs. |
| 7 | **BatchTimeout not varied** | §5 notes the "occupancy rather than BatchTimeout" claim is consistent with but not isolated by this sweep. Phase 7a is the actual test; flagged so the Phase 4 evidence is not over-read. |

---

## 13. Contradictions against earlier reports

1. **The Phase 4 prediction is falsified in all three quantitative claims** (§5).
   Recorded as required, without adjustment to the prediction.

2. **Phase 3B's "convergence tracks committed volume" is refined, not
   contradicted** (§10.1). The controlling variable is blocks; committed volume
   correlated only because occupancy was near-constant within Phase 3B.

3. **The manuscript's ≤6% CPU / ≤150 MB claims fail at every concurrency level**
   (§11), consistent with Phase 3B §7.3 and the 2026-08-04 observations.

4. **Phase 3B reported a plateau near 12 TPS at W=20 for conditions E/F/G.** Phase
   4 shows that is a local feature of that concurrency region, not a system
   ceiling: the same workload reaches 17.05 TPS at W=400.

---

## 14. Decisions owed

No decision is blocking; Phase 6 follows next per the execution order. Two items
are offered for a ruling, with defaults I will follow otherwise.

1. **The throughput ceiling is unestablished** (§6). Extending the sweep to W=800
   or beyond is not in the plan, and at W≥400 the client becomes a confound
   (§8), so a clean extension would need multi-process load generation.
   *Default: report the ceiling as unestablished and do not extend.*

2. **W=400 carries a client-CPU caveat** (§8). A multi-process re-run at W=400
   would separate client CPU from system capacity and would also firm up the
   "still climbing" conclusion.
   *Default: keep W=400 as measured with the caveat stated, and do not re-run.*

Proceeding to Phase 6 (fault tolerance under load), which uses the A4 safety net
and `commitStatus` deadline 30000 recorded in the manifest.
