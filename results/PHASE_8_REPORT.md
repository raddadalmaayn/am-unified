# PHASE 8 REPORT — single-host two-organization re-run

**Session:** 2026-08-10, 04:03:00Z → 04:31:19Z (primary set), with three
supplementary sets at 20:28Z–20:55Z
**Directories:** `phase8-20260810T040300Z` (primary), `phase8b-20260810T202806Z`,
`phase8c-nosampler-20260810T205116Z`, `phase8d-seqcheck-20260810T205432Z`
**Harness:** bench.js v2.1.0, `--clients=1`, 60 s cooldowns
**Testbed:** two-organization single-host network, LAPTOP ONLY, run alone

Every figure in this document was read from a file on disk or from a live query.
Nothing is estimated or interpolated. Where a quantity cannot be measured it is
named as unmeasured and no substitute is offered. Contradictions against earlier
reports — including one against a claim I made earlier in this session — are
stated explicitly in §11.

---

## 1. 8a — ENVIRONMENT. The manuscript's version claim is CORRECT here

**The single-host testbed runs Hyperledger Fabric v3.1.0.**

| Component | Version | Commit SHA | Go |
|---|---|---|---|
| peer (container) | **v3.1.0** | 8f08391 | go1.24.0 |
| orderer (container) | **v3.1.0** | 8f08391 | go1.24.0 |
| peer CLI (host) | **v3.1.0** | 8f08391 | go1.24.0 |
| configtxlator (host) | **v3.1.0** | 8f08391 | — |

Image digests, not tags (amendment D1, `:latest` is not pinned):

| Image | Digest |
|---|---|
| hyperledger/fabric-peer:latest | `sha256:d0c8e53735626da30d66cdc8b81406d45458583d3779be4a1a2aac1eba84e01c` |
| hyperledger/fabric-orderer:latest | `sha256:ac3b801a6da5c056e967e9738b0a998df5f9b159df6986196406a757cd03c075` |

This resolves the `TODO(phase8)` at manuscript §5.1, which has never been
verified.

### 1.1 This NARROWS the Gate 0 correction item, and the narrowing matters

`REPORT.md` §1.1 measured the four-node lab at **v3.1.4** against a stated
v3.1.0, and listed **seven** manuscript locations for correction. Phase 8 shows
that list is too broad: the manuscript describes **two different testbeds**, and
the v3.1.0 claim is correct for one of them.

| Manuscript location | Which testbed | Measured | Correction needed? |
|---|---|---|---|
| §4.2 CCAAS Deployment — "a two-organization Fabric v3.1.0 network via CCAAS" | single-host | v3.1.0 | **NO — correct as written** |
| §5.1 Experimental Setup — "running a two-organization Fabric v3.1.0 network" | single-host | v3.1.0 | **NO — correct as written** |
| §4.4 Distributed testbed | four-node lab | v3.1.4 | **YES** |
| §3.1 Design Rationale — "the underlying Hyperledger Fabric v3.1.0 infrastructure" | ambiguous | both exist | **Disambiguate, then correct only if it refers to the lab** |
| §3.1 Figure 1 infra bar label | ambiguous | both exist | same |
| §1.2 Contributions — "CCAAS deployment on Hyperledger Fabric v3.1.0" | ambiguous | both exist | same |
| Abstract Fabric version claim | ambiguous | both exist | same |

**Applying the Gate 0 correction as a blanket find-and-replace would have
introduced new errors into the paper in the two places it was already right.**
Four locations are ambiguous and need the author to say which testbed they mean
before any edit. No .tex file has been touched.

### 1.2 Channel configuration

The Tables 6/7 environment used BatchTimeout = 10 ms, which is a **channel
update** applied in March 2026, not a template value. That configuration lived
only in the running channel and did not survive teardown, so it was rebuilt.

| Parameter | As shipped (seq 2) | After tuning (seq 3) | Lab, for comparison |
|---|---|---|---|
| BatchTimeout | 50 ms | **10 ms** | 50 ms |
| MaxMessageCount | 100 | **100** | **10** |
| PreferredMaxBytes | 524,288 | **2,097,152** | 2,097,152 |
| AbsoluteMaxBytes | 103,809,024 | 103,809,024 | 103,809,024 |
| tick_interval | 500 ms | **100 ms** | 100 ms |
| election_tick / heartbeat_tick | 10 / 1 | 10 / 1 | 10 / 1 |
| max_inflight_blocks | 5 | **10** | 10 |
| Endorsement | MAJORITY | MAJORITY | MAJORITY |
| Consenters | 1 (single orderer) | 1 | 3 (Raft) |

Verified by independent re-fetch and decode after the update: config sequence
incremented 2 → 3 and every target field took the intended value. Both decoded
configs are archived as `channel_config_asshipped.json` and
`channel_config_verified.json`.

**`MaxMessageCount` is 100 here against 10 on the lab.** Any occupancy comparison
between the two testbeds must be expressed as a fraction of budget, not as a raw
`tx_per_block`.

### 1.3 Chaincode and state

| Item | Value |
|---|---|
| Chaincode source commit | `9a9db0ef541d2e400effdb08e3b4a135692a2c10` (identical to the lab) |
| Chaincode tree dirty | false |
| Binary SHA-256, both peers | `41f333d6ffcab44b5d2c3f50fb2797ddd21a6093d9c0a17a9836033623029cbe` |
| Package ID, org1 and org2 | `unified_1.0:e41a6a4fdeb3050ef7bd45952b4772e5baf0474c553c2928b619916caa2a6153` |
| Containers | peer0.org1, peer0.org2, orderer, ca_org1, ca_org2, ca_orderer, peer0org1_unified_ccaas, peer0org2_unified_ccaas |
| Host | 20-core Intel i7-13700H, 15.2 GB RAM, governor `powersave` |
| Ledger height at Phase 8 start | 9 |
| counted_keys at Phase 8 start | 7,509 |

The binary digest differs from the lab's `46ae8a9f…` because it is a separate
build of the same source commit. Same source, different compilation.

---

## 2. Per-run verification

24 runs. **Every run's invariant held, both peers agreed on height and current
block hash, no netem, chaincode digest matched on both peers.**

| Run | submitted = committed + errors | Invariant | Peers agree (h, hash) | netem | cc sha256 | Resource coverage |
|---|---|---|---|---|---|---|
| A/run1 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| A/run2 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| A/run3 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| B/run1 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| B/run2 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| B/run3 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| C/run1 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| C/run2 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| C/run3 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| D/run1 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| D/run2 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| D/run3 | 500 = 500 + 0 | OK | True, True | null | match | FULL |
| E/run1 | 2000 = 2000 + 0 | OK | True, True | null | match | PARTIAL |
| E/run2 | 2000 = 2000 + 0 | OK | True, True | null | match | PARTIAL |
| E/run3 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| F/run1 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| F/run2 | 2000 = 2000 + 0 | OK | True, True | null | match | PARTIAL |
| F/run3 | 2000 = 2000 + 0 | OK | True, True | null | match | PARTIAL |
| G/run1 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| G/run2 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| G/run3 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| H/run1 | 500 = 9 + 491 | OK | True, True | null | match | FULL |
| H/run2 | 500 = 9 + 491 | OK | True, True | null | match | FULL |
| H/run3 | 500 = 9 + 491 | OK | True, True | null | match | PARTIAL |

**No run met a pre-registered exclusion criterion.** Nothing was discarded.
The five PARTIAL coverage verdicts are a sampling-granularity artifact on very
short runs, not missing data — see §9, deviation 3.

### 2.1 Run timeline

| Run | Start (UTC) | End (UTC) | Duration | Cooldown observed (ms) |
|---|---|---|---|---|
| A/run1 | 04:03:08.269 | 04:03:32.880 | 24.6 s | 0 (first) |
| A/run2 | 04:04:33.788 | 04:05:01.816 | 28.0 s | 60,724 |
| A/run3 | 04:06:01.983 | 04:06:26.192 | 24.2 s | 60,003 |
| B/run1 | 04:07:26.333 | 04:07:52.847 | 26.5 s | 60,006 |
| B/run2 | 04:08:53.049 | 04:09:17.047 | 24.0 s | 60,001 |
| B/run3 | 04:10:17.203 | 04:10:42.854 | 25.7 s | 60,008 |
| C/run1 | 04:11:43.006 | 04:12:07.809 | 24.8 s | 60,004 |
| C/run2 | 04:13:07.982 | 04:13:35.810 | 27.8 s | 60,009 |
| C/run3 | 04:14:35.977 | 04:15:01.020 | 25.0 s | 60,007 |
| D/run1 | 04:16:01.199 | 04:16:05.282 | 4.1 s | 60,002 |
| D/run2 | 04:17:05.465 | 04:17:09.485 | 4.0 s | 60,005 |
| D/run3 | 04:18:09.671 | 04:18:13.677 | 4.0 s | 60,001 |
| E/run1 | 04:19:14.515 | 04:19:19.787 | 5.3 s | 0 (new invocation) |
| E/run2 | 04:20:19.995 | 04:20:25.666 | 5.7 s | 60,005 |
| E/run3 | 04:21:25.840 | 04:21:31.438 | 5.6 s | 60,003 |
| F/run1 | 04:22:31.643 | 04:22:37.793 | 6.2 s | 60,007 |
| F/run2 | 04:23:38.122 | 04:23:43.904 | 5.8 s | 60,003 |
| F/run3 | 04:24:44.127 | 04:24:50.260 | 6.1 s | 60,010 |
| G/run1 | 04:25:50.540 | 04:25:57.313 | 6.8 s | 60,006 |
| G/run2 | 04:26:57.605 | 04:27:03.721 | 6.1 s | 60,004 |
| G/run3 | 04:28:04.150 | 04:28:10.416 | 6.3 s | 60,010 |
| H/run1 | 04:29:11.403 | 04:29:13.243 | 1.8 s | 0 (new invocation) |
| H/run2 | 04:30:13.588 | 04:30:15.453 | 1.9 s | 60,002 |
| H/run3 | 04:31:15.833 | 04:31:17.669 | 1.8 s | 60,006 |

Cooldowns held at 60 s throughout. The two zero entries are the first run of a
new bench.js invocation, not skipped cooldowns; a manual 60 s sleep separated the
invocations (see §9, deviation 1).

---

## 3. Latency and throughput

Median across three runs, computed from `txs.jsonl` only.

| Cond | Workload | W | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse P50 | Ord+Commit P50 | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | seq provenance | 1 | 1500 | 1500 | 0 | 48.6 | 47.3 | 60.3 | 69.9 | 12.3 | 35.0 | 20.50 |
| B | seq reputation | 1 | 1500 | 1500 | 0 | 50.9 | 48.8 | 62.5 | 67.8 | 14.1 | 34.3 | 19.57 |
| C | seq bridge | 1 | 1500 | 1500 | 0 | 49.5 | 50.1 | 53.4 | 55.2 | 16.4 | 33.7 | 20.11 |
| D | read | 1 | 1500 | 1500 | 0 | 7.6 | 7.6 | 9.0 | 9.6 | n/a | n/a | 131.14 |
| E | conc provenance | 100 | 6000 | 6000 | 0 | 244.9 | 243.1 | 309.4 | 343.5 | 87.6 | 152.2 | 390.71 |
| F | conc reputation | 100 | 6000 | 6000 | 0 | 272.6 | 259.5 | 353.5 | 397.2 | 99.8 | 155.5 | 351.21 |
| G | conc bridge | 100 | 6000 | 6000 | 0 | 281.6 | 274.5 | 368.9 | 409.0 | 104.5 | 167.4 | 346.46 |
| H | high contention | 100 | 1500 | **27** | **1473** | 229.4 | 225.9 | 284.9 | 284.9 | 87.7 | 147.8 | n/a |

**Read the absolute concurrent figures with §7 in hand: they are strongly
state-dependent.**

### 3.1 8d — the n=500 change, flagged explicitly

Sequential conditions ran **n=500 per run, three runs, 1,500 transactions per
condition**, against the **50** the manuscript reports for Tables 6 and 7.

**The Table 6 caption no longer describes what was measured.** Any caption
wording of the form "mean of 50 runs" is invalidated by this phase and must be
rewritten to state 1,500 transactions across three runs. This is flagged here
rather than left to be discovered.

The practical effect is on the tails: P99 over 1,500 samples is a meaningful
order statistic, whereas P99 over 50 is the second-worst observation.

---

## 4. 8e — THE MECHANISM TEST. Block production is limited by replication

This is the decisive comparison the phase exists for.

| | Single-host (2 peers, 1 orderer, no network) | Four-node lab (4 peers, 3-node Raft) |
|---|---|---|
| BatchTimeout | 10 ms | 50 ms |
| MaxMessageCount | 100 | 10 |
| Best block rate | **69.78 /s** (E, W=100) | **5.91 /s** (E, W=400) |
| Block interval | **14.3 ms** | **169 ms** |
| Block interval ÷ BatchTimeout | **1.43×** | **3.4× to 8.1×** |
| tx_per_block | 7.52 | 4.94 |
| Occupancy as % of budget | **7.5%** of 100 | **49.4%** of 10 |
| Peak steady TPS | **390.71** (W=100) | 23.34 (W=400) |

### 4.1 The answer: the constraint is replication, not the local commit path

**Block rate is 16× higher on a single host** — 69.78/s against 4.33/s at the
lab's W=200, or 11.8× against the lab's best-ever 5.91/s at W=400.

The plan posed the question as a disjunction. The answer is unambiguous:

- If the constraint were **local to the peer's commit path**, removing the
  network would have changed block rate little. It changed it by **more than an
  order of magnitude**.
- Therefore block production on the four-node testbed **is limited by
  replication and cross-machine block delivery**, exactly as the Phase 4
  mechanism hypothesised, even though Phase 4's quantitative predictions were
  falsified.

### 4.2 And the batching relationship inverts between testbeds

This is the sharpest part of the result:

- **Single-host: block interval 14.3 ms against a 10 ms BatchTimeout — a ratio
  of 1.43.** Blocks are being cut at close to the timeout. BatchTimeout is
  approximately binding here.
- **Lab: block interval 169–405 ms against a 50 ms BatchTimeout — ratios of 3.4
  to 8.1.** The timeout expires long before a block is cut. BatchTimeout is
  demonstrably not binding there.

So the same parameter is near-binding on one testbed and slack on the other, and
the difference is the presence of a network. This is direct evidence for what
Phase 7a is about to test on the lab, and it sharpens the Phase 7a prediction
already on record: if BatchTimeout is slack on the lab, raising it should change
nothing there.

**Neither testbed fills its blocks.** Occupancy is 7.5% of budget on single-host
and at most 49.4% on the lab. `MaxMessageCount` is not binding anywhere measured.

---

## 5. 8f — ledger convergence is trivially fast, and is NOT evidence for or against Phase 4

| Statistic | Single-host, all 24 runs | Four-node lab (Phase 4) |
|---|---|---|
| Convergence wait | **106–183 ms** | 0.3 s to 79.1 s |
| Polls to converge | **1, every run** | 1 to 66 |
| Peer last to converge | none observed lagging | **org2, every concurrent run** |

Every one of the 24 runs converged on the **first poll**. The measured value is
therefore an upper bound set by the poll interval, not a measurement of
convergence: the peers had already converged before the harness could look.

**8f asked whether the Phase 4 blocks-not-transactions relationship (r = 0.9886,
~145 ms/block) holds here. It cannot be tested on this testbed, and I am not
fitting a line to it.** The relationship describes how long a lagging peer takes
to drain a backlog. On a single host with two peers sharing a kernel there is no
measurable backlog to drain — convergence never exceeded 183 ms even for runs
producing 326 blocks.

This is a null result of the useful kind: it localises the Phase 4 convergence
finding to **cross-machine replication**, consistent with §4.1. The ~90 s of
invisible staleness that Phase 3B and Phase 4 documented on org2 is a property of
the distributed deployment, not of Fabric or of this chaincode.

---

## 6. 8g — client CPU, and what it does and does not establish

Sampled every 2 s. 100% = one core. Host has **20 cores**.

| Cond | Client CPU med % | Client CPU peak % | n samples | Total across all containers + client (median) | As cores | % of 20-core host |
|---|---|---|---|---|---|---|
| A | 29.7 | 34.6 | 33 | 98.9 | 0.99 | 4.9% |
| B | 23.2 | 31.3 | 34 | 103.9 | 1.04 | 5.2% |
| C | 20.1 | 23.7 | 35 | 107.1 | 1.07 | 5.4% |
| D | 34.0 | 39.7 | 6 | 157.2 | 1.57 | 7.9% |
| E | **122.9** | **132.5** | 7 | 407.7 | 4.08 | 20.4% |
| F | **118.9** | **127.4** | 7 | 478.3 | 4.78 | 23.9% |
| G | **115.5** | **126.2** | 9 | 530.7 | 5.31 | 26.5% |
| H | 45.8 | 103.6 | 3 | 144.8 | 1.45 | 7.2% |

### 6.1 What can be said

At W=100 the client consumes **more than one core** (122.9% median for E). That
is well above the 89.4% peak Phase 4 recorded at W=400 on the lab, at a quarter
of the concurrency — because here the client shares a host with the entire
Fabric network rather than sitting on a dedicated node.

**The host is not saturated**: the busiest condition (G) totals 5.31 cores of 20,
26.5%. So there is ample headroom and no evidence of host-level contention.

### 6.2 What CANNOT be said, stated plainly

A Node process exceeding 100% means native threads (TLS, gRPC, libuv pool) are
active alongside the JavaScript thread. **Cgroup CPU totals cannot separate the
single JS event loop from those native threads**, so these numbers do not
establish whether the event loop is saturated. The lab's `--clients=8` probe
cannot settle it either, because all eight clients share one Node process.

**Conditions E, F and G should be treated as lower bounds on system throughput.**
Establishing whether the client constrains them would require splitting the load
across multiple Node *processes*, which is not in this plan. This is offered as a
decision in §12.

### 6.3 Resource claims against the manuscript

The manuscript's ≤6% CPU and ≤150 MB claim fails here as it did on the lab, but
**less severely and for different reasons**. Peak memory: peer0.org1 375 MB,
peer0.org2 355 MB, orderer 354 MB — 2.4× the stated 150 MB, versus the lab's
orderer leader at 1,187 MB (7.9×). Peak CPU: peer0.org1 169.5% at W=100, far
above 6%.

---

## 7. State dependence — the finding that changes how Tables 6/7 must be quoted

Three supplementary sets were run to check an anomaly. They produce a clean and
important result.

| Set | Time (UTC) | Sampler | Height before | counted_keys before | E median TPS | tx/block | block rate /s |
|---|---|---|---|---|---|---|---|
| `phase8` | 04:19–04:21 | 2.0 s | 4,534–5,064 | **7,509** | **415.8** | 7.52 | 69.1 |
| `phase8b` | 20:28–20:30 | 0.5 s | 7,336–8,201 | **37,545** | **200.4** | 4.51 | 52.0 |
| `phase8c` | 20:51–20:53 | **none** | 11,740–12,546 | **67,584** | **207.0** | 5.01 | 46.8 |

### 7.1 The sampler is NOT the cause — I checked, and my first hypothesis was wrong

On seeing `phase8b` at half the throughput of `phase8`, I hypothesised that the
0.5 s sampler was perturbing the system it measured. **The no-sampler control
refutes that.** `phase8c` ran with no sampler at all and returned 207.0 TPS,
statistically indistinguishable from `phase8b`'s 200.4 with a 0.5 s sampler.

At matched epoch and matched state, **sampler rate has no material effect on
throughput**. The A1 node-local sampler is vindicated as an instrument.

### 7.2 The cause is state size, and a sequential control isolates it

A single condition-A run at 20:54Z returned **19.2 TPS** against the Phase 8
median of **20.50** — a 6% difference. So there is **no general host slowdown**
between the two epochs.

Sequential throughput is flat while concurrent throughput halved. That points at
the concurrent commit path degrading as the ledger and state database grow:

| | Phase 8 (04:19Z) | Later sets (20:28Z+) | Change |
|---|---|---|---|
| counted_keys | 7,509 | 37,545 → 67,584 | **5× to 9×** |
| Sequential (A) TPS | 20.50 | 19.2 | **−6%** |
| Concurrent (E) TPS | 415.8 | 200.4 / 207.0 | **−52%** |

### 7.3 Consequence for the manuscript

**Single-host concurrent throughput is not a single number; it is a function of
ledger state.** Any Table 7 figure must be quoted with the state size at which it
was taken, or it is not reproducible. The published figures were taken at an
unrecorded state size, so they cannot be placed on this curve.

Two caveats, stated rather than smoothed:

- State size and elapsed wall-clock time are **confounded**: the two epochs are
  16 hours apart. The condition-A control rules out a general host slowdown but
  does not prove state is the only variable.
- The drop is not linear in keys: 7.5k → 37.5k halved throughput, but 37.5k →
  67.6k changed nothing. A saturating relationship is consistent with the data;
  three points do not establish its shape and **no curve is fitted**.

---

## 8. Condition H, and a contrast with the lab

| | Single-host | Four-node lab (Phase 3B) |
|---|---|---|
| Submitted | 1,500 | 1,500 |
| Committed | **27 (1.8%)** | 83 (5.5%) |
| Failed | 1,473 | 1,417 |

Contention is **worse** on the faster testbed. This is consistent with the
mechanism: higher block rate means more concurrent read-write sets against the
same hot key per unit time, so a larger fraction conflict. Speed makes contention
worse, not better.

Per-class breakdown for H is in `analysis.json`. Ten complete raw error objects
are not reproduced here because the lab's Phase 3B report already carries them
for both dominant classes; the single-host class distribution is recorded in
`analysis.json` and `index.json` for anyone recomputing.

---

## 9. Deviations from the plan

| # | Deviation | Detail |
|---|---|---|
| 1 | **Three bench.js invocations, not one** | `--W` and `--n` apply to every condition in an invocation, so A–D (W=1 n=500), E–G (W=100 n=2000) and H (W=100 n=500) required separate invocations. A manual 60 s sleep separated them. Consequence: the first run of each invocation records `cooldown_observed_ms = 0` although a real 60 s gap elapsed. Visible in §2.1 at E/run1 and H/run1. |
| 2 | **The Tables 6/7 channel config was rebuilt, not preserved** | BatchTimeout = 10 ms came from a March 2026 channel update that lived only in the running channel. The channel was torn down, so this is a **reconstruction** of that environment from the documented parameters, not the original instance. Verified by re-fetch and decode (§1.2). |
| 3 | **Five runs recorded PARTIAL resource coverage** | Sampling granularity, not missing data. E/F/G runs last 5–7 s with ~4 s steady windows; at 2 s sampling that is 2–3 ticks against an expected 3. H lasts 1.8 s. The threshold was **not** relaxed to make them pass; the instrument was re-run at 0.5 s instead (`phase8b`), which is what surfaced §7. |
| 4 | **`resource_coverage.py` reported a phase-wide false NONE on first execution** | The node set was hardcoded to `D1–D4` while the single-host sampler labels its node `L1`, so it searched for rows that cannot exist. All 6,855 samples were present. Fixed by making the node set a `--nodes` parameter and recomputing. Second time this class of defect has appeared in the coverage tool; the first was the header-sort bug in Phase 3B. |
| 5 | **`occupancy.js` had two lab-specific hardcodes** | It asserted a four-org agreement check, making every single-host run print "4-peer agree: NO" when all peers in fact agreed (confirmed from 24/24 manifests); and it asserted `MaxMessageCount = 10`, which misstates single-host occupancy tenfold. Both now read from the run's own data, with `--mmc` supplying the value where the manifest could not record it. `occupancy.md` was regenerated. |
| 6 | **`channel_params` is an error string in every Phase 8 manifest** | `decodedChannelParams()` uses lab-only paths (`fabric-tools`, `/tmp/pe.sh`). The error is **left in place, not overwritten**; a `channel_params_verified_external` field was added carrying the independently fetched and decoded config, labelled with its provenance. |
| 7 | **A real harness bug was found and fixed: keystore/signcert pairing** | Every transaction failed with `access denied: channel [mychannel] creator org [Org1MSP]`. Cause: Admin's keystore held two keys (one from `network.sh -ca`, one added by re-enrollment) and `newSigner` took `keystore[0]` assuming it paired with `signcerts[0]`. It did not, so every signature was invalid. Fixed to select the key matching the certificate's public key. The bug would recur on any re-enrolled identity, including on the lab. All Phase 3B/4 data predates the fix and is unaffected (single-key keystores throughout). |
| 8 | **`bench.js` network identity made environment-overridable** | Rather than forking the harness for the single-host testbed, which would have made the two testbeds' manifests non-comparable. Defaults are unchanged, so every lab invocation behaves exactly as before. |
| 9 | **Supplementary sets were added beyond the plan** | `phase8b`, `phase8c` and `phase8d` were not in the plan. They exist to test, and then refute, a hypothesis I formed mid-phase (§7.1). All are archived with full per-transaction data. |
| 10 | **Ten raw error objects for H not reproduced in this report** | The class distribution is in `analysis.json`; Phase 3B already carries ten complete objects for each dominant class from the lab. Noted rather than silently omitted. |

---

## 10. Contradictions against earlier reports

1. **The Gate 0 correction item (§1.1) is too broad.** Two of its seven
   manuscript locations are correct as written because they describe the
   single-host testbed, which is genuinely v3.1.0. Four are ambiguous between
   testbeds. Only one is unambiguously wrong.

2. **Phase 4's mechanism hypothesis is CONFIRMED even though its numbers were
   falsified** (§4.1). Phase 4 reported the mechanism as "directionally supported,
   number wrong". Phase 8 upgrades that: removing the network raises block rate
   16×, which is direct positive evidence for replication as the constraint.

3. **Phase 3B and Phase 4's convergence finding is localised, not contradicted**
   (§5). It is a property of cross-machine replication; on a single host it
   vanishes entirely.

4. **My own statement earlier in this session was wrong.** On first seeing
   `phase8b`, I reported to the user that a large sampler-induced observer effect
   was "confirmed". The no-sampler control refutes it (§7.1). The sampler is not
   the cause; state size is the leading candidate. Recorded here as a correction
   because the wrong conclusion was communicated before the control existed.

---

## 11. What Phase 8 replaces in the manuscript

| Manuscript element | Phase 8 result |
|---|---|
| §5.1 `TODO(phase8)` Fabric version | **v3.1.0 confirmed**, commit 8f08391, digests recorded (§1) |
| Table 6 (sequential single-host) | A/B/C/D, §3. P50 47.3 / 48.8 / 50.1 / 7.6 ms, TPS 20.50 / 19.57 / 20.11 / 131.14 |
| Table 6 caption "50 runs" | **Invalidated** — now 1,500 transactions across three runs per condition (§3.1) |
| Table 7 (concurrent single-host) | E/F/G, §3, **with the state-dependence caveat of §7 attached** |
| Abstract single-host figures | Same as Tables 6/7, same caveat |
| §5.7, §6.1 block behaviour | §4 — occupancy 7.5% of budget, block interval 1.43× BatchTimeout |
| Two-testbed version disambiguation | §1.1 — four manuscript locations need the author to say which testbed |

---

## 12. Decisions owed

No decision blocks the remaining phases. Four items, with the defaults I will
follow unless told otherwise.

1. **Four manuscript locations are ambiguous about which testbed they describe**
   (§1.1). I cannot resolve this from the code; it needs the author.
   *Default: record the ambiguity in FINAL_REPORT.md and correct nothing.*

2. **Concurrent single-host throughput is state-dependent by a factor of two**
   (§7). Isolating state from elapsed time would need a fresh network at a
   controlled state size.
   *Default: report both epochs with their state sizes and fit no curve.*

3. **E/F/G are lower bounds pending a multi-process client test** (§6.2).
   *Default: state the bound, do not re-run.*

4. **Condition H raw error objects** are recorded in `analysis.json` but not
   transcribed into this report (§9, deviation 10).
   *Default: transcribe them into FINAL_REPORT.md if the class distribution
   differs materially from the lab's.*

---

## 13. Status

Phase 8 is complete and archived. The single-host network is left **running** so
it need not be rebuilt if follow-up is wanted; it is idle and holds no netem.

The four-node lab has been unreachable since approximately 23:55Z on 2026-08-09
(ping fails, port 22 closed, no route to 10.12.10.x / 10.12.11.x from the
laptop). **The lab was left clean**: `netem_in_effect` is null in all 38 Phase
3B/4 manifests, Phase 6 injection never started, and the node-local samplers were
stopped and collected at 23:39:49Z. A watcher is polling D1 port 22 every 60 s.

Phases 6, 5, Gate M4 and 7 all require the lab and cannot start until it returns.
Phase 10 is a written assessment requiring no runs and can proceed meanwhile.
