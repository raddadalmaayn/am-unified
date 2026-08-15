# Distributed Benchmark Rebuild — REPORT

**Session:** 2026-08-04
**Testbed:** 4-org Hyperledger Fabric, `amchannel`, D1–D4 on the lab subnet
**Status:** Phases 0, 1, 2 and the connection-multiplicity probe complete.
Phase 3 running.

Sections are appended as each phase completes, so that whatever finished is banked
if the session ends.

---

## 1. Phase 0 findings and contradictions against the stated context

Full detail in `phase0-20260804T202038Z/GATE0_REPORT.md`. Summary:

**GATE 0: PASS.** Peers agreed on height (17664, identical hash on all four),
three consenters active, chaincode matched `9a9db0e`, endorsement policy MAJORITY,
no netem on any node.

### 1.1 Correction item for the manuscript: Fabric version

| Stated | Measured |
|---|---|
| Hyperledger Fabric **v3.1.0** | **v3.1.4** |

`peer version` and `orderer version` both report v3.1.4 on every node. Image
digests, identical across nodes: peer `sha256:222c37c35011fca3b10d7dddc031804fb3b478c117173a78e2fd6535726df16a`,
orderer `sha256:5cf04c3399a0b9a374840d51e09c0a0fce5ef8d8a59dc8fd24ec999d37b4c7f8`.

**Manuscript locations claiming v3.1.0 that require correction:**

| Section | Context |
|---|---|
| §3.1 Design Rationale | "the underlying Hyperledger Fabric~v3.1.0 infrastructure" |
| §3.1 Figure 1 (TikZ source) | infra bar label "Hyperledger Fabric v3.1.0" |
| §4.2 CCAAS Deployment | "a two-organization Fabric~v3.1.0 network via CCAAS" |
| §4.4 Distributed testbed | v3.1.0 in the deployment description |
| §5.1 Experimental Setup | "running a two-organization Fabric~v3.1.0 network" |
| §1.2 Contributions | "end-to-end Chaincode-as-a-Service deployment on Hyperledger Fabric~v3.1.0" |
| Abstract | Fabric version claim |

The single-host laptop network used for Tables 6 and 7 has **not** been version
checked; Phase 8 must capture it.

Per amendment D1, image **digests** rather than tags are recorded in every run
manifest, because `:latest` is not pinned. The D4 orderer carries tag `:latest`
while D2/D3 carry `:3.1.4`, but the digest is identical, so there is no skew.

### 1.2 Other Phase 0 disclosures

- **No Fabric CA container runs on any node.** Enrolled MSP material persists on
  disk, so nothing is blocked, but Figure 1 and §3.3 state each organization
  operates a Fabric CA and at runtime none does.
- **`peer0.org2.example.com` has been up since 2026-04-08**, against 2026-08-03 for
  every other container. Per amendment M3 it was **not** restarted. Its RSS
  (279 MB) sits between org1 (293 MB) and org4 (311 MB), so uptime has not
  confounded memory. Recorded as a disclosure.
- **No metrics provider is enabled on any orderer**, and D4's orderer has no
  operations endpoint at all, so Prometheus Raft metrics are unavailable.
  Participation is evidenced by `osnadmin` status plus independent heights.
- **`osnadmin` exists only on D1.**
- **The `peer` CLI on D1 is v2.5.15** against a v3.1.4 network. Amendment M4
  (prove the channel-update path) remains owed before Phase 7.
- **Total LevelDB key count is not obtainable read-only.** `ledgerutil` in this
  build exposes only `compare`, `identifytxs` and `verify`.

### 1.3 Network baseline (Phase 5 restoration target)

All pairs sub-millisecond, 0% loss, 100 packets each:

| src → dst | D1 | D2 | D3 | D4 |
|---|---|---|---|---|
| **D1** | — | 0.359 | 0.635 | 0.427 |
| **D2** | 0.350 | — | 0.499 | 0.371 |
| **D3** | 0.520 | 0.290 | — | 0.527 |
| **D4** | 0.436 | 0.282 | 0.531 | — |

Interfaces: D1 `enp4s0f0`, D2 `enp0s25`, D3 `eno1`, D4 `eno1`, all MTU 1500.
qdisc: default only (`mq`/`fq_codel`), no netem.

### 1.4 April benchmark files (amendment D2, no post-hoc exclusion)

**Four full-size April 20 runs exist. Three were published. No criterion was
stated for excluding the fourth, and the excluded run is not an outlier.**

| File (UTC) | prov_seq mean | conc_prov TPS | Published? |
|---|---|---|---|
| `…22-28-10-999Z` | 359.658 ms | 30.979 | **no** |
| `…22-49-35-257Z` | 358.280 ms | 30.686 | yes (`fix2/run1`) |
| `…23-06-08-151Z` | 369.926 ms | 28.908 | yes (`fix2/run2`) |
| `…23-22-41-037Z` | 371.650 ms | 29.946 | yes (`fix2/run3`) |

The excluded run's mean sits between run1 and run2 and its TPS is the highest of
the four. The August 3 full-size run (`…22-35-10-774Z`) is a **single** run.

For this session the only permitted exclusions are pre-registered: a run containing
a Raft election (Phase 5e), or a run violating
`submitted == committed + Σ errors`. Any other discarded run is still reported with
its data.

### 1.5 Fault-injection harness

> **⚠️ CORRECTED 2026-08-11 — see `PHASE_9_REPORT.md` §2.** The statement below
> is true as scoped (this repository) and **false as generalised**. The harness
> exists at `~/atomicity_comparison/harness/`, a sibling directory outside the
> searched repo, and implements every mechanism listed here as missing. The
> claims "Table 10's matrix has no reproducible harness" and "Phase 6 builds
> this from nothing" are both false. Phase 11 used it to run 2,900
> fault-injected trials on the current binary.

**It does not exist.** Repo-wide search for `SIGKILL`, `child_process`, `fork(`,
`docker stop`, `docker network disconnect`, `fsync` returns zero matches on D1 and
one match on the laptop (`scripts/deploy-4org.sh:35`, a teardown line).
`_fault_bench.js` matches **none** of `fault|kill|stop|crash|partition|inject`; it
is a copy of `geo_benchmark.js` with reduced counts. Table 10's matrix has no
reproducible harness. Phase 6 builds this from nothing.

---

## 2. The old load generator, and what replaced it

### 2.1 Old dispatch code, verbatim

From `geo_benchmark.js`, preserved on D1 as
`geo_benchmark_v1_wavebarrier.js.reference`:

```js
async function runConcurrent(total, concurrency, taskFn) {
    let successes = 0, mvccErrors = 0, failures = 0;
    const start = Date.now();
    for (let i = 0; i < total; i += concurrency) {
        const batchSize = Math.min(concurrency, total - i);
        const batch = Array.from({ length: batchSize }, (_, j) => taskFn(i + j));
        const settled = await Promise.allSettled(batch);
        for (const r of settled) {
            if (r.status === 'fulfilled') {
                successes++;
            } else {
                failures++;
                const msg = r.reason?.message || '';
                if (msg.includes('MVCC_READ_CONFLICT')) mvccErrors++;
                else if (!msg.includes('failed to endorse') && !msg.includes('ProposalResponsePayloads'))
                    console.error('\n  Error:', msg.slice(0, 120));
            }
        }
    }
    const totalMs = Date.now() - start;
    const tps      = successes / (totalMs / 1000);
    const mvccRate = ((mvccErrors / total) * 100).toFixed(1);
    return { tps, mvccRate, failures, totalMs };
}
```

**Dispatch pattern: wave barrier.** `await Promise.allSettled(batch)` blocks until
every transaction in a batch of `concurrency` settles before dispatching the next.
Offered load decays from W toward 1 within each wave and reaches zero at every wave
boundary. Reported throughput is therefore `W / (latency of the slowest transaction
in the wave)`.

Three further defects in the same function:

1. `failures` is a bare counter; only MVCC is separated, and anything matching
   `failed to endorse` or `ProposalResponsePayloads` is discarded unprinted. This
   is the mechanism behind the August run's 1,900 failures at a 35% MVCC rate with
   ~1,200 transactions in an uncounted bucket.
2. `mvccRate` divides by `total`, not by failures.
3. Nothing per-transaction is retained; no statistic is recomputable.

Separately, the old submit helpers called `newGatewayForUser()` **inside every
transaction**, putting identity file reads and private-key parsing on the measured
path.

### 2.2 What the new harness does differently

| File | Runs on | Purpose |
|---|---|---|
| `bench.js` v2.0.0 | D1 | Load generator, per-transaction capture, manifests |
| `analyze.js` | anywhere | Statistics, **reads only `txs.jsonl`** |
| `sampler.sh` | laptop | Resource sampling |
| `collect_env.sh` | laptop | Cross-node environment snapshot |
| `fabinfo.sh` | D1 | Ledger + orderer heights as JSON |

- **Fixed in-flight window.** W independent workers, each taking the next sequence
  number the instant its own transaction settles. No barrier. W=1 is the sequential
  case through the same code path.
- **Per-transaction JSONL**, 20 fields, `appendFileSync` every 100 lines and on
  exit, on ext4 (never tmpfs).
- **Phase split measured, not approximated**, via
  `newProposal → endorse → submit → getStatus` with `process.hrtime.bigint()`
  between each.
- **Ten-class error taxonomy**, no bare counters, `OTHER` carries the constructor
  name, invariant asserted per condition and re-checked independently by
  `analyze.js`.
- **Gateways built once** and reused.

### 2.3 Defects found and fixed during the build

| # | Defect | Consequence if unfixed | Fix |
|---|---|---|---|
| 1 | D1 has no outbound SSH (denied to D2/D3/D4 and to itself) | Every manifest would carry `ERROR:` for inventory, qdisc and digest | Cross-node capture moved to the laptop; bench.js refuses to run without `--env-file` |
| 2 | `git_commit` read D1's local clone (`dc07bba`), which lacks the Phase A commit | Manifests would name wrong provenance | Split into `git_commit_source` (`9a9db0e`, clean tree) and `git_commit_harness_host` |
| 3 | Reconciliation raced block propagation | Spurious fork reports on every concurrent run | `fabInfoConverged()` polls until height and hash agree, records `wait_ms` |
| 4 | Sampler matched the shell wrapper, not node (3.6 MB RSS, 1 thread) | Client-bottleneck check would report 0% CPU forever | Select by `/proc/<pid>/comm == node` |
| 5 | `ps -o pcpu` is a lifetime average | Cannot detect saturation | `utime+stime` deltas from `/proc/<pid>/stat` |
| 6 | `docker stats --no-stream` costs 1.45 s per node | Cadence 4.10 s against a requested 2 s | Direct cgroup v2 reads (~31 ms/node), differenced locally |
| 7 | Convergence timeout of 30 s too short under load | False "peers disagree" after 1,000 concurrent tx | Raised to 180 s, poll 1 s |

Defect 6 detail: SSH was never the bottleneck (13 ms multiplexed). `ControlMaster`
alone left cadence at 4.10 s; replacing `docker stats` brought it to **2.01 s
median**.

---

## 3. Phase 2 dry run, check by check

Ran 50 sequential (W=1) for provenance, reputation and bridge, then 200 concurrent
at W=10 for the same three plus the read condition.
Data: `phase2-20260804T211001Z/`.

| Check | Result | Evidence |
|---|---|---|
| C1 JSONL lines == submitted | **PASS** | 50/50/50/200/200/200/200 exact |
| C2 submitted == committed + Σ errors | **PASS** | all seven runs, zero errors |
| C3 zero CHAINCODE_REJECT | **PASS** | 0 in all seven runs |
| C4a steady_count ≥ 50 | **FAIL** | A/B/C = 45 |
| C4b non-null p50 and steady_tps | **PASS** | all seven conditions |
| C5 heights and hashes converge | **PASS** | all four agree after every condition |
| C6 resources coverage + cadence | **PASS** | D1–D4 + 75 HARNESS rows, median 2.01 s |
| C7 phase-split monotonic | **PASS** | every committed write |
| C8 condition D real trust report | **PASS** | stage MATERIAL_CERTIFIED, history 1, linked 1, actors 2 |

### 3.1 C4 was reported as a failure, not relaxed

`steady_count >= 50` is **unsatisfiable by construction** at n=50 under the F1
formula:

```
warmupCount = max(W, min(5*W, floor(total*0.1))) = max(1, min(5, 5)) = 5
steady_count <= 50 - 5 = 45 < 50
```

Since `warmupCount >= W >= 1` always, no parameter choice reaches 50 at n=50. The
check was **computed exactly as specified and returned FAIL**; it was not relaxed,
not recomputed, and the threshold was not adjusted. Phase 2 stopped there. All
three manifests carry `suspect_low_steady_count: true` and each run printed the
warning. The second clause was evaluated and reported separately rather than being
merged into a single verdict.

### 3.2 Dry-run measurements

| Cond | W | n | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|
| A seq provenance | 1 | 50 | 414.7 | 424.0 | 556.1 | 667.7 | 74.1 | 324.6 | 2.41 |
| B seq reputation | 1 | 50 | 441.7 | 423.5 | 600.6 | 890.1 | 92.1 | 326.6 | 2.25 |
| C seq bridge | 1 | 50 | 456.3 | 434.2 | 614.5 | 937.2 | 109.3 | 325.7 | 2.18 |
| D read | 10 | 200 | 12.5 | 12.1 | 16.9 | 29.5 | n/a | n/a | 780.89 |
| E conc provenance | 10 | 200 | 1156.9 | 1069.6 | 1804.6 | 2013.4 | 371.8 | 671.3 | 8.38 |
| F conc reputation | 10 | 200 | 644.1 | 607.8 | 1206.7 | 1242.4 | 210.0 | 369.7 | 15.28 |
| G conc bridge | 10 | 200 | 1146.9 | 1069.7 | 2042.0 | 2316.7 | 373.3 | 637.3 | 8.81 |

**Condition D ran at W=10 here, so 12.1 ms P50 is a CONCURRENT read number and is
not comparable to the manuscript's 5 ms sequential read.** Phase 3 runs D at W=1 as
specified.

### 3.3 Stake is a threshold, not a consumable

Amendment F3 was motivated by the expectation that thousands of ratings against one
10,000 stake would surface as `CHAINCODE_REJECT`. **That cannot happen.**

`SubmitRating` only compares `raterStake.Balance < config.MinStakeRequired`
(`reputation_contract.go:574`) and never debits. The only debit sites in the entire
chaincode are `InitiateDispute` (`Balance -= config.DisputeCost`, line 686) and the
slash path (lines 1249–1250). Neither fires in conditions B, F or H.

Measured, not merely read:

| Condition | Ratings | Stake before | Stake after |
|---|---|---|---|
| B | 50 | Admin 480000, User1 380000 | Admin 480000, User1 380000 |
| F | 200 | Admin 500000, User1 400000 | Admin 500000, User1 400000 |

250 ratings, zero depletion. F3 was implemented as instructed and is retained
because the recorded balances convert the assumption into evidence, but the failure
mode it guards against does not exist. Phase 3's ~9,000 ratings will not deplete
stake either.

---

## 4. Connection-multiplicity probe

**Hypothesis:** sharing one `grpc.Client` across all W workers serialises concurrent
calls on a single HTTP/2 connection.

**Method:** `--clients=N` creates N `grpc.Client`s and N gateway pairs at startup;
worker slot *i* uses client *i mod N*. Nothing else changed. `clients_n` is recorded
in every manifest. Condition E, W=20, n=1000, one run each at N ∈ {1, 4, 20}, 60 s
cooldown between. Data: `probe-20260804T212237Z/`.

**Pre-registered criterion:** if N=4 or N=20 exceeds N=1 steady TPS by more than
20%, the shared connection was a client-side artifact.

### 4.1 Result: NEGATIVE. More connections were worse, not better.

| clients | Steady TPS | vs N=1 | Mean ms | P50 ms | P95 ms | P99 ms | **Endorse median** | **Order+Commit median** |
|---|---|---|---|---|---|---|---|---|
| **1** | **11.46** | — | 1761.2 | 1591.0 | 2973.4 | 3910.8 | **363.1** | **1201.5** |
| 4 | 8.66 | **−24.4%** | 2306.0 | 2240.4 | 3544.8 | 4038.8 | **377.4** | **1795.0** |
| 20 | 9.49 | **−17.2%** | 2092.3 | 2070.9 | 2722.2 | 2955.4 | **379.6** | **1676.4** |

All three runs: 1000 submitted, 1000 committed, zero errors, invariant holds.

**Decision under the pre-registered rule: keep `clients=1`.** Neither N=4 nor N=20
exceeded N=1; both were lower. The probe is recorded as run and negative, and
`clients=1` is used for all subsequent measurement.

### 4.2 Localisation: the endorse path is not where the variation lives

Endorse median is **flat** across all three configurations: 363.1, 377.4, 379.6 ms,
a spread of 4.5%. Every bit of the variation is in order+commit: 1201.5 → 1795.0 →
1676.4 ms.

This matters for interpretation. The 5× inflation of endorse median between W=1
(74 ms) and W=10/20 (~370 ms) is **insensitive to connection multiplicity**, so it
is not a client-side queueing artifact on the proposal path. It is server-side, at
the endorsing peers.

**Conclusion: the system, not the instrument, sets the concurrency limit.** The
single shared HTTP/2 connection is not the constraint. This goes in the methodology
either way, as intended.

Caveat stated plainly: one run per configuration. The differences are large and
directionally consistent with the criterion, but a three-run repeat would tighten
them. The decision rule was fixed before the data was seen.

### 4.3 Secondary finding from the probe

Ledger convergence after 1,000 concurrent transactions took longer than the 30 s
poll allowed: `clients=1` converged at 30.06 s (just inside), `clients=4` and
`clients=20` timed out and were recorded `converged: false`. All four peers were
verified in agreement afterwards (height 19482, identical hash), so this was
propagation lag on `peer0.org2`, not a fork. The convergence timeout was raised to
180 s with a 1 s poll for Phase 3 onward. Recorded as instrument fix #7.

---

## 5. Methodology disclosure: workload shape

Every write condition (A, C, E, G, and the bridge conditions) uses a **genesis
`MATERIAL_CERTIFICATION` event against a fresh asset**, and every rating condition
(B, F, H) uses `SubmitRating` directly. Consequently:

- **No mid-lifecycle transition is exercised.** The predecessor assertion added in
  `9a9db0e` never fires on a legal path during measurement.
- This matches the April workload exactly, which is what keeps the new numbers
  comparable to the published ones.
- The assertion's correctness was verified separately and is not re-verified here.

The methodology section must state this. A workload that advanced assets through
`MATERIAL_CERTIFIED → PRINT_COMPLETE → INSPECTION_PASSED → CERTIFIED` would
exercise the assertion but would not be comparable to Table 7 or Table 8.

---

## 6. Phase 3 onward

Phase 3 launched with `--clients=1`, three runs per condition, 60 s cooldowns:
A/B/C at W=1 n=500, D at **W=1** n=500, E/F/G at W=20 n=2000, H at W=20 n=500.

Recording requirements in force from Phase 3:

- Resource summary per container per condition: median, p95, max CPU and memory,
  plus idle baseline. The manuscript claims all peers stay below 6% CPU and 150 MB
  RAM; the Phase 2 dry run already contradicts both (peer RSS 279–311 MB at idle),
  so this needs to be airtight.
- Orderer memory reported separately for leader (D4, node 1, term 4) and followers
  (D2, D3).
- Endorse and order+commit medians alongside total latency in every table.
- Condition D at W=1, with the W=10 dry-run number explicitly marked
  non-comparable.
- Ten complete raw error objects for condition H and for any condition where one
  error class exceeds 1%.
- Ledger reconciliation compared against committed count per condition
  (amendment M7), since `analyze.js` is JSONL-only by design.

### 6.1 Block occupancy (added requirement, no extra runs)

Computed by `occupancy.js`, which reads `manifest.json` for `height_delta` and
`txs.jsonl` for committed count and the steady window. It is a separate tool
precisely so `analyze.js` stays JSONL-only.

```
blocks_produced  = height_delta(org1), with agreement across all four confirmed per run
tx_per_block     = committed / blocks_produced
block_rate_per_s = blocks_produced / steady_window_s
```

**Caveat stated openly:** `blocks_produced` spans the whole run (getinfo before →
after) while `steady_window_s` is a subset, so `block_rate_per_s` computed this way
**overstates** the true steady-state rate. A total-window figure is reported
alongside it in every table.

### 6.2 Hypothesis result from the probe data (available before Phase 3 finishes)

The probe runs (condition E, W=20, n=1000) already test this. Reported as measured,
with nothing adjusted to fit.

| clients | Committed | Blocks | **tx/block** | **Block rate /s** | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| 1 | 1000 | 309 | **3.24** | 4.03 | 11.46 | 1586.0 |
| 20 | 1000 | 366 | **2.73** | 3.95 | 9.49 | 2071.8 |
| 4 | 1000 | 402 | **2.49** | 3.96 | 8.66 | 2244.8 |
| **median** | | | **2.73** | **3.96** | 9.49 | 2071.8 |

**Verdict: the direction holds, the predicted magnitudes do not.**

- **Supported:** blocks are nowhere near full. `tx_per_block` = 2.73 against
  `MaxMessageCount` = 10. **MaxMessageCount is not binding**, so raising it cannot
  raise throughput. This is the substantive claim and it is confirmed.
- **Not observed:** the predicted shape was `tx_per_block ≈ 0.6` and
  `block_rate ≈ 20/s`. Measured: 2.73 and 3.96/s.
- **`tx_per_block ≈ 0.6` was arithmetically unreachable.** Fabric does not cut
  empty blocks, so `tx_per_block ≥ 1` by construction. Any prediction below 1
  cannot be met regardless of configuration.
- **Block rate is 4/s, not the ~20/s a 50 ms timeout would permit.** Blocks are not
  being cut on the timeout either. Consistency check: 9.5 TPS ÷ 2.73 tx/block =
  3.5 blocks/s, which matches the measured 3.96 within run-to-run spread. Block
  rate is being set by the arrival rate divided by occupancy, not by
  `BatchTimeout`.

**A mechanism consistent with 2.73 rather than ~1.0.** Under a pure timeout model
at ~9.5 TPS (one arrival every ~105 ms), the 50 ms timer would expire before a
second transaction arrived and blocks would carry ≈1. Blocks carry 2.7, so
arrivals are still bursty despite the pipelined generator. The likely cause is
**self-synchronisation**: all W in-flight transactions commit when a block commits,
so all W workers are released at nearly the same instant and re-dispatch together.
Closed-loop load plus block-granular commit manufactures its own batching. This is
a hypothesis about mechanism, not a measurement, and is labelled as such.

**Consequence for Phase 7:** under the revised plan, **7b (MaxMessageCount) is
skipped** unless some `BatchTimeout` setting in 7a drives `tx_per_block` to 8 or
above. On present evidence blocks never fill, so the mutation would teach nothing.
This reasoning is recorded rather than the mutation being spent.

Phase 3 will re-test all of this across conditions A–H with three runs each.

### 6.3 Testbed disclosure: node heterogeneity

**D2 runs a Xeon E5-1603 v3 with 4 threads; D1, D3 and D4 have 12.** This, rather
than uptime, is the likely reason `peer0.org2` is the convergence laggard. It is
recorded as a **testbed heterogeneity disclosure**, not as an anomaly attributable
to org2.

Consistent with this, amendment M3 stands: `peer0.org2` was **not** restarted
despite its 2026-04-08 start time, because its RSS (279 MB) sits between org1
(293 MB) and org4 (311 MB), so uptime has not confounded memory.

Whether org2 is consistently last to converge is tracked per run in
`occupancy.md` (§ "Ledger convergence per run") across all of Phase 3.

### 6.4 Methodology disclosure: the generator is closed-loop

The load generator maintains **W transactions in flight** and dispatches the next
only when one completes. This is standard and correct for a latency-plus-throughput
harness, and it is what the fixed-window rebuild was for.

It has a consequence that must be stated in the methodology: **arrival rate falls
as latency rises.** When the system slows, the generator offers less load, which is
precisely what keeps blocks from filling. The measured `tx_per_block` of 2.73 is
therefore a property of *this generator against this system*, not a property of the
system alone.

**An open-loop generator driving a fixed target arrival rate would fill blocks
differently**, and real AM event arrivals are open-loop: a print bureau finishing a
job does not wait for the ledger to acknowledge the previous one. Any throughput
claim derived from this harness is a closed-loop claim and should be labelled that
way. Adding an open-loop mode is the natural follow-on and is not in scope here.

---

---

## 7. Phase 3 — sequential block (A, B, C, D), complete

Three runs per condition, n=500, W=1, `clients=1`, 60 s cooldowns.
Data: `phase3-20260804T213214Z/`. **12 of 24 Phase 3 runs complete**; the
concurrent block (E, F, G) and high contention (H) were still running when this
section was written.

### 7.1 Latency and throughput, median across three runs

| Cond | W | n (3 runs) | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | **Endorse ms** | **Ord+Commit ms** | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A seq provenance | 1 | 1500 | 1500 | **0** | 431.1 | 402.3 | 679.8 | 1000.5 | 72.4 | 323.5 | 2.32 |
| B seq reputation | 1 | 1500 | 1500 | **0** | 440.1 | 422.1 | 680.3 | 1012.1 | 84.8 | 325.1 | 2.27 |
| C seq bridge | 1 | 1500 | 1500 | **0** | 442.4 | 412.3 | 689.9 | 903.0 | 84.1 | 320.2 | 2.26 |
| D read (W=1) | 1 | 1500 | 1500 | **0** | 4.0 | 3.9 | 4.8 | 5.6 | n/a | n/a | 251.54 |

**Zero failures of any class across 6,000 transactions.** The invariant
`submitted == committed + Σ errors` holds in all twelve runs.

### 7.2 Run-to-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread |
|---|---|---|---|---|---|---|
| A | 401.6 | 421.9 | **20.4 ms** | 2.28 | 2.34 | 0.05 |
| B | 411.2 | 423.0 | **11.9 ms** | 2.25 | 2.28 | 0.03 |
| C | 402.7 | 413.3 | **10.6 ms** | 2.24 | 2.30 | 0.06 |
| D | 3.8 | 3.9 | **0.1 ms** | 249.95 | 255.58 | 5.63 |

Spread is 2.6–5.1% of P50 on the write conditions and negligible on reads. Three
runs are adequate at this dispersion.

### 7.3 Block occupancy — W=1 is exactly one transaction per block

| Cond | W | **tx/block** | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS |
|---|---|---|---|---|---|
| A | 1 | **1.00** | 2.36 | 2.32 | 2.32 |
| B | 1 | **1.00** | 2.30 | 2.27 | 2.27 |
| C | 1 | **1.00** | 2.30 | 2.26 | 2.26 |
| D | 1 | n/a (no blocks) | n/a | n/a | 251.54 |

`tx_per_block = 1.00` exactly, and **block rate equals transaction rate**. With one
transaction in flight there is never a second arrival to share a block, so the
orderer cuts on `BatchTimeout` with a single transaction every time. Sequential
throughput is therefore entirely latency-bound, and `MaxMessageCount` is
irrelevant at W=1 by construction.

Condition D produces zero blocks (`height_delta` = 0 on all four peers), which is
the correct signature for an evaluate-only read path.

### 7.4 Condition D is the sequential read number, and it is not what the dry run showed

| Source | W | P50 | Comparable to manuscript? |
|---|---|---|---|
| Phase 2 dry run | 10 | 12.1 ms | **No** — concurrent read |
| **Phase 3 (this)** | **1** | **3.9 ms** | **Yes** — sequential read |
| Manuscript §5.2 Table 5 (single-host) | 1 | 5.4 ms | single-host, not distributed |
| April distributed | 1 | 5 ms mean | distributed |

The dry run's 12.1 ms was a W=10 concurrent number and must not be compared with
the manuscript's 5 ms. The correct distributed sequential figure is **3.9 ms P50 /
4.0 ms mean**, which is *faster* than both the April distributed figure (5 ms) and
the single-host Table 5 figure (5.4 ms). Read latency did not degrade under the
three-orderer topology, which is expected since reads never reach the orderer.

### 7.5 Phase-split decomposition, new information

The split was never available before. Across all three write types, endorsement is
a **small and roughly constant** fraction of sequential latency:

| Cond | Endorse ms | Ord+Commit ms | Endorse share |
|---|---|---|---|
| A | 72.4 | 323.5 | 18.3% |
| B | 84.8 | 325.1 | 20.7% |
| C | 84.1 | 320.2 | 20.8% |

Order-plus-commit is 320–325 ms and is nearly identical across all three contract
types, which is what one expects if it is dominated by Raft replication and block
commit rather than by chaincode work. The bridge (C) costs 11.7 ms more endorsement
than plain provenance (A), consistent with its additional reputation read and
write, and essentially nothing extra in ordering.

This localises the distributed latency budget: **roughly 80% is ordering and
commit, not endorsement**, at W=1.

### 7.6 Ledger reconciliation (amendment M7)

`analyze.js` is JSONL-only by design, so reconciliation is checked here against
`manifest.json`:

| Cond | Committed (JSONL) | Blocks (height_delta org1) | All four peers agree |
|---|---|---|---|
| A | 500 per run | 500 per run | yes |
| B | 500 per run | 500 per run | yes |
| C | 500 per run | 500 per run | yes |
| D | 500 per run | 0 per run | yes |

Height delta equals committed count exactly on every write run, which is the direct
consequence of `tx_per_block = 1.00`. Reads produce no blocks.

### 7.7 Comparison against the published April figures

April was measured on the single-orderer topology with the wave-barrier harness;
these are three-orderer Raft with the fixed-window harness. Both differences apply
at once, so this is a combined delta, not an isolated topology effect.

| Metric | April published | Phase 3 | Δ |
|---|---|---|---|
| Provenance seq mean | 370 ms | 431.1 ms | +16.5% |
| Reputation seq mean | 376 ms | 440.1 ms | +17.0% |
| Bridge seq mean | 383 ms | 442.4 ms | +15.5% |
| Provenance seq TPS | 2.70 | 2.32 | −14.1% |
| Reputation seq TPS | 2.66 | 2.27 | −14.7% |
| Bridge seq TPS | 2.61 | 2.26 | −13.4% |

Direction is consistent with three-way Raft replication adding a quorum round trip
that the single orderer did not pay. The sequential path is not affected by the
barrier defect, which is why these deltas are modest and why the sequential numbers
were the ones that agreed between old and new harnesses in Phase 2.

---

## 8. SESSION HALT — testbed outage, 2026-08-04T22:19:46Z

**All four nodes became unreachable simultaneously.** Phase 3 stopped at 12 of 24
runs. Phases 4, 5 and 6 did not start.

### 8.1 Evidence that this is an infrastructure event, not a harness fault

| Node | Last resource sample | Ping at 2026-08-05T03:32Z |
|---|---|---|
| D1 | 2026-08-04T22:19:46.370Z | **100% loss** |
| D2 | 2026-08-04T22:19:46.370Z | **100% loss** |
| D3 | 2026-08-04T22:19:44.360Z | **100% loss** |
| D4 | 2026-08-04T22:19:44.360Z | **100% loss** |

All four stopped responding **within the same 2-second sampling tick**, and all
four remained unreachable more than five hours later. SSH to D1 fails at TCP
connect (`Connection timed out`), not at authentication. Simultaneous loss of four
independent hosts on one subnet indicates a network path or site power event, not
node-level failure and not anything the harness did.

The resource sampler continued running on the laptop and recorded the cutoff
cleanly; its final rows are the last successful reads from each node.

### 8.2 What is banked and intact

| Artifact | Location | State |
|---|---|---|
| Phase 0 evidence + GATE0 report | `phase0-20260804T202038Z/` | complete |
| Harness source (6 files) + `env.json` | `phase0-.../harness/` | complete |
| Phase 2 dry run, 7 runs | `phase2-20260804T211001Z/` | complete |
| **Phase 3 sequential, 12 runs** | `phase3-20260804T213214Z/` | **complete, 500 lines each** |
| Phase 3 resource samples | `phase3-.../resources.csv` | 17,021 rows to cutoff |
| REPORT.md | `results/REPORT.md` | current through this section |

Verified line counts: A/B/C/D run1–run3 all exactly 500. The sequential analysis in
§7 rests entirely on complete runs and is unaffected by the outage.

### 8.3 Data at risk, disclosed

**The probe results (`probe-20260804T212237Z/`) were never rsynced to the laptop**
and exist only on D1. The *derived numbers* are recorded in §4 and §6.2 of this
report, but the raw `txs.jsonl` and manifests are stranded until D1 returns. If D1's
disk is intact they will still be there; if not, the probe must be re-run. This is
an archiving gap on my part: I analysed the probe over SSH rather than pulling it
first.

### 8.4 The incomplete run, reported rather than silently dropped

> **⚠️ SUPERSEDED 2026-08-11 — see `PHASE_9_REPORT.md` §3.** The handling below
> was correct and stands. Its forward-looking clause is discharged: condition E
> was re-run in full by Phase 3B (decisions DR1/DR2), and **E, F, G and H are
> now 3/3 complete**. The §8.5 table below is stale in four rows. The partial
> remains on disk, undeleted, and is still used for nothing.


`E/run1` captured **1,100 of 2,000 transactions** before the outage. Under
amendment D2 the only permitted exclusions are pre-registered ones (a Raft election
per 5e, or an invariant violation). A run truncated by infrastructure failure is
neither, so it is **disclosed here with its data rather than deleted**:

- `phase3-20260804T213214Z/E/run1/txs.jsonl`, 1,100 records
- No `manifest.json` was written, because the harness writes it only after the
  condition completes. Without it there is no `height_delta`, so block occupancy
  and ledger reconciliation cannot be computed for this run.
- It **must not** be treated as a third of a valid E measurement. Its steady-state
  window is truncated mid-run and its drain never happened.
- Condition E requires a full re-run of all three runs when the testbed returns.

The partial's per-transaction records remain readable and could be used to sanity
check E's latency distribution, but no throughput figure should be derived from it.

### 8.5 Phase 3 completion state

| Condition | Runs done | Status |
|---|---|---|
| A seq provenance | 3/3 | ✅ complete, analysed |
| B seq reputation | 3/3 | ✅ complete, analysed |
| C seq bridge | 3/3 | ✅ complete, analysed |
| D read W=1 | 3/3 | ✅ complete, analysed |
| E conc provenance | 0/3 | ❌ run1 truncated, re-run required |
| F conc reputation | 0/3 | ❌ not started |
| G conc bridge | 0/3 | ❌ not started |
| H high contention | 0/3 | ❌ not started |

### 8.6 To resume when the testbed returns

1. Re-verify Phase 0 integrity: heights agree across all four peers, three
   consenters active, chaincode sha256 still `46ae8a9f…`, endorsement still
   MAJORITY, no netem. **An unclean shutdown of four nodes mid-write can leave a
   peer behind; this must be checked before any measurement, not assumed.**
2. Pull `probe-20260804T212237Z/` to the laptop before anything else.
3. Regenerate `env.json` (`collect_env.sh`) — container start times and digests
   will have changed.
4. Re-run Phase 3 conditions E, F, G, H. A, B, C, D are done and need not repeat.
5. Then Phases 4, 5, 6 as specified. Phase 7 remains gated on M4.

### 8.7 Outstanding items unaffected by the outage

- **M4 still owed**: prove the channel-update path against v3.1.4 with a reversible
  no-op, preferring the v3.1.4 binary inside a peer container. Phase 7 does not run
  without it.
- **Phase 7b provisionally skipped**: block occupancy of 2.73 (probe) and 1.00
  (Phase 3 sequential) shows `MaxMessageCount` is not binding. It runs only if a
  `BatchTimeout` setting in 7a drives `tx_per_block` ≥ 8.
- **Phase 8** (single-host re-run) is laptop-only and does **not** depend on the lab
  testbed. It could proceed now if desired, and would also settle whether the
  single-host network claimed as v3.1.0 for Tables 6 and 7 actually is.

_End of report as of the outage. Sections for the remaining phases will be appended
when the testbed returns._
