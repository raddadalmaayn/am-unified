# PHASE 3B REPORT — conditions E, F, G, H

**Session:** 2026-08-09, 21:07:08Z → 21:57:36Z
**Directory:** `phase3b-20260809T210708Z` (D1 and laptop)
**Harness:** bench.js v2.1.0, schema v1, `--clients=1`, 60 s cooldowns
**Decisions in force:** DR1 (E re-run), DR2 (new directory, nothing deleted),
DR3 (reproducibility check), DR4 (state gradient disclosed)
**Amendments in force:** A1–A5

Every figure in this document was read from a file on disk or from a live query
against the testbed. Nothing is estimated or interpolated. Where a quantity
cannot be measured it is named as unmeasured and no substitute is offered.
Contradictions against earlier reports are stated explicitly rather than
resolved silently — see §9.

---

## 1. What ran

Twelve runs, contiguous in one session, on a ledger byte-identical to the one
the 2026-08-04 session left behind (height 26629, matching block hashes, no
intervening activity — established in `GATE_R_REPORT.md` §5.1).

| Condition | Workload | W | n per run | Runs |
|---|---|---|---|---|
| E | concurrent provenance write | 20 | 2000 | 3 |
| F | concurrent reputation write | 20 | 2000 | 3 |
| G | concurrent bridge write | 20 | 2000 | 3 |
| H | high contention (single hot key) | 20 | 500 | 3 |

All 2026-08-04 data was retained (DR2). `phase3-20260804T213214Z` still holds
E/run1–3, F/run1 and the empty F/run2 directory.

---

## 2. Per-run verification

| Run | submitted = committed + errors | Invariant | Peers agree (h, hash) | netem | cc sha256 all 4 | Resource coverage |
|---|---|---|---|---|---|---|
| E/run1 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| E/run2 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| E/run3 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| F/run1 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| F/run2 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| F/run3 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| G/run1 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| G/run2 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| G/run3 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| H/run1 | 500 = 27 + 473 | OK | True, True | null | match | FULL |
| H/run2 | 500 = 28 + 472 | OK | True, True | null | match | FULL |
| H/run3 | 500 = 28 + 472 | OK | True, True | null | match | FULL |

Chaincode digest `46ae8a9f2cfcac4cf967ddcd0bf47e381f3f3377b8647b52c94dd39cb40ecff5`
verified on all four nodes at session start and recorded in every manifest.
No netem was applied at any point. Every run converged with all four peers
agreeing on height **and** current block hash.

**No run met a pre-registered exclusion criterion.** No Raft election occurred
during the session (§8), and the invariant held on all twelve runs. Nothing was
discarded.

### Run timeline

| Run | Start (UTC) | End (UTC) | Duration | Cooldown observed (ms) |
|---|---|---|---|---|
| E/run1 | 21:07:21.367 | 21:09:59.798 | 158.4 s | 0 (first run) |
| E/run2 | 21:12:24.716 | 21:15:30.594 | 185.9 s | 60,000 |
| E/run3 | 21:18:04.337 | 21:20:52.322 | 168.0 s | 60,001 |
| F/run1 | 21:23:22.694 | 21:26:08.872 | 166.2 s | 60,000 |
| F/run2 | 21:28:39.318 | 21:31:16.687 | 157.4 s | 60,001 |
| F/run3 | 21:33:43.007 | 21:36:39.120 | 176.1 s | 60,000 |
| G/run1 | 21:39:12.203 | 21:41:51.726 | 159.5 s | 60,002 |
| G/run2 | 21:44:14.789 | 21:47:12.703 | 177.9 s | 60,000 |
| G/run3 | 21:49:33.881 | 21:52:14.665 | 160.8 s | 60,000 |
| H/run1 | 21:54:39.704 | 21:54:52.684 | 13.0 s | 60,002 |
| H/run2 | 21:55:54.962 | 21:56:08.577 | 13.6 s | 60,006 |
| H/run3 | 21:57:11.876 | 21:57:26.487 | 14.6 s | 60,000 |

The 60 s cooldown held on every run that had a predecessor. E/run1 shows 0
because it is the first run of the session, not because a cooldown was skipped.

---

## 3. Latency and throughput

Median across three runs, computed from `txs.jsonl` only.

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse P50 ms | Order+Commit P50 ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E conc provenance | 3 | 6000 | 6000 | 0 | 1701.2 | 1609.2 | 2641.7 | 3300.2 | 396.1 | 1227.8 | 11.70 |
| F conc reputation | 3 | 6000 | 6000 | 0 | 1676.4 | 1597.0 | 2613.6 | 3248.9 | 405.6 | 1164.4 | 11.93 |
| G conc bridge | 3 | 6000 | 6000 | 0 | 1635.9 | 1557.3 | 2561.3 | 2899.6 | 426.9 | 1109.7 | 12.14 |
| H high contention | 3 | 1500 | **83** | **1417** | 516.2 | 453.1 | 836.3 | 989.5 | 133.6 | 329.1 | 2.68 |

**E, F and G are statistically indistinguishable.** Steady TPS spans 11.70–12.14
across three different workloads — provenance write, reputation write, and the
atomic bridge transaction that does both. The bridge is not measurably more
expensive than either half of it. Per-run spread within each condition
(E: 10.51–12.57, F: 11.19–12.52, G: 11.09–12.37) is wider than the gap between
conditions, so no ordering between them is supported by this data.

H's latency figures describe only the 83 transactions that committed and rest on
`steady_count` of 23, 24 and 24 — the harness flagged all three runs as weakly
supported. They should not be quoted as a latency result.

---

## 4. Block occupancy and ledger reconciliation

| Run | committed | blocks (height_delta) | tx/block | block rate /s (steady) | 4-peer height_delta identical |
|---|---|---|---|---|---|
| E/run1 | 2000 | 576 | 3.47 | 3.85 | yes |
| E/run2 | 2000 | 661 | 3.03 | 3.70 | yes |
| E/run3 | 2000 | 608 | 3.29 | 3.79 | yes |
| F/run1 | 2000 | 588 | 3.40 | 3.73 | yes |
| F/run2 | 2000 | 552 | 3.62 | 3.68 | yes |
| F/run3 | 2000 | 624 | 3.21 | 3.72 | yes |
| G/run1 | 2000 | 563 | 3.55 | 3.71 | yes |
| G/run2 | 2000 | 610 | 3.28 | 3.71 | yes |
| G/run3 | 2000 | 574 | 3.48 | 3.71 | yes |
| H/run1 | 27 | 34 | 0.79 | 50.85 (see below) | yes |
| H/run2 | 28 | 38 | 0.74 | 33.99 (see below) | yes |
| H/run3 | 28 | 39 | 0.72 | 27.79 (see below) | yes |

Ledger reconciliation passes on every run: all four peers report identical
`height_delta`.

**Block rate at W=20 is extraordinarily stable: 3.68–3.85 /s across nine runs of
three different workloads.** tx_per_block sits at 3.03–3.62 against a
`MaxMessageCount` of 10, so blocks are running roughly a third full. This is
recorded here as measurement; the Phase 4 sweep is what tests the mechanism, and
the Phase 4 prediction remains on record unmodified.

Two disclosures on the H rows:

- **H's `block_rate_per_s` steady-window figure is an artifact and must not be
  quoted.** It divides blocks by a steady window containing ~24 transactions.
  The total-window rate (2.99, 2.68, 2.14) is the meaningful one.
- **H's tx_per_block is below 1.0, which is not a measurement error.**
  `tx_per_block` is computed as *committed* ÷ blocks, but blocks also carry
  transactions that fail validation. Under high contention most transactions
  reach a block and are then marked invalid, so committed-per-block falls below
  one. The metric understates true block occupancy exactly when the failure rate
  is high. This affects H only; E, F and G committed 100%.

---

## 5. Failure breakdown — condition H

1,417 failures out of 1,500 submitted (94.5% failure rate). Two classes, both
far above 1%, so both carry raw error objects per the reporting requirement.

| Class | H/run1 | H/run2 | H/run3 | Total | % of failures |
|---|---|---|---|---|---|
| ENDORSE_MISMATCH | 292 | 253 | 280 | **825** | 58.2% |
| MVCC_READ_CONFLICT | 181 | 219 | 192 | **592** | 41.8% |
| PHANTOM_READ_CONFLICT | 0 | 0 | 0 | 0 | — |
| ENDORSEMENT_POLICY_FAILURE | 0 | 0 | 0 | 0 | — |
| CHAINCODE_REJECT | 0 | 0 | 0 | 0 | — |
| GATEWAY_DEADLINE | 0 | 0 | 0 | 0 | — |
| GATEWAY_UNAVAILABLE | 0 | 0 | 0 | 0 | — |
| ORDERER_UNAVAILABLE | 0 | 0 | 0 | 0 | — |
| COMMIT_TIMEOUT | 0 | 0 | 0 | 0 | — |
| OTHER | 0 | 0 | 0 | 0 | — |

Zero unclassified failures across all three runs.

### 5.1 The dominant failure mode is not the one that was expected

Prior work on this testbed characterised high contention as an **MVCC** problem —
the April notes record a "99% MVCC conflict rate" and the Phase 3 plan carried
the same expectation.

Measured here, **MVCC is the minority class.** The majority, 58.2%, is
`ENDORSE_MISMATCH`: the endorsing peers returned *different* read-write sets for
the same proposal, so the transaction could never be assembled and never reached
the orderer at all.

These are different failures at different stages with different costs:

| | ENDORSE_MISMATCH | MVCC_READ_CONFLICT |
|---|---|---|
| Stage | endorsement, before assembly | commit-time validation |
| `tx_id` | **null** — never assigned | assigned |
| `validation_code` | null | 11 |
| Reaches the orderer | no | yes |
| Consumes block space | no | **yes** |
| Median total latency | ~292–407 ms | ~306–571 ms |

The practical consequence: 825 of the 1,417 failures never consumed ordering or
block capacity, while 592 did. A contention model that assumes MVCC is the whole
story overstates the load that contention places on the ordering service by
roughly 1.4×.

The raw records name the disagreeing peers directly — `peer0.org3` and
`peer0.org4` are the ones reporting `ProposalResponsePayloads do not match`,
with `peer0.org1` acting as the gateway peer.

### 5.2 Ten complete raw error objects, ENDORSE_MISMATCH

Verbatim from `H/run1/txs.jsonl`. Note `tx_id: null` and `validation_code: null`
throughout — the signature of a failure before transaction assembly.

```json
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":12,"seq":47,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242110994390","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":291.593438,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match | peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":11,"seq":48,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242113089343","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":291.254472,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match | peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":17,"seq":49,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242114075271","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":291.605841,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match | peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":16,"seq":46,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242109092642","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":297.740835,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match | peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":10,"seq":52,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242117091541","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":387.642722,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match | peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":2,"seq":51,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242115928462","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":394.817361,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match | peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":7,"seq":50,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242115046423","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":399.997678,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match | peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":1,"seq":54,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242118542320","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":401.732872,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match | peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":4,"seq":55,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242119201382","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":403.773425,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match | peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":0,"seq":53,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":null,"t_submit_ns":"10630242117869289","t_endorsed_ns":null,"t_submitted_ns":null,"t_committed_ns":null,"latency_endorse_ms":null,"latency_order_commit_ms":null,"latency_total_ms":407.358259,"status":"FAILED","error_class":"ENDORSE_MISMATCH","error_code":"10","validation_code":null,"error_raw":"EndorseError: 10 ABORTED: failed to collect enough transaction endorsements, see attached details for more info :: peer0.org3.example.com:7051(Org3MSP): ProposalResponsePayloads do not match | peer0.org4.example.com:8051(Org4MSP): ProposalResponsePayloads do not match","warmup":true}
```

### 5.3 Ten complete raw error objects, MVCC_READ_CONFLICT

Verbatim from `H/run1/txs.jsonl`. Note these carry a `tx_id` and
`validation_code: 11` — they reached a block and were rejected at validation.

```json
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":18,"seq":18,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"8f80af6a7e670189d7edef4fb616ff0dfb04a948f6cf9f4d4a59522c82ce3f36","t_submit_ns":"10630240935643619","t_endorsed_ns":"10630240977836731","t_submitted_ns":"10630240992194085","t_committed_ns":"10630241241693638","latency_endorse_ms":42.193112,"latency_order_commit_ms":263.856907,"latency_total_ms":306.050019,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":4,"seq":4,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"2a8cdfe8a29c9d15715f9564c94366884d416973d29afc1e687e7dab7199f257","t_submit_ns":"10630240924780069","t_endorsed_ns":"10630240967035891","t_submitted_ns":"10630240989813912","t_committed_ns":"10630241245714614","latency_endorse_ms":42.255822,"latency_order_commit_ms":278.678723,"latency_total_ms":320.934545,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":2,"seq":2,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"7bb30574d25527e7429c2826baf84fd0336ed0e8fd06e9e9a092054b21210451","t_submit_ns":"10630240923038222","t_endorsed_ns":"10630240962994744","t_submitted_ns":"10630240972966684","t_committed_ns":"10630241246744070","latency_endorse_ms":39.956522,"latency_order_commit_ms":283.749326,"latency_total_ms":323.705848,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":14,"seq":14,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"5396b46579d91d8d200e15db29b7c6513ea0745034e3c70d4f701422c68089a6","t_submit_ns":"10630240932501192","t_endorsed_ns":"10630240970673238","t_submitted_ns":"10630240987860907","t_committed_ns":"10630241248599087","latency_endorse_ms":38.172046,"latency_order_commit_ms":277.925849,"latency_total_ms":316.097895,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":8,"seq":8,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"aa26733c8274cbaac60cad44ad843af25a78111d88560835b8a491daa016b49a","t_submit_ns":"10630240928045890","t_endorsed_ns":"10630240965991477","t_submitted_ns":"10630240986088450","t_committed_ns":"10630241250051344","latency_endorse_ms":37.945587,"latency_order_commit_ms":284.059867,"latency_total_ms":322.005454,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":11,"seq":11,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"6e6b074b8972b502f5444865de218d921368236448c03e379cb2ce19ef87a38c","t_submit_ns":"10630240930380640","t_endorsed_ns":"10630240968064064","t_submitted_ns":"10630240991125522","t_committed_ns":"10630241250933418","latency_endorse_ms":37.683424,"latency_order_commit_ms":282.869354,"latency_total_ms":320.552778,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":7,"seq":7,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"bc2fec5c3d5f1d94e23d24c1ac19a261d5da53e664a27d6b779bf61130d7b2dc","t_submit_ns":"10630240927272568","t_endorsed_ns":"10630240973870343","t_submitted_ns":"10630240991679103","t_committed_ns":"10630241251930492","latency_endorse_ms":46.597775,"latency_order_commit_ms":278.060149,"latency_total_ms":324.657924,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":12,"seq":12,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"f2756058789ab57bae5541962730e5d9114418b3d5418a86acc3fc4b7d24301a","t_submit_ns":"10630240931107548","t_endorsed_ns":"10630240964884280","t_submitted_ns":"10630240981699516","t_committed_ns":"10630241252802215","latency_endorse_ms":33.776732,"latency_order_commit_ms":287.917935,"latency_total_ms":321.694667,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":17,"seq":17,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"c6131aadf19ae5f98f1d5a5784a87147257301287b0c02dcfd360c781090d46d","t_submit_ns":"10630240934942721","t_endorsed_ns":"10630240969586691","t_submitted_ns":"10630240990556202","t_committed_ns":"10630241253869571","latency_endorse_ms":34.64397,"latency_order_commit_ms":284.28288,"latency_total_ms":318.92685,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
{"run_id":"Smsmamz0x-H-r1","condition":"H","run_index":1,"worker_slot":6,"seq":6,"target_key":"Smsmamz0x-H-r1-HOTACTOR:quality","tx_id":"c06155dca89039efcd39fa125e7f5109042061cf1766d85e9faa905f0b7f55cb","t_submit_ns":"10630240926182848","t_endorsed_ns":"10630240986990384","t_submitted_ns":"10630241001150330","t_committed_ns":"10630241497386528","latency_endorse_ms":60.807536,"latency_order_commit_ms":510.396144,"latency_total_ms":571.20368,"status":"FAILED","error_class":"MVCC_READ_CONFLICT","error_code":"11","validation_code":11,"error_raw":"commit status not successful, validation_code=11","warmup":true}
```

---

## 6. Ledger convergence (A3)

Treated as a first-class measurement, not an operational wait.

| Run | W | committed | Converged | wait_ms | polls | Last peer(s) to converge |
|---|---|---|---|---|---|---|
| E/run1 | 20 | 2000 | yes | 84,538 | 59 | **org2** |
| E/run2 | 20 | 2000 | yes | 93,329 | 66 | **org2** |
| E/run3 | 20 | 2000 | yes | 89,951 | 64 | **org2** |
| F/run1 | 20 | 2000 | yes | 89,831 | 65 | **org2** |
| F/run2 | 20 | 2000 | yes | 85,636 | 61 | **org2** |
| F/run3 | 20 | 2000 | yes | 92,456 | 66 | **org2** |
| G/run1 | 20 | 2000 | yes | 82,476 | 60 | **org2** |
| G/run2 | 20 | 2000 | yes | 80,690 | 57 | **org2** |
| G/run3 | 20 | 2000 | yes | 84,530 | 61 | **org2** |
| H/run1 | 20 | 27 | yes | 1,745 | 2 | **org2** |
| H/run2 | 20 | 28 | yes | 2,705 | 3 | **org2** |
| H/run3 | 20 | 28 | yes | 1,691 | 2 | **org2** |

### 6.1 org2 is the last peer to converge in 12 of 12 runs

Not an occasional straggler — every single run. This answers the standing
reporting requirement ("which peer was last to converge, per run") with no
ambiguity.

### 6.2 Convergence scales with committed volume, not with W

H is the controlled comparison, and it was free. H runs at **the same W=20** as
E, F and G, but commits only 27–28 transactions instead of 2000. Its convergence
wait is **1.7–2.7 s against 80–93 s** — roughly 40× faster at identical
concurrency.

So the answer to A3's question is neither "W" nor "neither": convergence wait
tracks **the number of committed transactions**, equivalently the number of
blocks a lagging peer must catch up on. W matters only because it determines how
fast blocks are produced relative to the slowest peer's ability to commit them.

### 6.3 The mechanism, observed directly

During E/run1 the network was sampled mid-convergence while the load generator
was already idle:

| Time (UTC) | org1 height | org2 height | gap |
|---|---|---|---|
| 21:10:24 | 27208 | 27024 | 184 |
| 21:10:35 | 27208 | 27065 | 143 |
| 21:10:46 | 27208 | 27097 | 111 |
| 21:10:58 | 27208 | 27135 | 73 |
| 21:11:09 | 27208 | 27170 | 38 |
| 21:11:20 | 27208 | 27203 | 5 |

org1 was static throughout; all four orderers had finished. org2 closed a
179-block gap in 56 s, a drain rate of **≈3.2 blocks/s with zero incoming load**.

Block production under W=20 load runs at 3.68–3.85 blocks/s (§4). org2 commits
at ≈3.2 blocks/s. The peer cannot keep up with the orderer, accumulates a
backlog of several hundred blocks over a ~170 s run, and drains it afterwards at
its ceiling rate. Convergence time is backlog ÷ drain rate, which is why it is
proportional to committed count and independent of W.

### 6.4 Why this matters beyond the benchmark

The design permits any peer to be queried for a trust report. This measurement
says that for roughly 90 seconds after a burst of writes, a client querying
peer0.org2 sees a materially stale ledger — hundreds of blocks behind the
others — while the same query against org1, org3 or org4 returns current data.
The staleness is invisible to the querying client. This has no home in the
manuscript at present.

---

## 7. Resource utilisation

Sampled every 2 s by the node-local samplers (A1), read directly from cgroup v2.
All twelve runs achieved FULL four-node coverage. CPU% is normalised so that
100% = one saturated core; D1 has 12 cores, so its ceiling is 1200%.

### 7.1 Idle baseline (cooldown periods, outside every run window)

| Node | Container | Role | n | CPU% median | CPU% p95 | Mem MB median | Mem MB peak |
|---|---|---|---|---|---|---|---|
| D1 | HARNESS_bench.js | client | 692 | 0.00 | 1.00 | 123.9 | 125.7 |
| D1 | cc-unified | chaincode | 697 | 0.00 | 0.02 | 26.4 | 33.9 |
| D1 | peer0.org1 | peer | 697 | 3.45 | 6.90 | 433.5 | 493.0 |
| D2 | cc-unified | chaincode | 702 | 0.00 | 0.02 | 24.0 | 25.0 |
| D2 | orderer2 | follower | 702 | 1.15 | 1.37 | 272.1 | 353.7 |
| D2 | peer0.org2 | peer | 702 | 8.74 | 16.73 | 442.7 | 476.2 |
| D3 | cc-unified | chaincode | 693 | 0.00 | 0.01 | 26.6 | 28.1 |
| D3 | orderer3 | follower | 693 | 1.69 | 2.04 | 406.7 | 458.5 |
| D3 | peer0.org3 | peer | 693 | 6.78 | 8.90 | 439.6 | 483.9 |
| D4 | cc-unified | chaincode | 699 | 0.00 | 0.01 | 25.0 | 27.0 |
| D4 | **orderer (LEADER)** | leader | 699 | 1.97 | 2.90 | **914.4** | **989.0** |
| D4 | peer0.org4 | peer | 699 | 2.41 | 4.39 | 636.1 | 692.5 |

### 7.2 Condition E under load

| Node | Container | Role | n | CPU% median | CPU% p95 | CPU% peak | Mem MB median | Mem MB p95 | Mem MB peak |
|---|---|---|---|---|---|---|---|---|---|---|
| D1 | HARNESS_bench.js | client | 243 | 9.80 | 15.60 | **21.40** | 121.9 | 131.1 | 132.3 |
| D1 | cc-unified | chaincode | 243 | 1.77 | 2.99 | 53.63 | 27.0 | 28.0 | 29.3 |
| D1 | peer0.org1 | peer | 243 | 22.77 | 33.54 | 48.72 | 360.2 | 400.2 | 414.4 |
| D2 | cc-unified | chaincode | 246 | 0.79 | 1.67 | 2.34 | 24.2 | 24.9 | 25.2 |
| D2 | orderer2 | follower | 246 | 2.31 | 2.71 | 4.11 | 197.7 | 219.8 | 225.0 |
| D2 | peer0.org2 | peer | 246 | 12.97 | 16.96 | 20.21 | 347.3 | 402.5 | 410.6 |
| D3 | cc-unified | chaincode | 242 | 1.58 | 2.93 | 5.65 | 27.4 | 28.6 | 29.2 |
| D3 | orderer3 | follower | 242 | 3.08 | 3.83 | 5.17 | 329.1 | 354.8 | 359.0 |
| D3 | peer0.org3 | peer | 242 | 17.26 | 25.98 | 40.76 | 384.6 | 403.3 | 414.9 |
| D4 | cc-unified | chaincode | 243 | 1.31 | 2.91 | 4.16 | 25.8 | 27.1 | 27.6 |
| D4 | **orderer (LEADER)** | leader | 243 | 6.77 | 11.53 | 15.73 | **885.6** | 908.8 | **913.9** |
| D4 | peer0.org4 | peer | 243 | 11.67 | 20.40 | 32.46 | 564.5 | 592.3 | 596.1 |

Full per-condition tables for F, G and H are in
`phase3b-20260809T210708Z/` alongside the merged `resources.csv`.

### 7.3 The manuscript's resource claims are contradicted at idle, before any load

§5 of the manuscript states all peers stay below **6% CPU and 150 MB RAM**.

- **Memory**: every peer idles at 433–636 MB median RSS, 3–4× the stated ceiling.
  The Raft leader's orderer idles at **914 MB**, over 6× it. Under load the
  leader reaches 913.9 MB peak. No container measured in this phase was ever
  near 150 MB except the chaincode containers (24–27 MB).
- **CPU**: peer0.org2 already exceeds 6% at *idle* (8.74% median, 16.73% p95).
  Under load peers run 11.67–24.16% median and peak at 48.72%.

This is consistent with the 2026-08-04 measurement and is not a transient.

### 7.4 The orderer leader carries ~3× the memory of its followers

914 MB on D4 (leader) against 272 MB and 407 MB on D2 and D3 (followers), at
idle, and the ordering is preserved under load. The leader/follower split is
reported separately here for that reason.

### 7.5 The client is not the bottleneck at W=20

`HARNESS_bench.js` peaked at **21.4% CPU** during condition E — roughly a fifth
of one core, on a 12-core host. Node is single-threaded for JS execution, so the
saturation ceiling is ~100%. At W=20 the sweep is measuring the system, not the
client. Phase 4 must re-check this at every level; the figure above is the
W=20 reference point.

---

## 8. Raft stability

All three orderers report leader = **node 1 (D4, orderer.example.com), term 4**,
elected 2026-08-03T22:11:13Z and unchanged. No election occurred before, during
or after any run in this phase. No run is excludable on the pre-registered
election criterion.

All three consenters reported `consensusRelation=consenter, status=active`
throughout, with heights matching the four peers.

---

## 9. DR3 — free reproducibility check, condition E

Old E (2026-08-04, three runs) and new E (2026-08-09, three runs) measure the
same condition on a byte-identical starting ledger, five days apart. **The two
sets are reported side by side and are not merged.**

### 9.1 Per-run, both sessions

| Session | Run | Committed | P50 ms | P95 ms | P99 ms | Endorse med ms | Ord+Commit med ms | Steady TPS | Blocks | tx/block | Converge ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-04 | run1 | 2000 | 1616.8 | 3132.0 | 3691.5 | 381.0 | 1190.9 | 11.24 | 620 | 3.23 | 65,050 |
| 2026-08-04 | run2 | 2000 | 1778.2 | 2537.0 | 2765.7 | 366.4 | 1311.7 | 11.23 | 659 | 3.03 | 76,173 |
| 2026-08-04 | run3 | 2000 | 1791.2 | 2815.6 | 3151.8 | 384.1 | 1330.5 | 10.94 | 671 | 2.98 | 73,547 |
| 2026-08-09 | run1 | 2000 | 1507.1 | 2641.8 | 3300.2 | 394.7 | 1025.7 | 12.73 | 576 | 3.47 | 84,538 |
| 2026-08-09 | run2 | 2000 | 1776.8 | 3051.5 | 5195.0 | 402.6 | 1290.1 | 10.64 | 661 | 3.03 | 93,329 |
| 2026-08-09 | run3 | 2000 | 1609.3 | 2609.2 | 3031.9 | 396.1 | 1227.8 | 11.86 | 608 | 3.29 | 89,951 |

### 9.2 Median across three runs

| Metric | 2026-08-04 | 2026-08-09 | Δ | Δ % | Ranges overlap? |
|---|---|---|---|---|---|
| P50 total latency ms | 1778.2 | 1609.3 | −168.9 | −9.5% | **yes** (1617–1791 vs 1507–1777) |
| P95 total latency ms | 2815.6 | 2641.8 | −173.9 | −6.2% | **yes** |
| Endorse median ms | 381.0 | 396.1 | +15.1 | +4.0% | **yes** |
| Order+commit median ms | 1311.7 | 1227.8 | −83.8 | −6.4% | **yes** |
| Steady TPS | 11.23 | 11.86 | +0.62 | +5.6% | **yes** (10.94–11.24 vs 10.64–12.73) |
| tx_per_block | 3.03 | 3.29 | +0.25 | +8.4% | **yes** (2.98–3.23 vs 3.03–3.47) |
| **Convergence wait ms** | **73,547** | **89,951** | **+16,404** | **+22.3%** | **NO** (65.0–76.2 s vs 84.5–93.3 s) |

### 9.3 Verdict: reproducible on throughput and latency, NOT on convergence

**Six of seven metrics reproduce.** Latency, throughput and block occupancy all
shifted by less than their own run-to-run spread, and every per-run range
overlaps between sessions. Condition E is stable across five days on identical
state. That is a real, cheap validation of the harness and the testbed.

**Convergence wait does not reproduce.** It rose 22.3%, and the per-run ranges
are disjoint — 65.0/76.2/73.5 s then 84.5/93.3/90.0 s. Every one of the three
new runs is slower than every one of the three old runs. This is a systematic
shift, not noise.

**What changed between the sessions is state size.** Old E ran early in the
2026-08-04 sequence; new E ran at 94,287 counted keys, after that session's
Phase 2 and Phase 3 writes. A convergence cost that grows with state size is
consistent with §6.3's mechanism — a slower per-block commit on org2 lengthens
the drain — but this phase does not isolate the cause. **It is reported as an
observation with a candidate explanation, not as a demonstrated relationship.**
The state-growth checkpoints are the place to settle it.

---

## 10. DR4 — state size, and an important limitation

| Run | counted_keys before | counted_keys after | Δ | activeActors | totalRatings | linkedEvents |
|---|---|---|---|---|---|---|
| E/run1 | 94,287 | 94,287 | **+0** | 37,562 | 38,661 | 18,064 |
| E/run2 | 94,287 | 94,287 | **+0** | 37,562 | 38,661 | 18,064 |
| E/run3 | 94,287 | 94,287 | **+0** | 37,562 | 38,661 | 18,064 |
| F/run1 | 94,287 | 98,287 | +4,000 | 39,562 | 40,661 | 18,064 |
| F/run2 | 98,287 | 102,287 | +4,000 | 41,562 | 42,661 | 18,064 |
| F/run3 | 102,287 | 106,287 | +4,000 | 43,562 | 44,661 | 18,064 |
| G/run1 | 106,287 | 112,287 | +6,000 | 45,562 | 46,661 | 20,064 |
| G/run2 | 112,287 | 118,287 | +6,000 | 47,562 | 48,661 | 22,064 |
| G/run3 | 118,287 | 124,287 | +6,000 | 49,562 | 50,661 | 24,064 |
| H/run1 | 124,287 | 124,315 | +28 | 49,563 | 50,688 | 24,064 |
| H/run2 | 124,315 | 124,344 | +29 | 49,564 | 50,716 | 24,064 |
| H/run3 | 124,344 | 124,373 | +29 | 49,565 | 50,744 | 24,064 |

### 10.1 `counted_keys` does not measure provenance writes — it must not be called state size

Condition E committed **6,000 provenance writes across three runs and moved
`counted_keys` by exactly zero.**

This is the Gate 0 `totalAssets` defect surfacing in a new place. Provenance
assets are stored under bare asset IDs with no key prefix, so the range scans in
`GetSupplyChainMetrics` cannot match them. The counter therefore tracks
**reputation-side keys only** (actors, ratings, links).

Consequences that must not be smoothed over:

- `counted_keys` is a **lower bound** on state growth, not a measure of it.
  Phase 3B's true growth is at least 30,086 keys plus 6,000 unmeasured
  provenance assets plus their unmeasured history entries.
- The Gate 0 baseline of 81,492 and today's figures are consistent with each
  other but are all reputation-side subtotals.
- Total LevelDB key count remains unobtainable read-only; `ledgerutil` in this
  build exposes only `compare`, `identifytxs` and `verify`.

**No estimate of the true key count is substituted anywhere in this report.**

### 10.2 The intra-session state gradient (DR4)

Phase 3B ran across a rising state: **94,287 → 124,373 counted keys**, a 31.9%
increase within the session. Conditions did not run on equivalent state:

| Condition | counted_keys at first run start |
|---|---|
| E | 94,287 |
| F | 94,287 |
| G | 106,287 |
| H | 124,287 |

E and F began on identical state; G began 12,000 keys later and H 30,000 keys
later. Any comparison between E/F and G/H carries this gradient. Since E, F and
G are statistically indistinguishable anyway (§3), the gradient did not produce
a detectable throughput effect over this range — but it is disclosed rather than
assumed harmless, and §9.3 shows convergence *is* sensitive to something that
changed with state.

---

## 11. Amendment outcomes

| Amendment | Outcome |
|---|---|
| **A1** node-local samplers | Worked. 17,236 samples, all four nodes, spanning 21:07:08–21:57:31 with no gap. Watchdog recorded **0** stalls across the whole phase. |
| **A1** clock sync | All four NTP-synchronised. Inter-node offset spread **1.77 ms** against a 2,000 ms sampling interval — negligible for merging. Method and its limits in §12, deviation 2. |
| **A2** coverage check | Worked, and caught a defect (§12, deviation 1). Final verdict **FULL on all 12 runs, all four nodes**. |
| **A3** convergence | Timeout raised to 900 s; max observed 93.3 s, so headroom was never tested. Promoted to first-class measurement — §6 is the result. |
| **A4** Phase 6 net | Written and syntax-validated; not exercised (Phase 6 has not run). |
| **A5** env.json | Regenerated 21:05:32Z. Digest match on all four, no netem, peers v3.1.4. |

---

## 12. Deviations from the plan

| # | Deviation | Detail |
|---|---|---|
| 1 | **Coverage check reported a phase-wide false NONE on first execution** | The merge step ran `sort` over the whole CSV including its header. `"timestamp"` sorts after `"2026…"`, so the header moved to the last line and `csv.DictReader` used the first *data* row as field names, making every lookup fail. All 17,236 samples were present and intact; no data was lost. Both runners were fixed to sort the body only, the merged file was rebuilt from the four untouched raw node CSVs, and coverage recomputed to FULL on all twelve runs. Recorded because A2 is precisely the check that must not be quietly trusted. |
| 2 | **Clock offsets are bounded, not point-measured** | Round-trip offsets were dominated by ~300 ms remote shell startup, which is asymmetric within the round trip. The residual (offset − rtt/2) is consistent at −6.0 to −7.8 ms across all four nodes, giving an inter-node spread of 1.77 ms. Reported as a bound, not a precise offset. The bound is three orders of magnitude below the sampling interval, so the conclusion is unaffected. |
| 3 | **H's steady-window block rate is an artifact** | 27.79–50.85 blocks/s arises from dividing blocks by a steady window holding ~24 transactions. The total-window figure (2.14–2.99) is the meaningful one. Flagged in §4 rather than silently dropping the column. |
| 4 | **H's tx_per_block is below 1.0 by construction** | `committed ÷ blocks` understates occupancy when transactions fail validation, because invalid transactions still occupy block space. Affects H only. §4. |
| 5 | **H statistics are weakly supported and the harness said so** | `steady_count` of 23, 24, 24 against a 50 threshold. The harness emitted the warning on all three runs and it is carried here rather than suppressed. H's latency figures describe 83 committed transactions. |
| 6 | **`counted_keys` does not include provenance writes** | §10.1. Reported as a limitation of the metric; no substitute figure offered. |
| 7 | **`bench.js` gained `--flush-every`** | Added for Phase 6 (external fault injector needs `txs.jsonl` as a live cursor). Default remains 100, so Phase 3B is unaffected; every Phase 3B manifest records harness v2.1.0. |
| 8 | **`index.json` merge defect fixed mid-session** | Pre-existing defect, not introduced here: `index.json` was rebuilt from an empty array on every invocation, so a second invocation against the same output directory erased the first's entries. This is why the surviving 2026-08-04 `phase3` index listed only E and F. Now merges on condition+run_index. |

---

## 13. Contradictions against earlier reports

1. **`REPORT.md` §8.4 and §8.5 remain factually wrong** and are untouched, per
   A6. They state condition E is `0/3` with run1 truncated at 1,100
   transactions; D1 in fact holds three complete E runs from 2026-08-04 with
   full manifests. The correction is owed in Phase 9, stated as a correction.
   `GATE_R_REPORT.md` §3 carries the evidence.

2. **Prior characterisation of high contention as an MVCC phenomenon is not
   supported.** §5.1: `ENDORSE_MISMATCH` is the majority failure class at 58.2%,
   MVCC the minority at 41.8%. The April "99% MVCC" figure and the Phase 3 plan
   both anticipated MVCC dominance.

3. **The manuscript's ≤6% CPU / ≤150 MB claim is contradicted at idle**, §7.3,
   consistent with the 2026-08-04 observation.

---

## 14. Status and decisions owed

**Phase 3 is now complete.** With A, B, C and D from 2026-08-04 and E, F, G, H
from today, all eight conditions have three valid runs with the invariant
holding, four-peer agreement, and — for E–H — full four-node resource coverage.

No decision is blocking. Two items are offered for a ruling when convenient,
and I will proceed on the stated default unless told otherwise:

1. **Conditions A–D have no `counted_keys` record** (harness predates v2.1.0)
   and their resource data comes from the laptop-side sampler. They are
   internally valid and I do **not** propose re-running them. *Default: keep as
   measured, disclose the difference in provenance.*

2. **The convergence non-reproducibility (§9.3) is unexplained.** Isolating it
   would need condition E repeated at a materially different state size, which
   is not in the plan. *Default: report as observed, do not add runs.*

Proceeding to Phase 4 (concurrency sweep). The Phase 4 prediction stands on
record unmodified, and §4's block-rate stability at W=20 is measurement taken
before the sweep, not an adjustment to it.
