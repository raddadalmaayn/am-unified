# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 1000 | 1000 | 0 | 2306.0 | 2240.4 | 3544.8 | 4038.8 | 377.4 | 1795.0 | 8.66 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 2240.4 | 2240.4 | 0.0 | 8.66 | 8.66 | 0.00 | OK |

## Failure breakdown by class

No failures recorded in any condition.

## Zero-event upper bounds (95%)

| Cond | n | Class | Rule-of-three upper | Wilson upper |
|---|---|---|---|---|
| E | 1000 | MVCC_READ_CONFLICT | 0.3000% | 0.3827% |
| E | 1000 | PHANTOM_READ_CONFLICT | 0.3000% | 0.3827% |
| E | 1000 | ENDORSEMENT_POLICY_FAILURE | 0.3000% | 0.3827% |
| E | 1000 | CHAINCODE_REJECT | 0.3000% | 0.3827% |
| E | 1000 | ENDORSE_MISMATCH | 0.3000% | 0.3827% |
| E | 1000 | GATEWAY_DEADLINE | 0.3000% | 0.3827% |
| E | 1000 | GATEWAY_UNAVAILABLE | 0.3000% | 0.3827% |
| E | 1000 | ORDERER_UNAVAILABLE | 0.3000% | 0.3827% |
| E | 1000 | COMMIT_TIMEOUT | 0.3000% | 0.3827% |
| E | 1000 | OTHER | 0.3000% | 0.3827% |

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 1000 | 1000 | 2306.0 | 2240.4 | 3544.8 | 4038.8 | 975.1 | 4366.2 | 8.66 |