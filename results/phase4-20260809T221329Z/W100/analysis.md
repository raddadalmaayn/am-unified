# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 6000 | 6000 | 0 | 7887.8 | 8089.5 | 11358.0 | 11820.9 | 394.0 | 7654.5 | 12.47 |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 7330.8 | 10106.5 | 2775.7 | 10.33 | 12.85 | 2.51 | OK |

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
| E | 1 | 2000 | 2000 | 7722.9 | 7330.8 | 11358.0 | 11820.9 | 4314.8 | 12253.0 | 12.85 |
| E | 2 | 2000 | 2000 | 7887.8 | 8089.5 | 9569.7 | 9948.6 | 4216.9 | 10254.8 | 12.47 |
| E | 3 | 2000 | 2000 | 9539.4 | 10106.5 | 12122.3 | 12728.5 | 4935.4 | 13127.2 | 10.33 |