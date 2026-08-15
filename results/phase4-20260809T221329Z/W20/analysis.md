# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 1500 | 1500 | 0 | 1570.3 | 1498.7 | 2340.2 | 3134.9 | 361.7 | 1128.1 | 12.73 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 1252.3 | 1733.4 | 481.1 | 11.61 | 15.50 | 3.89 | OK |

## Failure breakdown by class

No failures recorded in any condition.

## Zero-event upper bounds (95%)

| Cond | n | Class | Rule-of-three upper | Wilson upper |
|---|---|---|---|---|
| E | 1500 | MVCC_READ_CONFLICT | 0.2000% | 0.2555% |
| E | 1500 | PHANTOM_READ_CONFLICT | 0.2000% | 0.2555% |
| E | 1500 | ENDORSEMENT_POLICY_FAILURE | 0.2000% | 0.2555% |
| E | 1500 | CHAINCODE_REJECT | 0.2000% | 0.2555% |
| E | 1500 | ENDORSE_MISMATCH | 0.2000% | 0.2555% |
| E | 1500 | GATEWAY_DEADLINE | 0.2000% | 0.2555% |
| E | 1500 | GATEWAY_UNAVAILABLE | 0.2000% | 0.2555% |
| E | 1500 | ORDERER_UNAVAILABLE | 0.2000% | 0.2555% |
| E | 1500 | COMMIT_TIMEOUT | 0.2000% | 0.2555% |
| E | 1500 | OTHER | 0.2000% | 0.2555% |

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 500 | 500 | 1570.3 | 1498.7 | 2403.0 | 3134.9 | 774.7 | 3172.1 | 12.73 |
| E | 2 | 500 | 500 | 1272.5 | 1252.3 | 1840.7 | 2088.5 | 504.9 | 2124.7 | 15.50 |
| E | 3 | 500 | 500 | 1696.8 | 1733.4 | 2340.2 | 3418.6 | 775.2 | 3669.7 | 11.61 |