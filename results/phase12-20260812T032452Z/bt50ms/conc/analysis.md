# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 6000 | 6000 | 0 | 234.2 | 231.9 | 289.0 | 329.9 | 84.4 | 146.0 | 416.67 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 224.2 | 233.6 | 9.5 | 410.03 | 422.94 | 12.92 | OK |

## Failure breakdown by class

No failures recorded in any condition.

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

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 2000 | 2000 | 237.9 | 233.6 | 297.0 | 336.5 | 88.7 | 376.0 | 410.03 |
| E | 2 | 2000 | 2000 | 234.2 | 231.9 | 289.0 | 329.9 | 97.7 | 385.2 | 416.67 |
| E | 3 | 2000 | 2000 | 227.5 | 224.2 | 282.1 | 314.5 | 89.9 | 363.1 | 422.94 |