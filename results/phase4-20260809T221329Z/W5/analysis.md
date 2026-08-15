# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 1500 | 1500 | 0 | 605.4 | 565.9 | 1267.2 | 2062.8 | 132.6 | 331.0 | 8.27 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 561.7 | 578.1 | 16.4 | 7.96 | 8.41 | 0.45 | OK |

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
| E | 1 | 500 | 500 | 623.4 | 578.1 | 1267.2 | 2062.8 | 277.1 | 2994.4 | 7.96 |
| E | 2 | 500 | 500 | 592.0 | 565.9 | 1173.3 | 1889.8 | 298.7 | 1918.2 | 8.41 |
| E | 3 | 500 | 500 | 605.4 | 561.7 | 1321.0 | 2134.8 | 285.8 | 2355.7 | 8.27 |