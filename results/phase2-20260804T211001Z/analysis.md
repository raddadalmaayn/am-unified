# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 1 | 50 | 50 | 0 | 414.7 | 424.0 | 556.1 | 667.7 | 74.1 | 324.6 | 2.41 |
| B | 1 | 50 | 50 | 0 | 441.7 | 423.5 | 600.6 | 890.1 | 92.1 | 326.6 | 2.25 |
| C | 1 | 50 | 50 | 0 | 456.3 | 434.2 | 614.5 | 937.2 | 109.3 | 325.7 | 2.18 |
| D | 1 | 200 | 200 | 0 | 12.5 | 12.1 | 16.9 | 29.5 | n/a | n/a | 780.89 |
| E | 1 | 200 | 200 | 0 | 1156.9 | 1069.6 | 1804.6 | 2013.4 | 371.8 | 671.3 | 8.38 |
| F | 1 | 200 | 200 | 0 | 644.1 | 607.8 | 1206.7 | 1242.4 | 210.0 | 369.7 | 15.28 |
| G | 1 | 200 | 200 | 0 | 1146.9 | 1069.7 | 2042.0 | 2316.7 | 373.3 | 637.3 | 8.81 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| A | 424.0 | 424.0 | 0.0 | 2.41 | 2.41 | 0.00 | OK |
| B | 423.5 | 423.5 | 0.0 | 2.25 | 2.25 | 0.00 | OK |
| C | 434.2 | 434.2 | 0.0 | 2.18 | 2.18 | 0.00 | OK |
| D | 12.1 | 12.1 | 0.0 | 780.89 | 780.89 | 0.00 | OK |
| E | 1069.6 | 1069.6 | 0.0 | 8.38 | 8.38 | 0.00 | OK |
| F | 607.8 | 607.8 | 0.0 | 15.28 | 15.28 | 0.00 | OK |
| G | 1069.7 | 1069.7 | 0.0 | 8.81 | 8.81 | 0.00 | OK |

## Failure breakdown by class

No failures recorded in any condition.

## Zero-event upper bounds (95%)

| Cond | n | Class | Rule-of-three upper | Wilson upper |
|---|---|---|---|---|
| A | 50 | MVCC_READ_CONFLICT | 6.0000% | 7.1350% |
| A | 50 | PHANTOM_READ_CONFLICT | 6.0000% | 7.1350% |
| A | 50 | ENDORSEMENT_POLICY_FAILURE | 6.0000% | 7.1350% |
| A | 50 | CHAINCODE_REJECT | 6.0000% | 7.1350% |
| A | 50 | ENDORSE_MISMATCH | 6.0000% | 7.1350% |
| A | 50 | GATEWAY_DEADLINE | 6.0000% | 7.1350% |
| A | 50 | GATEWAY_UNAVAILABLE | 6.0000% | 7.1350% |
| A | 50 | ORDERER_UNAVAILABLE | 6.0000% | 7.1350% |
| A | 50 | COMMIT_TIMEOUT | 6.0000% | 7.1350% |
| A | 50 | OTHER | 6.0000% | 7.1350% |
| B | 50 | MVCC_READ_CONFLICT | 6.0000% | 7.1350% |
| B | 50 | PHANTOM_READ_CONFLICT | 6.0000% | 7.1350% |
| B | 50 | ENDORSEMENT_POLICY_FAILURE | 6.0000% | 7.1350% |
| B | 50 | CHAINCODE_REJECT | 6.0000% | 7.1350% |
| B | 50 | ENDORSE_MISMATCH | 6.0000% | 7.1350% |
| B | 50 | GATEWAY_DEADLINE | 6.0000% | 7.1350% |
| B | 50 | GATEWAY_UNAVAILABLE | 6.0000% | 7.1350% |
| B | 50 | ORDERER_UNAVAILABLE | 6.0000% | 7.1350% |
| B | 50 | COMMIT_TIMEOUT | 6.0000% | 7.1350% |
| B | 50 | OTHER | 6.0000% | 7.1350% |
| C | 50 | MVCC_READ_CONFLICT | 6.0000% | 7.1350% |
| C | 50 | PHANTOM_READ_CONFLICT | 6.0000% | 7.1350% |
| C | 50 | ENDORSEMENT_POLICY_FAILURE | 6.0000% | 7.1350% |
| C | 50 | CHAINCODE_REJECT | 6.0000% | 7.1350% |
| C | 50 | ENDORSE_MISMATCH | 6.0000% | 7.1350% |
| C | 50 | GATEWAY_DEADLINE | 6.0000% | 7.1350% |
| C | 50 | GATEWAY_UNAVAILABLE | 6.0000% | 7.1350% |
| C | 50 | ORDERER_UNAVAILABLE | 6.0000% | 7.1350% |
| C | 50 | COMMIT_TIMEOUT | 6.0000% | 7.1350% |
| C | 50 | OTHER | 6.0000% | 7.1350% |
| D | 200 | MVCC_READ_CONFLICT | 1.5000% | 1.8846% |
| D | 200 | PHANTOM_READ_CONFLICT | 1.5000% | 1.8846% |
| D | 200 | ENDORSEMENT_POLICY_FAILURE | 1.5000% | 1.8846% |
| D | 200 | CHAINCODE_REJECT | 1.5000% | 1.8846% |
| D | 200 | ENDORSE_MISMATCH | 1.5000% | 1.8846% |
| D | 200 | GATEWAY_DEADLINE | 1.5000% | 1.8846% |
| D | 200 | GATEWAY_UNAVAILABLE | 1.5000% | 1.8846% |
| D | 200 | ORDERER_UNAVAILABLE | 1.5000% | 1.8846% |
| D | 200 | COMMIT_TIMEOUT | 1.5000% | 1.8846% |
| D | 200 | OTHER | 1.5000% | 1.8846% |
| E | 200 | MVCC_READ_CONFLICT | 1.5000% | 1.8846% |
| E | 200 | PHANTOM_READ_CONFLICT | 1.5000% | 1.8846% |
| E | 200 | ENDORSEMENT_POLICY_FAILURE | 1.5000% | 1.8846% |
| E | 200 | CHAINCODE_REJECT | 1.5000% | 1.8846% |
| E | 200 | ENDORSE_MISMATCH | 1.5000% | 1.8846% |
| E | 200 | GATEWAY_DEADLINE | 1.5000% | 1.8846% |
| E | 200 | GATEWAY_UNAVAILABLE | 1.5000% | 1.8846% |
| E | 200 | ORDERER_UNAVAILABLE | 1.5000% | 1.8846% |
| E | 200 | COMMIT_TIMEOUT | 1.5000% | 1.8846% |
| E | 200 | OTHER | 1.5000% | 1.8846% |
| F | 200 | MVCC_READ_CONFLICT | 1.5000% | 1.8846% |
| F | 200 | PHANTOM_READ_CONFLICT | 1.5000% | 1.8846% |
| F | 200 | ENDORSEMENT_POLICY_FAILURE | 1.5000% | 1.8846% |
| F | 200 | CHAINCODE_REJECT | 1.5000% | 1.8846% |
| F | 200 | ENDORSE_MISMATCH | 1.5000% | 1.8846% |
| F | 200 | GATEWAY_DEADLINE | 1.5000% | 1.8846% |
| F | 200 | GATEWAY_UNAVAILABLE | 1.5000% | 1.8846% |
| F | 200 | ORDERER_UNAVAILABLE | 1.5000% | 1.8846% |
| F | 200 | COMMIT_TIMEOUT | 1.5000% | 1.8846% |
| F | 200 | OTHER | 1.5000% | 1.8846% |
| G | 200 | MVCC_READ_CONFLICT | 1.5000% | 1.8846% |
| G | 200 | PHANTOM_READ_CONFLICT | 1.5000% | 1.8846% |
| G | 200 | ENDORSEMENT_POLICY_FAILURE | 1.5000% | 1.8846% |
| G | 200 | CHAINCODE_REJECT | 1.5000% | 1.8846% |
| G | 200 | ENDORSE_MISMATCH | 1.5000% | 1.8846% |
| G | 200 | GATEWAY_DEADLINE | 1.5000% | 1.8846% |
| G | 200 | GATEWAY_UNAVAILABLE | 1.5000% | 1.8846% |
| G | 200 | ORDERER_UNAVAILABLE | 1.5000% | 1.8846% |
| G | 200 | COMMIT_TIMEOUT | 1.5000% | 1.8846% |
| G | 200 | OTHER | 1.5000% | 1.8846% |

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 1 | 50 | 50 | 414.7 | 424.0 | 556.1 | 667.7 | 312.4 | 667.7 | 2.41 |
| B | 1 | 50 | 50 | 441.7 | 423.5 | 600.6 | 890.1 | 313.3 | 890.1 | 2.25 |
| C | 1 | 50 | 50 | 456.3 | 434.2 | 614.5 | 937.2 | 322.9 | 937.2 | 2.18 |
| D | 1 | 200 | 200 | 12.5 | 12.1 | 16.9 | 29.5 | 3.9 | 44.6 | 780.89 |
| E | 1 | 200 | 200 | 1156.9 | 1069.6 | 1804.6 | 2013.4 | 490.8 | 2114.8 | 8.38 |
| F | 1 | 200 | 200 | 644.1 | 607.8 | 1206.7 | 1242.4 | 321.7 | 1259.1 | 15.28 |
| G | 1 | 200 | 200 | 1146.9 | 1069.7 | 2042.0 | 2316.7 | 500.8 | 2327.7 | 8.81 |