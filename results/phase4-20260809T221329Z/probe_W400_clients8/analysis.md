# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 2000 | 2000 | 0 | 21358.1 | 23312.7 | 28381.9 | 28770.6 | 426.0 | 22863.6 | 16.14 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 23312.7 | 23312.7 | 0.0 | 16.14 | 16.14 | 0.00 | OK |

## Failure breakdown by class

No failures recorded in any condition.

## Zero-event upper bounds (95%)

| Cond | n | Class | Rule-of-three upper | Wilson upper |
|---|---|---|---|---|
| E | 2000 | MVCC_READ_CONFLICT | 0.1500% | 0.1917% |
| E | 2000 | PHANTOM_READ_CONFLICT | 0.1500% | 0.1917% |
| E | 2000 | ENDORSEMENT_POLICY_FAILURE | 0.1500% | 0.1917% |
| E | 2000 | CHAINCODE_REJECT | 0.1500% | 0.1917% |
| E | 2000 | ENDORSE_MISMATCH | 0.1500% | 0.1917% |
| E | 2000 | GATEWAY_DEADLINE | 0.1500% | 0.1917% |
| E | 2000 | GATEWAY_UNAVAILABLE | 0.1500% | 0.1917% |
| E | 2000 | ORDERER_UNAVAILABLE | 0.1500% | 0.1917% |
| E | 2000 | COMMIT_TIMEOUT | 0.1500% | 0.1917% |
| E | 2000 | OTHER | 0.1500% | 0.1917% |

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 2000 | 2000 | 21358.1 | 23312.7 | 28381.9 | 28770.6 | 1742.7 | 29130.1 | 16.14 |