# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 3 | 1500 | 1500 | 0 | 76.6 | 76.6 | 80.0 | 83.4 | 6.8 | 70.0 | 13.04 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| A | 76.5 | 90.8 | 14.3 | 10.73 | 13.04 | 2.31 | OK |

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
| A | 1 | 500 | 500 | 93.0 | 90.8 | 104.2 | 109.6 | 71.6 | 112.2 | 10.73 |
| A | 2 | 500 | 500 | 76.6 | 76.5 | 80.0 | 83.4 | 72.0 | 86.0 | 13.04 |
| A | 3 | 500 | 500 | 76.6 | 76.6 | 79.8 | 83.3 | 70.9 | 85.1 | 13.04 |