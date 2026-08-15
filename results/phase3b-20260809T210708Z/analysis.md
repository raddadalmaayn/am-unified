# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 6000 | 6000 | 0 | 1701.2 | 1609.2 | 2641.7 | 3300.2 | 396.1 | 1227.8 | 11.70 |
| F | 3 | 6000 | 6000 | 0 | 1676.4 | 1597.0 | 2613.6 | 3248.9 | 405.6 | 1164.4 | 11.93 |
| G | 3 | 6000 | 6000 | 0 | 1635.9 | 1557.3 | 2561.3 | 2899.6 | 426.9 | 1109.7 | 12.14 |
| H | 3 | 1500 | 83 | 1417 | 516.2 | 453.1 | 836.3 | 989.5 | 133.6 | 329.1 | 2.68 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 1507.1 | 1776.7 | 269.6 | 10.51 | 12.57 | 2.06 | OK |
| F | 1539.0 | 1781.3 | 242.3 | 11.19 | 12.52 | 1.33 | OK |
| G | 1554.2 | 1698.2 | 144.0 | 11.09 | 12.37 | 1.28 | OK |
| H | 448.2 | 497.5 | 49.2 | 2.14 | 2.99 | 0.85 | OK |

## Failure breakdown by class

| Cond | n | MVCC_READ_CONFLICT | ENDORSE_MISMATCH |
|---|---|---|---|
| E | 6000 | 0 (0.00%) | 0 (0.00%) |
| F | 6000 | 0 (0.00%) | 0 (0.00%) |
| G | 6000 | 0 (0.00%) | 0 (0.00%) |
| H | 1500 | 592 (39.47%) | 825 (55.00%) |

## Zero-event upper bounds (95%)

| Cond | n | Class | Rule-of-three upper | Wilson upper |
|---|---|---|---|---|
| E | 6000 | MVCC_READ_CONFLICT | 0.0500% | 0.0640% |
| E | 6000 | PHANTOM_READ_CONFLICT | 0.0500% | 0.0640% |
| E | 6000 | ENDORSEMENT_POLICY_FAILURE | 0.0500% | 0.0640% |
| E | 6000 | CHAINCODE_REJECT | 0.0500% | 0.0640% |
| E | 6000 | ENDORSE_MISMATCH | 0.0500% | 0.0640% |
| E | 6000 | GATEWAY_DEADLINE | 0.0500% | 0.0640% |
| E | 6000 | GATEWAY_UNAVAILABLE | 0.0500% | 0.0640% |
| E | 6000 | ORDERER_UNAVAILABLE | 0.0500% | 0.0640% |
| E | 6000 | COMMIT_TIMEOUT | 0.0500% | 0.0640% |
| E | 6000 | OTHER | 0.0500% | 0.0640% |
| F | 6000 | MVCC_READ_CONFLICT | 0.0500% | 0.0640% |
| F | 6000 | PHANTOM_READ_CONFLICT | 0.0500% | 0.0640% |
| F | 6000 | ENDORSEMENT_POLICY_FAILURE | 0.0500% | 0.0640% |
| F | 6000 | CHAINCODE_REJECT | 0.0500% | 0.0640% |
| F | 6000 | ENDORSE_MISMATCH | 0.0500% | 0.0640% |
| F | 6000 | GATEWAY_DEADLINE | 0.0500% | 0.0640% |
| F | 6000 | GATEWAY_UNAVAILABLE | 0.0500% | 0.0640% |
| F | 6000 | ORDERER_UNAVAILABLE | 0.0500% | 0.0640% |
| F | 6000 | COMMIT_TIMEOUT | 0.0500% | 0.0640% |
| F | 6000 | OTHER | 0.0500% | 0.0640% |
| G | 6000 | MVCC_READ_CONFLICT | 0.0500% | 0.0640% |
| G | 6000 | PHANTOM_READ_CONFLICT | 0.0500% | 0.0640% |
| G | 6000 | ENDORSEMENT_POLICY_FAILURE | 0.0500% | 0.0640% |
| G | 6000 | CHAINCODE_REJECT | 0.0500% | 0.0640% |
| G | 6000 | ENDORSE_MISMATCH | 0.0500% | 0.0640% |
| G | 6000 | GATEWAY_DEADLINE | 0.0500% | 0.0640% |
| G | 6000 | GATEWAY_UNAVAILABLE | 0.0500% | 0.0640% |
| G | 6000 | ORDERER_UNAVAILABLE | 0.0500% | 0.0640% |
| G | 6000 | COMMIT_TIMEOUT | 0.0500% | 0.0640% |
| G | 6000 | OTHER | 0.0500% | 0.0640% |
| H | 1500 | PHANTOM_READ_CONFLICT | 0.2000% | 0.2555% |
| H | 1500 | ENDORSEMENT_POLICY_FAILURE | 0.2000% | 0.2555% |
| H | 1500 | CHAINCODE_REJECT | 0.2000% | 0.2555% |
| H | 1500 | GATEWAY_DEADLINE | 0.2000% | 0.2555% |
| H | 1500 | GATEWAY_UNAVAILABLE | 0.2000% | 0.2555% |
| H | 1500 | ORDERER_UNAVAILABLE | 0.2000% | 0.2555% |
| H | 1500 | COMMIT_TIMEOUT | 0.2000% | 0.2555% |
| H | 1500 | OTHER | 0.2000% | 0.2555% |

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 2000 | 2000 | 1593.9 | 1507.1 | 2641.7 | 3300.2 | 310.1 | 3587.4 | 12.57 |
| E | 2 | 2000 | 2000 | 1893.6 | 1776.7 | 3051.2 | 5194.9 | 722.1 | 6797.9 | 10.51 |
| E | 3 | 2000 | 2000 | 1701.2 | 1609.2 | 2609.1 | 3031.9 | 536.1 | 3461.8 | 11.70 |
| F | 1 | 2000 | 2000 | 1676.4 | 1597.0 | 2613.6 | 2934.0 | 348.9 | 3599.2 | 11.93 |
| F | 2 | 2000 | 2000 | 1588.5 | 1539.0 | 2565.5 | 3252.3 | 320.5 | 3674.7 | 12.52 |
| F | 3 | 2000 | 2000 | 1784.7 | 1781.3 | 2795.2 | 3248.9 | 255.8 | 3500.7 | 11.19 |
| G | 1 | 2000 | 2000 | 1612.7 | 1557.3 | 2533.5 | 2894.6 | 501.3 | 3331.6 | 12.37 |
| G | 2 | 2000 | 2000 | 1800.0 | 1698.2 | 2933.8 | 3568.3 | 535.0 | 4027.8 | 11.09 |
| G | 3 | 2000 | 2000 | 1635.9 | 1554.2 | 2561.3 | 2899.6 | 312.5 | 3241.0 | 12.14 |
| H | 1 | 500 | 27 | 525.4 | 497.5 | 836.3 | 989.5 | 359.3 | 989.5 | 2.99 |
| H | 2 | 500 | 28 | 492.1 | 453.1 | 747.8 | 758.3 | 331.6 | 758.3 | 2.68 |
| H | 3 | 500 | 28 | 516.2 | 448.2 | 975.6 | 1044.8 | 340.3 | 1044.8 | 2.14 |