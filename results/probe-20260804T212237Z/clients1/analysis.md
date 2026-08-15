# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 1000 | 1000 | 0 | 1761.2 | 1591.0 | 2973.4 | 3910.8 | 363.1 | 1201.5 | 11.46 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 1591.0 | 1591.0 | 0.0 | 11.46 | 11.46 | 0.00 | OK |

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
| E | 1 | 1000 | 1000 | 1761.2 | 1591.0 | 2973.4 | 3910.8 | 496.9 | 4211.4 | 11.46 |