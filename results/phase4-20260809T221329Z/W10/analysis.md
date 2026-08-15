# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 1500 | 1500 | 0 | 734.5 | 645.5 | 1290.5 | 1600.9 | 262.5 | 358.4 | 13.66 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 577.8 | 966.5 | 388.7 | 10.72 | 16.42 | 5.71 | OK |

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
| E | 1 | 500 | 500 | 734.5 | 645.5 | 1290.5 | 1600.9 | 277.2 | 1607.1 | 13.66 |
| E | 2 | 500 | 500 | 605.7 | 577.8 | 1153.8 | 1428.7 | 277.0 | 1476.9 | 16.42 |
| E | 3 | 500 | 500 | 929.6 | 966.5 | 1537.0 | 2001.2 | 300.0 | 2024.7 | 10.72 |