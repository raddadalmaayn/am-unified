# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 300 | 300 | 0 | 431.1 | 411.9 | 723.3 | 1002.5 | 92.8 | 315.8 | 2.32 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 390.0 | 413.2 | 23.2 | 2.29 | 2.32 | 0.03 | OK |

## Failure breakdown by class

No failures recorded in any condition.

## Zero-event upper bounds (95%)

| Cond | n | Class | Rule-of-three upper | Wilson upper |
|---|---|---|---|---|
| E | 300 | MVCC_READ_CONFLICT | 1.0000% | 1.2643% |
| E | 300 | PHANTOM_READ_CONFLICT | 1.0000% | 1.2643% |
| E | 300 | ENDORSEMENT_POLICY_FAILURE | 1.0000% | 1.2643% |
| E | 300 | CHAINCODE_REJECT | 1.0000% | 1.2643% |
| E | 300 | ENDORSE_MISMATCH | 1.0000% | 1.2643% |
| E | 300 | GATEWAY_DEADLINE | 1.0000% | 1.2643% |
| E | 300 | GATEWAY_UNAVAILABLE | 1.0000% | 1.2643% |
| E | 300 | ORDERER_UNAVAILABLE | 1.0000% | 1.2643% |
| E | 300 | COMMIT_TIMEOUT | 1.0000% | 1.2643% |
| E | 300 | OTHER | 1.0000% | 1.2643% |

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 100 | 100 | 436.5 | 413.2 | 699.3 | 1111.0 | 299.9 | 1111.0 | 2.29 |
| E | 2 | 100 | 100 | 431.1 | 411.9 | 757.6 | 911.0 | 310.5 | 911.0 | 2.32 |
| E | 3 | 100 | 100 | 430.3 | 390.0 | 723.3 | 1002.5 | 302.7 | 1002.5 | 2.32 |