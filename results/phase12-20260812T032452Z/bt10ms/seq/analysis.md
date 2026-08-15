# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 3 | 1500 | 1500 | 0 | 40.1 | 40.9 | 48.2 | 54.2 | 6.7 | 30.8 | 24.90 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| A | 35.2 | 45.8 | 10.6 | 21.88 | 27.45 | 5.56 | OK |

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

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 1 | 500 | 500 | 45.5 | 45.8 | 50.0 | 54.2 | 31.1 | 55.3 | 21.88 |
| A | 2 | 500 | 500 | 36.4 | 35.2 | 46.0 | 56.1 | 27.9 | 65.6 | 27.45 |
| A | 3 | 500 | 500 | 40.1 | 40.9 | 48.2 | 52.4 | 29.0 | 57.9 | 24.90 |