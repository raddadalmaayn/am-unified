# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 6000 | 6000 | 0 | 14644.6 | 15474.1 | 17464.5 | 17772.6 | 412.9 | 14962.0 | 13.24 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 14339.3 | 16998.9 | 2659.6 | 12.81 | 14.47 | 1.67 | OK |

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
| E | 1 | 2000 | 2000 | 15211.6 | 16998.9 | 18376.0 | 18684.0 | 6162.9 | 18859.4 | 12.81 |
| E | 2 | 2000 | 2000 | 14644.6 | 15474.1 | 17464.5 | 17772.6 | 6430.7 | 18058.8 | 13.24 |
| E | 3 | 2000 | 2000 | 13763.9 | 14339.3 | 17174.7 | 17596.6 | 6800.1 | 18055.7 | 14.47 |