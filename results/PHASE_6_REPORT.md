# PHASE 6 REPORT — fault tolerance under load (INTERIM, 6a partial, 6b not run)

**Session:** 2026-08-10, 20:59:40Z → 21:45:06Z
**Directory:** `phase6-20260810T205940Z` on D1; run data mirrored to the laptop
**Harness:** bench.js v2.1.0, `--clients=1`, `--deadline-commit=30000` (this phase only)
**Status:** **INCOMPLETE.** 6a has one valid repetition of a planned three. 6b did
not run. The lab became unreachable at approximately 21:50Z, for the second time
in this session.

Every figure was read from a file on disk or from a live query. Nothing is
estimated or interpolated. Where a quantity cannot be measured it is named as
unmeasured and no substitute is offered.

---

## 1. What exists, and what does not

| Item | Planned | Actual | Status |
|---|---|---|---|
| 6a rep 1 | seq bridge W=1 n=1000, stop leader at ~tx 400 | stop fired at **tx 401** | ✅ **VALID** |
| 6a rep 2 | same | stop fired at **tx 1000** | ❌ **INVALID**, reported in §6 |
| 6a rep 3 | same | not run | ❌ missing |
| 6b | endorser loss, n=600, stop D3 @200, D2 @400 | not run | ❌ missing |
| 6c | fork check across orderer logs | partial — see §7 | ⚠️ partial |
| — | (unplanned) no-fault control, n=1000 | acquired accidentally | ✅ **retained, §5** |

The plan permits "one minimum" repetition for 6a if the first two do not both
complete cleanly. **6a meets that minimum with rep 1.** 6b has no data at all.

`commitStatus` deadline 30000 is recorded in every manifest for this phase, as
required:
`{"evaluate":15000,"endorse":60000,"submit":60000,"commitStatus":30000}`.

---

## 2. Per-run verification

| Run | submitted = committed + errors | Invariant | Peers agree (h, hash) | height_delta all 4 | netem |
|---|---|---|---|---|---|
| 6a rep1 (failover) | 1000 = 407 + 593 | **OK** | True, True | 407/407/407/407 | null |
| no-fault control | 1000 = 1000 + 0 | **OK** | True, True | 1000/1000/1000/1000 | null |
| 6a rep2 (invalid) | 1000 = ? | not analysed | — | — | null |

rep2's per-transaction data is archived on D1 at `phase6-.../rep2/C/run1/` but was
**not copied to the laptop before the outage**, so it cannot be analysed here. It
is not lost; it is unreachable. See §6.

---

## 3. 6a — RAFT LEADER FAILOVER. The headline result

### 3.1 Timeline, measured

| Event | Time (UTC) | Source |
|---|---|---|
| Run start | 20:59:59.872 | manifest |
| Last commit before stop | **21:03:01.570** (seq 406) | txs.jsonl |
| Injection point | tx **401** | event log |
| `docker stop` returned | **21:03:03.372** | event log |
| D2 observed leader loss | 21:03:04.273 | orderer2 log |
| D2 became candidate, **term 5** | 21:03:04.298 | orderer2 log |
| **D2 became leader** | **21:03:04.323** | orderer2 log |
| D3 acknowledged leader 2, term 5 | 21:03:04.327 | orderer3 log |
| First commit after stop | **NONE** | txs.jsonl |
| Orderer restarted by A4 safety net | ~21:13:03 | container status |

**Raft failover completed in ~951 ms** (21:03:03.372 → 21:03:04.323), term 4 → 5,
leader node 1 (D4) → node 2 (D2).

### 3.2 The consensus layer recovered. The client did not.

| Measure | Value |
|---|---|
| Committed | **407 of 1000** |
| Committed **after** the stop | **0** |
| Failures | **593** |
| Failure class | **`ORDERER_UNAVAILABLE`, 593 of 593 (100%)** |
| Other classes | all zero |

**The recovery gap is not measurable as a gap, because the service never
recovered within the run.** That is itself the answer, and it is the opposite of
what a healthy 951 ms Raft failover would suggest.

### 3.3 Latency across the three windows

| Window | n | P50 ms | P95 ms | P99 ms | Mean ms |
|---|---|---|---|---|---|
| 1 — before failover (committed) | 407 | **412.0** | 721.3 | 924.6 | 446.1 |
| 2 — during outage (all failed) | 593 | **28.6** | 43.7 | max 110.3 | — |
| 3 — after recovery | **0** | n/a | n/a | n/a | n/a |

Window 2's figures are **time-to-failure, not latency**. The client is rejected
in ~29 ms, far below the 30,000 ms `commitStatus` deadline: it fails fast on a
refused connection rather than hanging until timeout. That is a clean failure
mode, and it means the 30 s deadline was never the binding constraint.

Window 3 is empty because the A4 safety net restored the orderer at +600 s, by
which time the run had already drained all 1000 submissions.

### 3.4 Cause, verified from the channel config rather than inferred

```
Global  OrdererAddresses          : ["orderer.example.com:7050",
                                     "orderer2.example.com:7050",
                                     "orderer3.example.com:7050"]
OrdererOrg group  Endpoints       : ["orderer.example.com:7050"]      <-- only one
```

In Fabric 3.x the per-organization `Endpoints` value supersedes the deprecated
global `OrdererAddresses` list. The peer gateway therefore has exactly **one**
orderer it will ever target, and it is the one that was stopped. Consensus had a
healthy quorum and a new leader within a second; the client had nowhere to send.

**This is a configuration defect in the testbed, not a property of Raft.** It is
correctable by adding the other two orderers to the OrdererOrg `Endpoints` value.

### 3.5 What this means for the manuscript

The single-ordering-node statements in §3.2, §3.3, §6.6 and §7 need to
distinguish two claims that this run separates cleanly:

- **Consensus-layer tolerance: demonstrated.** Leader loss was absorbed in
  ~951 ms with quorum maintained and no fork (§7).
- **Deployment-level tolerance: absent, and measurably so.** 100% of in-flight
  and subsequent work failed, with zero recovery, for a single-orderer-endpoint
  configuration reason.

Softening the caveat to "Raft provides ordering-layer fault tolerance" would be
**unsupported by this measurement** unless the endpoint configuration is fixed
and the run repeated. As it stands the deployment does not survive the loss of
one orderer, and the reason is nameable and fixable.

---

## 4. Ledger integrity across the failover

All four peers reported `height_delta` of exactly **407** and agreed on both
height and current block hash after the run. The 593 failed transactions
consumed **no** block space: they never reached the orderer.

`submitted == committed + sum(error classes)` holds: 1000 = 407 + 593.

---

## 5. The no-fault control (unplanned, retained)

An orchestration defect (§6) produced a second n=1000 sequential-bridge run in
which **no fault was injected**. It is retained as a control, and it is genuinely
useful: it establishes what the same workload does on a healthy network minutes
either side of the failover.

| | Failover run, window 1 | No-fault control | Δ |
|---|---|---|---|
| Committed | 407 / 407 attempted pre-stop | **1000 / 1000** | — |
| P50 ms | 412.0 | **443.8** | −7.2% |
| P95 ms | 721.3 | **755.4** | −4.5% |
| P99 ms | 924.6 | **1010.8** | −8.5% |
| Mean ms | 446.1 | 478.1 | −6.7% |

Pre-failover latency is statistically indistinguishable from the healthy control.
**The network was not degraded before the injection**, so the failover result is
not contaminated by a pre-existing problem.

The control also confirms the baseline sequential bridge figure on this testbed
at this state size: **P50 443.8 ms**, 1000/1000 committed, all four peers
agreeing.

---

## 6. The invalid repetition, reported with its reason

Per the exclusion rules, this run is **not** a permitted exclusion (it contained
no Raft election and its invariant was not violated), so it is reported here
rather than discarded silently.

**What happened.** The orchestrator launches bench.js over SSH and then polls
`txs.jsonl` to find the injection point. The launch command took **4.5 minutes**
to return, because a backgrounded remote process kept the SSH channel open.
Polling therefore began only after the workload had already finished, the file
already held 1000 records, and the stop fired at **tx 1000** instead of ~400 —
after every transaction had been submitted.

**Consequence.** The run measures a leader stop against an already-drained
workload. It is not a failover-under-load measurement and must not be reported
as one. Its data is archived on D1 at `phase6-.../rep2/C/run1/`.

**Two orchestration defects were found and fixed in this phase:**

1. **Blocking SSH launch** (rep 1). The first attempt blocked on the same SSH
   behaviour and would never have fired the injection at all. It was caught at
   tx 344 and the stop was issued by hand at tx 401, then the blocked
   orchestrator was killed before its stale resume could stop the orderer a
   second time. **Repetition 1 is therefore a hand-fired injection**, disclosed
   here; the measured timings are unaffected because they come from the
   independent event log and the orderer logs.
2. **Run-directory collision.** `bench.js --runs=1` always writes `run_index 1`,
   so pointing a second repetition at the same `--out` made it **append** to the
   first repetition's `txs.jsonl` and overwrite the manifest with one describing
   the concatenation (`submitted=2000, committed=1407`). That merged manifest
   **still satisfied the invariant** (2000 = 1407 + 593), which is what makes
   this class of defect dangerous: a corrupted artifact that passes the integrity
   check. No data was lost — a copy of repetition 1 had been taken beforehand and
   records carry `run_id`, so the two runs were separated exactly (1000 records
   each, `Smsnptd44-C-r1` and `Smsnqecks-C-r1`) and restored to separate
   directories. Fixed structurally by giving each repetition its own `--out`
   tree.

---

## 7. 6c — fork check, partial

Within the reachable window:

- All four peers reported identical height and identical `currentBlockHash`
  after the failover run (`peers_agree_after: {height: true, hash: true}`).
- `height_delta` was identical across all four orgs: 407.
- Term progression observed directly: **term 4 → term 5**, single leader change,
  node 1 → node 2. D3 and D2 logs agree on the term and the leader identity.
- After the orderer restart, `osnadmin` confirmed it rejoined as
  `consensusRelation=consenter, status=active` at height 43212.

**No fork was observed.** The full-session log dump across all three orderers and
four peers required by 6c has **not** been taken, because the lab became
unreachable. It is deferred to Phase 9b.

---

## 8. Deviations

| # | Deviation | Detail |
|---|---|---|
| 1 | **6a repetition 1's injection was fired by hand** | The orchestrator blocked on an SSH channel. Caught at tx 344, stop issued manually at tx 401. Timings derive from the independent event log and orderer logs, so the measurement is unaffected. §6. |
| 2 | **6a repetition 2 is invalid** | Injection fired at tx 1000 instead of ~400 due to a launch/poll race. Reported with its reason; data on D1. §6. |
| 3 | **Run-directory collision corrupted an artifact, recoverably** | Detailed in §6. The corrupted manifest passed the invariant check, which is recorded as a caution about relying on that check alone. |
| 4 | **A no-fault control was acquired unintentionally** | Retained and reported as a control rather than discarded. §5. |
| 5 | **6a repetitions 2 and 3 not completed; 6b not run** | Lab unreachable from ~21:50Z. |
| 6 | **6c log dump not taken** | Deferred to Phase 9b. §7. |
| 7 | **Node-local samplers left running on D1–D4** | Started 20:59:40Z for this phase and never stopped, because the outage intervened. They write to `/tmp/res_phase6.csv` at a 2 s interval. Harmless but untidy; to be stopped and collected when the lab returns. Their data has **not** been collected, so no resource table appears in this report. |
| 8 | **No resource utilisation section** | Consequence of deviation 7. Named as uncollected rather than omitted silently. |

---

## 9. Contradictions against earlier reports

1. **Phase 3B found `ENDORSE_MISMATCH` dominant under contention.** Endorser loss
   (6b) would have tested whether the same class appears under endorser removal.
   **That comparison is not available** because 6b did not run.

2. **No contradiction with Phases 3B, 4 or 8.** The pre-failover latency in this
   phase (P50 412.0 ms) is consistent with Phase 3B's condition C on the same
   testbed (P50 412.3 ms), at a much larger state size — which is worth noting
   against Phase 8's finding that single-host *concurrent* throughput halved with
   state growth: the distributed *sequential* path shows no such sensitivity here.

---

## 10. What is required to complete Phase 6

When the lab returns:

1. Stop and collect the node-local samplers (deviation 7).
2. 6a repetitions 2 and 3, with the fixed orchestrator (per-repetition `--out`,
   local background subshell for the launch so polling starts immediately).
3. 6b in full: seq bridge n=600, stop D3 `cc-unified` at ~200, D2 at ~400.
4. 6c full log dump across three orderers and four peers.
5. Consider, and report either way: a repeat of 6a **after** adding all three
   orderers to the OrdererOrg `Endpoints` value, which would convert §3.5 from
   "the deployment cannot survive leader loss" into a measured recovery gap.
   This is a configuration change to the system under test and is **not** in the
   plan, so it is raised as a decision rather than taken.

---

## 11. Decisions owed

1. **Should 6a be repeated with a corrected orderer-endpoint configuration?**
   As measured, the deployment does not survive leader loss, and the cause is a
   single-endpoint configuration. Fixing it and re-measuring would produce the
   recovery-gap number the plan asks for, and would let the manuscript claim
   ordering-layer fault tolerance with evidence. It also changes the system under
   test mid-study, so both configurations would need reporting.
   *Default: report the measured result as it stands, and record the
   configuration finding, without changing the system.*

2. **6a repetition 1 was a hand-fired injection.** If that is not acceptable for
   publication, repetitions 2 and 3 with the fixed orchestrator supersede it.
   *Default: retain rep 1 as valid, disclosed, and add the automated
   repetitions when the lab returns.*

---

## 12. Status

**Phase 6 is incomplete and this report is interim.** It will be superseded when
6a repetitions 2–3 and 6b are taken.

Lab state at last contact (21:45:06Z), verified rather than assumed:
`orderer.example.com` restarted and rejoined as an active consenter at height
43212; no netem applied in any phase; safety-net timers cancelled; all four peers
agreeing on height and hash. The only outstanding item is the sampler processes
of deviation 7.
