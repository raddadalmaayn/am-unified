# GATE R — Recovery Assessment

**Session date:** 2026-08-09
**Assessed session:** 2026-08-04 (`phase0-20260804T202038Z`, `phase2-20260804T211001Z`,
`probe-20260804T212237Z`, `phase3-20260804T213214Z`)
**Status:** Phase R complete. Held at GATE R pending go-ahead.

Every figure in this document was read from a file on disk or from a live query
against the testbed. Nothing is estimated, interpolated or carried over from
`REPORT.md`. Where this document contradicts `REPORT.md`, the contradiction is
stated explicitly in §3 rather than resolved silently.

---

## 1. Where the authoritative data lives

Run data is authoritative on **D1** (`@D1`), at
`am-unified/results/`. The laptop copy at
`am-unified/results/` is a partial rsync snapshot taken at
2026-08-04T22:19Z and is **stale** — it is missing `phase3/E/run2`, `E/run3` and
all of `phase3/F`.

One artifact exists only on the laptop and not on D1:
`phase3-20260804T213214Z/resources.csv`. The resource sampler is a laptop-side
process (`harness/sampler.sh`), so its output never reached D1. This file must be
preserved; it is the only resource evidence for Phase 3.

Node map (from `harness/collect_env.sh`):

| Node | IP | Interface | Org | Peer port | Orderer |
|---|---|---|---|---|---|
| D1 | D1 | enp4s0f0 | 1 | 7051 | — |
| D2 | D2 | enp0s25 | 2 | 7051 | orderer2.example.com |
| D3 | D3 | eno1 | 3 | 7051 | orderer3.example.com |
| D4 | D4 | eno1 | 4 | 8051 | orderer.example.com |

D1 has **no outbound SSH** to D2/D3/D4. All cross-node orchestration is driven
from the laptop. This matters for Phases 5 and 6 — see §7.

---

## 2. R1/R2 — Inventory and classification

### 2.1 Phase 3 (`phase3-20260804T213214Z`)

Design: A/B/C at W=1 n=500, D (read) at W=1 n=500, E/F/G at W=20 n=2000,
H (high contention) at W=20 n=500. Three runs per condition, `--clients=1`,
60 s cooldowns, harness v2.0.0, schema v1.

Per-run verification below is from each run's own `manifest.json` on D1:
`counts.invariant_holds`, `counts.submitted` / `committed` / `errors_by_class`,
and `peers_agree_after`.

| Cond | Runs present | txs.jsonl lines | submitted = committed + errors | peers_agree (height, hash) | netem | cc sha256 all 4 | Resource coverage | **Status** |
|---|---|---|---|---|---|---|---|---|
| A seq provenance | 3 | 500 / 500 / 500 | 500 = 500 + 0 (×3) | true, true | null | match | FULL | **COMPLETE** |
| B seq reputation | 3 | 500 / 500 / 500 | 500 = 500 + 0 (×3) | true, true | null | match | FULL | **COMPLETE** |
| C seq bridge | 3 | 500 / 500 / 500 | 500 = 500 + 0 (×3) | true, true | null | match | FULL | **COMPLETE** |
| D read W=1 | 3 | 500 / 500 / 500 | 500 = 500 + 0 (×3) | true, true | null | match | FULL | **COMPLETE** |
| E conc provenance | 3 | 2000 / 2000 / 2000 | 2000 = 2000 + 0 (×3) | true, true | null | match | **run1 only** | **COMPLETE (tx) / PARTIAL (resource)** |
| F conc reputation | 1 valid + 1 empty | 2000 / — | 2000 = 2000 + 0 (run1) | true, true | null | match | **NONE** | **PARTIAL** |
| G conc bridge | 0 | — | — | — | — | — | — | **MISSING** |
| H high contention | 0 | — | — | — | — | — | — | **MISSING** |

Error totals are zero in **every** class across all sixteen valid runs:
`MVCC_READ_CONFLICT`, `PHANTOM_READ_CONFLICT`, `ENDORSEMENT_POLICY_FAILURE`,
`CHAINCODE_REJECT`, `ENDORSE_MISMATCH`, `GATEWAY_DEADLINE`, `GATEWAY_UNAVAILABLE`,
`ORDERER_UNAVAILABLE`, `COMMIT_TIMEOUT`, `OTHER`. `suspect_low_steady_count` is
`false` on all sixteen.

`F/run2` is an **empty directory** — no `txs.jsonl`, no `manifest.json`, no data
of any kind. It is where the session stopped. It is not a discarded run under
amendment D2; it is a run that never produced a record. Directory mtime
2026-08-04T22:37Z.

### 2.2 Run timeline (from `wall_clock_start` / `wall_clock_end`, UTC)

| Run | Start | End | Cooldown observed (ms) |
|---|---|---|---|
| A/run1 | 21:32:18.077 | 21:35:57.446 | 0 (first run) |
| A/run2 | 21:36:57.694 | 21:40:31.815 | 59,999 |
| A/run3 | 21:41:32.293 | 21:45:07.673 | 60,006 |
| B/run1 | 21:46:07.902 | 21:49:48.312 | 60,001 |
| B/run2 | 21:50:48.583 | 21:54:29.579 | 60,001 |
| B/run3 | 21:55:30.053 | 21:59:13.283 | 60,002 |
| C/run1 | 22:00:13.636 | 22:03:54.890 | 60,005 |
| C/run2 | 22:04:56.430 | 22:08:39.769 | 60,009 |
| C/run3 | 22:09:40.111 | 22:13:17.944 | 60,001 |
| D/run1 | 22:14:18.162 | 22:14:20.582 | 60,000 |
| D/run2 | 22:15:20.813 | 22:15:23.028 | 60,002 |
| D/run3 | 22:16:23.256 | 22:16:25.470 | 60,007 |
| E/run1 | 22:16:29.427 | 22:19:24.453 | 0 |
| E/run2 | 22:21:29.521 | 22:24:24.616 | 60,011 |
| E/run3 | 22:26:40.804 | 22:29:41.115 | 60,009 |
| F/run1 | 22:31:54.679 | 22:34:58.371 | 60,010 |

The 60 s cooldown held on every run that had a predecessor. `E/run1` shows
cooldown 0 because it followed condition D's drain rather than a cooldown timer;
this is a harness accounting detail, disclosed here, not a protocol violation —
D/run3 ended 22:16:25.470 and E/run1 began 22:16:29.427, a real gap of 3.96 s.
**This is a genuine deviation from the 60 s cooldown requirement** and is recorded
as such. It affects E/run1 only.

### 2.3 Other directories

| Directory | Contents | Subject to 3-run rule? |
|---|---|---|
| `phase0-20260804T202038Z` | Gate 0 evidence, channel config, harness source | No — not a measurement |
| `phase2-20260804T211001Z` | 7 conditions (A–G), 1 run each, W=10 | **No — dry run by design** |
| `probe-20260804T212237Z` | condition E, W=20 n=1000, 1 run each at clients ∈ {1,4,20} | **No — probe by design** |

Phase 2 and the probe are complete as designed. `phase2/.../resources.csv` exists
on **both** D1 and the laptop and is byte-identical.

### 2.4 Phases 4, 5 and 6

**MISSING in full.** No `phase4*`, `phase5*` or `phase6*` directory exists on D1
or on the laptop. These phases were never launched. There is no partial data, no
netem was ever applied, and no fault injection was ever performed.

---

## 3. Correction: `REPORT.md` §8.4 and §8.5 are factually wrong

`REPORT.md` (written on the laptop, 2026-08-04T21:33 local / 2026-08-05T03:33Z)
states in §8.4:

> `E/run1` captured **1,100 of 2,000 transactions** before the outage. […]
> No `manifest.json` was written […] Condition E requires a full re-run of all
> three runs when the testbed returns.

and in §8.5 marks E, F, G and H all as `0/3`.

**This is not what happened.** On D1, `E/run1` holds 2,000 records and a complete
manifest, and E/run2, E/run3 and F/run1 all completed cleanly afterwards.

What actually occurred is a **laptop-to-lab link loss at ~22:19:46Z**, mid-E/run1.
The lab continued running unattended for a further 18 minutes and completed three
more conditions' worth of runs. `REPORT.md` was then authored against the frozen
laptop snapshot and mistook it for the state of the testbed.

Corroborating evidence that no testbed outage occurred:

- **No node rebooted.** Uptimes at assessment: D1 17w3d, D2 17w3d, D3 18w5d,
  D4 5d23h. D4's boot predates the 2026-08-04 session.
- **No Raft election.** All three orderers report leader = node 1 (D4) at
  **term 4**, elected 2026-08-03T22:11:13Z and unchanged since. No election
  occurred before, during or after any Phase 3 run.
- **Ledger integrity intact.** All four peers agree on height and hash, and
  `F/run1`'s recorded `ledger_after` matches the live height exactly (§5).

**Action owed:** `REPORT.md` §8.4 and §8.5 must be corrected in Phase 9.
No edit has been made to `REPORT.md` in this session.

---

## 4. R4 — Environment re-verification (2026-08-09)

| Check | Result | Verdict |
|---|---|---|
| Node reachability | D1, D2, D3, D4 all responding | ✅ |
| Containers present | D1: peer0.org1, cc-unified · D2: peer0.org2, orderer2, cc-unified · D3: peer0.org3, orderer3, cc-unified · D4: peer0.org4, orderer, cc-unified | ✅ |
| Peer height | **26629** on all four | ✅ agree |
| currentBlockHash | `7nrCAz9FEgzTANcckeZbbCWXw/tGidsIoTDwdheamds=` on all four | ✅ agree |
| previousBlockHash | `1zti55n7dg5UtoR5K4/62e/XKghBxQvGaQzYe+wU8W8=` on all four | ✅ agree |
| Consenters | 3/3 `consensusRelation=consenter`, `status=active`, height 26629 (via `osnadmin` to :7053 on D4/D2/D3) | ✅ |
| Raft leader | **node 1 = D4 / orderer.example.com, term 4**, stable since 2026-08-03T22:11:13Z | ✅ identified |
| Chaincode sha256 | `46ae8a9f2cfcac4cf967ddcd0bf47e381f3f3377b8647b52c94dd39cb40ecff5` on all four | ✅ unchanged |
| Peer binary | v3.1.4, go1.26.0, all four | ✅ |
| qdisc | D1 `mq` + `fq_codel`; D2/D3/D4 `fq_codel` root | ✅ **no netem anywhere** |
| ledgersData size | 590 M per node | recorded |

Channel parameters in force, from `E/run1` manifest `channel_params`
(to be re-confirmed against a live fetch at Gate M4):
config_sequence **6**, BatchTimeout **50 ms**, MaxMessageCount **10**,
PreferredMaxBytes 2,097,152, AbsoluteMaxBytes 103,809,024,
endorsement rule **MAJORITY** (sub-policy `Endorsement`), three consenters,
Raft `tick_interval` 100 ms, `election_tick` 10, `heartbeat_tick` 1,
`max_inflight_blocks` 10, `snapshot_interval_size` 16,777,216.

---

## 5. R5 — State size, and a correction to the premise

Measured via `IntegrationContract:GetSupplyChainMetrics` on D1, the same method
used at Gate 0 (`GATE0_REPORT.md` §11).

| Counter | Gate 0 (2026-08-04 ~20:20Z) | Now (2026-08-09) | Δ |
|---|---|---|---|
| `activeActors` (`REPUTATION:`) | 32,047 | 37,561 | +5,514 |
| `totalRatings` (rating keys) | 33,146 | 38,660 | +5,514 |
| `linkedEvents` (`PROV_REP_LINK:`) | 16,299 | 18,063 | +1,764 |
| `totalDisputes` (`DISPUTE:`) | 0 | 0 | 0 |
| **Counted keys, three working classes** | **81,492** | **94,284** | **+12,792 (+15.7 %)** |

`totalAssets` reads 0 at both checkpoints. This is the known defect recorded at
Gate 0 — assets are stored under bare asset IDs with no key prefix, so the range
scan in `GetSupplyChainMetrics` cannot match them. **Asset count is not measured.**
No estimate is substituted. Total LevelDB key count remains unobtainable
read-only; `ledgerutil` in this build exposes only `compare`, `identifytxs` and
`verify`.

### 5.1 The stated confound does not exist in the form assumed

The brief anticipated that a condition re-run today would sit on a state database
grown by five days of drift. **It has not.**

`F/run1`'s `ledger_after` records height **26629** at 2026-08-04T22:36:15.959Z.
The live height on 2026-08-09 is **26629**, with identical current and previous
block hashes. **The ledger has not advanced by a single block in five days.** The
network has been entirely quiescent since the session ended.

It follows that all +12,792 keys were written **by the 2026-08-04 session itself**
(Phase 2 dry run plus Phase 3 conditions A–F), not by any intervening activity.

Consequences for the re-run plan:

- There is **no cross-day state drift**. A condition re-run today begins on a
  ledger byte-identical to the one `F/run1` ended on.
- The confound that does exist is **intra-session ordering**: condition A ran at
  roughly 81.5 k keys and F at roughly 94.3 k. That gradient was already present
  on 2026-08-04 and is unchanged by resuming now.
- This is a materially weaker and more defensible disclosure than
  "today's runs sit on a larger database than yesterday's". It should be reported
  in those terms.

The state-size checkpoint above stands as checkpoint 2 of the four planned
state-growth checkpoints.

---

## 6. Two defects to fix before any new measurement

### 6.1 The resource sampler failed silently

`phase3-20260804T213214Z/resources.csv` contains 17,020 samples spanning
2026-08-04T21:32:14.552Z → **22:19:46.370Z**, across nodes D1 (4,255 rows),
D2 (4,257), D3 (4,254), D4 (4,254). It stopped at the moment the laptop link
dropped, emitted no error, and nothing detected the loss.

Coverage per run, computed against that window:

| Runs | Resource coverage |
|---|---|
| A/run1–3, B/run1–3, C/run1–3, D/run1–3, E/run1 | **FULL** |
| E/run2, E/run3, F/run1 | **NONE** |

Phase 3 requires a per-container resource summary per condition (median, p95, max
CPU and memory, plus idle baseline), separating the orderer leader (D4) from the
followers (D2, D3). Condition E currently satisfies this for one run of three;
condition F for none.

**Required before Phase 4:** a liveness check or heartbeat on the sampler, so a
silent death is detected rather than discovered afterwards. Phase 4 is seven
concurrency levels × three runs and cannot absorb an undetected data loss.

### 6.2 Post-run convergence at concurrency is very large — and is itself a finding

From each manifest's `ledger_convergence`:

| Condition | W | wait_ms | polls |
|---|---|---|---|
| A/run1–3 | 1 | 246 / 469 / 225 | 1 / 1 / 1 |
| B/run1–3 | 1 | 264 / 460 / 340 | 1 / 1 / 1 |
| C/run1–3 | 1 | 1,529 / 339 / 215 | 2 / 1 / 1 |
| D/run1–3 | 1 | 225 / 220 / 218 | 1 / 1 / 1 |
| **E/run1–3** | **20** | **65,050 / 76,173 / 73,547** | **48 / 56 / 54** |
| **F/run1** | **20** | **77,804** | **57** |

Sequential conditions converge in roughly 250 ms. The W=20 concurrent conditions
take 65–78 seconds — a factor of roughly 300. This is why the convergence timeout
had to be raised to 180 s after the clients=4 and clients=20 probes timed out.

Two implications:

1. **Operational.** At W=200 the convergence wait may exceed 180 s. Phase 4 should
   raise the timeout pre-emptively rather than discover the ceiling by timing out
   and discarding runs.
2. **Scientific.** A 300× convergence penalty that appears only under concurrency
   is a result in its own right, and one the manuscript does not currently
   accommodate. It sits naturally alongside the block-occupancy material that
   §6.1 of `REPORT.md` already flags as homeless.

---

## 7. Risk carried into Phases 5 and 6

D1 cannot SSH to D2, D3 or D4 (verified at Gate 0: publickey denied to all three
and to itself). Every per-node `tc qdisc` change in Phase 5 and every
`docker stop` in Phase 6 is therefore issued **from the laptop**.

The exact failure mode that ended the 2026-08-04 session was a loss of the
laptop-to-lab link. In Phase 5 that same failure would leave netem applied on four
nodes with no path to remove it, and the emulated-WAN delay would silently
contaminate every subsequent measurement.

The Phase 5a safety net — `(sleep 2700; tc qdisc del dev <iface> root) &` on each
node before any qdisc is applied — is therefore **load-bearing, not a formality**.
Its presence will be verified on all four nodes before a single qdisc is applied,
and the verification recorded.

---

## 8. Re-run plan

1. **A, B, C, D are not re-run.** Three valid runs each, invariant holds, all four
   peers agree, full resource coverage. Done.

2. **E, F, G, H are run contiguously in a single session**, three runs each,
   `--clients=1`, 60 s cooldowns, E/F/G at W=20 n=2000 and H at W=20 n=500.
   - F is PARTIAL, so per R3 all three runs are taken fresh. It is **not**
     topped up from `F/run1`.
   - Existing `E/run1–3` and `F/run1` are **retained on disk and disclosed**, not
     deleted. `F/run2` (empty) is retained as evidence of the stop point.
   - Session boundaries are recorded in each new manifest.

3. **Open decision — whether E is re-run.** E is transaction-complete (3 valid
   runs, 2000/2000 committed each) but carries resource data for only one run of
   three. Options:
   - **(a) Re-run E** — recommended. Resource summary per condition is a stated
     Phase 3 deliverable; the cost is roughly 15 minutes; and it places E, F, G
     and H in one contiguous session on identical ledger state, which is what R3
     asks for.
   - **(b) Keep E as measured** and publish it with an explicit footnote that two
     of its three runs have no resource data.

   This decision is owed before the re-run begins.

4. **Preconditions before starting:** sampler liveness check in place (§6.1);
   convergence timeout raised above 180 s (§6.2); `collect_env.sh` re-run to
   regenerate `env.json`, since container start times and image digests have
   changed since 2026-08-04.

5. **Then** Phase 4 (prediction already on record and unmodified), Phase 5, Phase 6.
   Phase 7 remains gated on M4. Phase 8 is laptop-only and independent of the lab
   testbed.

---

## 9. Deviations from the plan, recorded

| # | Deviation | Detail |
|---|---|---|
| 1 | E/run1 cooldown | Observed 3.96 s, not 60 s. Followed condition D's drain. Affects E/run1 only. §2.2. |
| 2 | Resource data missing | E/run2, E/run3, F/run1 have no resource samples. Sampler died 22:19:46Z. §6.1. |
| 3 | `REPORT.md` §8.4/§8.5 incorrect | Describe a stale laptop snapshot as testbed state. Correction owed in Phase 9. §3. |
| 4 | Asset count unmeasured | `GetSupplyChainMetrics.totalAssets` defect, carried from Gate 0. No estimate substituted. §5. |
| 5 | Total LevelDB key count unobtainable | `ledgerutil` lacks the capability in this build. Three working key classes reported instead. §5. |

No run has been discarded. No pre-registered exclusion criterion (Raft election
during the window; `submitted ≠ committed + errors`) fired on any of the sixteen
valid runs.

---

**GATE R held.** Awaiting go-ahead, and the decision at §8.3 on condition E.
