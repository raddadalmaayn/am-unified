# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 3 | 1500 | 1500 | 0 | 431.1 | 402.3 | 679.8 | 1000.5 | 72.4 | 323.5 | 2.32 |
| B | 3 | 1500 | 1500 | 0 | 440.1 | 422.1 | 680.3 | 1012.1 | 84.8 | 325.1 | 2.27 |
| C | 3 | 1500 | 1500 | 0 | 442.4 | 412.3 | 689.9 | 903.0 | 84.1 | 320.2 | 2.26 |
| D | 3 | 1500 | 1500 | 0 | 4.0 | 3.9 | 4.8 | 5.6 | n/a | n/a | 251.54 |
| E | 3 | 6000 | 6000 | 0 | 1789.7 | 1777.5 | 2815.6 | 3151.7 | 381.0 | 1311.7 | 11.10 |
| F | 1 | 2000 | 2000 | 0 | 1865.3 | 1801.3 | 2608.4 | 3017.7 | 388.7 | 1384.6 | 10.69 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| A | 401.6 | 421.9 | 20.4 | 2.28 | 2.34 | 0.05 | OK |
| B | 411.2 | 423.0 | 11.9 | 2.25 | 2.28 | 0.03 | OK |
| C | 402.7 | 413.3 | 10.6 | 2.24 | 2.30 | 0.06 | OK |
| D | 3.8 | 3.9 | 0.1 | 249.95 | 255.58 | 5.63 | OK |
| E | 1616.1 | 1791.1 | 175.0 | 10.80 | 11.13 | 0.33 | OK |
| F | 1801.3 | 1801.3 | 0.0 | 10.69 | 10.69 | 0.00 | OK |

## Failure breakdown by class

No failures recorded in any condition.

## Zero-event upper bounds (95%)

| Cond | n | Class | Rule-of-three upper | Wilson upper |
|---|---|---|---|---|
| A | 1500 | MVCC_READ_CONFLICT | 0.2000% | 0.2555% |
| A | 1500 | PHANTOM_READ_CONFLICT | 0.2000% | 0.2555% |
| A | 1500 | ENDORSEMENT_POLICY_FAILURE | 0.2000% | 0.2555% |
| A | 1500 | CHAINCODE_REJECT | 0.2000% | 0.2555% |
| A | 1500 | ENDORSE_MISMATCH | 0.2000% | 0.2555% |
| A | 1500 | GATEWAY_DEADLINE | 0.2000% | 0.2555% |
| A | 1500 | GATEWAY_UNAVAILABLE | 0.2000% | 0.2555% |
| A | 1500 | ORDERER_UNAVAILABLE | 0.2000% | 0.2555% |
| A | 1500 | COMMIT_TIMEOUT | 0.2000% | 0.2555% |
| A | 1500 | OTHER | 0.2000% | 0.2555% |
| B | 1500 | MVCC_READ_CONFLICT | 0.2000% | 0.2555% |
| B | 1500 | PHANTOM_READ_CONFLICT | 0.2000% | 0.2555% |
| B | 1500 | ENDORSEMENT_POLICY_FAILURE | 0.2000% | 0.2555% |
| B | 1500 | CHAINCODE_REJECT | 0.2000% | 0.2555% |
| B | 1500 | ENDORSE_MISMATCH | 0.2000% | 0.2555% |
| B | 1500 | GATEWAY_DEADLINE | 0.2000% | 0.2555% |
| B | 1500 | GATEWAY_UNAVAILABLE | 0.2000% | 0.2555% |
| B | 1500 | ORDERER_UNAVAILABLE | 0.2000% | 0.2555% |
| B | 1500 | COMMIT_TIMEOUT | 0.2000% | 0.2555% |
| B | 1500 | OTHER | 0.2000% | 0.2555% |
| C | 1500 | MVCC_READ_CONFLICT | 0.2000% | 0.2555% |
| C | 1500 | PHANTOM_READ_CONFLICT | 0.2000% | 0.2555% |
| C | 1500 | ENDORSEMENT_POLICY_FAILURE | 0.2000% | 0.2555% |
| C | 1500 | CHAINCODE_REJECT | 0.2000% | 0.2555% |
| C | 1500 | ENDORSE_MISMATCH | 0.2000% | 0.2555% |
| C | 1500 | GATEWAY_DEADLINE | 0.2000% | 0.2555% |
| C | 1500 | GATEWAY_UNAVAILABLE | 0.2000% | 0.2555% |
| C | 1500 | ORDERER_UNAVAILABLE | 0.2000% | 0.2555% |
| C | 1500 | COMMIT_TIMEOUT | 0.2000% | 0.2555% |
| C | 1500 | OTHER | 0.2000% | 0.2555% |
| D | 1500 | MVCC_READ_CONFLICT | 0.2000% | 0.2555% |
| D | 1500 | PHANTOM_READ_CONFLICT | 0.2000% | 0.2555% |
| D | 1500 | ENDORSEMENT_POLICY_FAILURE | 0.2000% | 0.2555% |
| D | 1500 | CHAINCODE_REJECT | 0.2000% | 0.2555% |
| D | 1500 | ENDORSE_MISMATCH | 0.2000% | 0.2555% |
| D | 1500 | GATEWAY_DEADLINE | 0.2000% | 0.2555% |
| D | 1500 | GATEWAY_UNAVAILABLE | 0.2000% | 0.2555% |
| D | 1500 | ORDERER_UNAVAILABLE | 0.2000% | 0.2555% |
| D | 1500 | COMMIT_TIMEOUT | 0.2000% | 0.2555% |
| D | 1500 | OTHER | 0.2000% | 0.2555% |
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
| F | 2000 | MVCC_READ_CONFLICT | 0.1500% | 0.1917% |
| F | 2000 | PHANTOM_READ_CONFLICT | 0.1500% | 0.1917% |
| F | 2000 | ENDORSEMENT_POLICY_FAILURE | 0.1500% | 0.1917% |
| F | 2000 | CHAINCODE_REJECT | 0.1500% | 0.1917% |
| F | 2000 | ENDORSE_MISMATCH | 0.1500% | 0.1917% |
| F | 2000 | GATEWAY_DEADLINE | 0.1500% | 0.1917% |
| F | 2000 | GATEWAY_UNAVAILABLE | 0.1500% | 0.1917% |
| F | 2000 | ORDERER_UNAVAILABLE | 0.1500% | 0.1917% |
| F | 2000 | COMMIT_TIMEOUT | 0.1500% | 0.1917% |
| F | 2000 | OTHER | 0.1500% | 0.1917% |

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 1 | 500 | 500 | 438.5 | 421.9 | 679.8 | 1077.3 | 300.8 | 1171.3 | 2.28 |
| A | 2 | 500 | 500 | 428.2 | 402.3 | 625.4 | 890.1 | 302.6 | 1201.5 | 2.34 |
| A | 3 | 500 | 500 | 431.1 | 401.6 | 699.6 | 1000.5 | 310.2 | 1037.0 | 2.32 |
| B | 1 | 500 | 500 | 439.2 | 422.1 | 668.7 | 967.9 | 311.1 | 1181.0 | 2.28 |
| B | 2 | 500 | 500 | 440.1 | 411.2 | 680.3 | 1012.5 | 299.9 | 1613.5 | 2.27 |
| B | 3 | 500 | 500 | 444.8 | 423.0 | 712.6 | 1012.1 | 312.0 | 1179.2 | 2.25 |
| C | 1 | 500 | 500 | 442.4 | 412.3 | 689.7 | 903.0 | 311.4 | 1100.5 | 2.26 |
| C | 2 | 500 | 500 | 446.3 | 413.3 | 725.1 | 1069.4 | 300.9 | 1622.9 | 2.24 |
| C | 3 | 500 | 500 | 435.7 | 402.7 | 689.9 | 879.3 | 290.6 | 1358.1 | 2.30 |
| D | 1 | 500 | 500 | 4.0 | 3.9 | 4.8 | 5.9 | 3.3 | 6.1 | 251.54 |
| D | 2 | 500 | 500 | 3.9 | 3.8 | 4.6 | 5.6 | 3.4 | 6.1 | 255.58 |
| D | 3 | 500 | 500 | 4.0 | 3.9 | 5.0 | 5.6 | 3.4 | 6.6 | 249.95 |
| E | 1 | 2000 | 2000 | 1789.7 | 1616.1 | 3131.9 | 3691.5 | 299.1 | 4433.7 | 11.10 |
| E | 2 | 2000 | 2000 | 1789.6 | 1777.5 | 2536.7 | 2765.7 | 746.4 | 3417.4 | 11.13 |
| E | 3 | 2000 | 2000 | 1844.5 | 1791.1 | 2815.6 | 3151.7 | 489.5 | 3768.7 | 10.80 |
| F | 1 | 2000 | 2000 | 1865.3 | 1801.3 | 2608.4 | 3017.7 | 716.5 | 3846.9 | 10.69 |