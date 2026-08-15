# Benchmark analysis

Derived solely from `txs.jsonl`. No summary file was read.

## Per-condition summary (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 6000 | 6000 | 0 | 519.3 | 525.2 | 688.9 | 777.1 | 185.7 | 321.1 | 187.95 |
| F | 3 | 6000 | 6000 | 0 | 568.3 | 526.5 | 807.5 | 913.4 | 197.1 | 329.3 | 173.16 |
| G | 3 | 6000 | 6000 | 0 | 620.0 | 601.2 | 876.3 | 992.9 | 232.2 | 367.3 | 152.98 |
| H | 3 | 1500 | 30 | 1470 | 533.8 | 602.8 | 642.0 | 642.0 | 199.9 | 352.1 | n/a |

## Per-run spread

| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |
|---|---|---|---|---|---|---|---|
| E | 520.6 | 525.7 | 5.0 | 186.87 | 188.50 | 1.62 | OK |
| F | 524.3 | 619.0 | 94.6 | 156.43 | 174.80 | 18.36 | OK |
| G | 572.2 | 641.2 | 69.1 | 148.84 | 169.79 | 20.94 | OK |
| H | 432.5 | 609.8 | 177.3 | n/a | n/a | n/a | OK |

## Failure breakdown by class

| Cond | n | MVCC_READ_CONFLICT | ENDORSE_MISMATCH |
|---|---|---|---|
| E | 6000 | 0 (0.00%) | 0 (0.00%) |
| F | 6000 | 0 (0.00%) | 0 (0.00%) |
| G | 6000 | 0 (0.00%) | 0 (0.00%) |
| H | 1500 | 1465 (97.67%) | 5 (0.33%) |

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
| F | 6000 | MVCC_READ_CONFLICT | 0.0500% | 0.0640% |
| F | 6000 | PHANTOM_READ_CONFLICT | 0.0500% | 0.0640% |
| F | 6000 | ENDORSEMENT_POLICY_FAILURE | 0.0500% | 0.0640% |
| F | 6000 | CHAINCODE_REJECT | 0.0500% | 0.0640% |
| F | 6000 | ENDORSE_MISMATCH | 0.0500% | 0.0640% |
| F | 6000 | GATEWAY_DEADLINE | 0.0500% | 0.0640% |
| F | 6000 | GATEWAY_UNAVAILABLE | 0.0500% | 0.0640% |
| F | 6000 | ORDERER_UNAVAILABLE | 0.0500% | 0.0640% |
| F | 6000 | COMMIT_TIMEOUT | 0.0500% | 0.0640% |
| F | 6000 | OTHER | 0.0500% | 0.0640% |
| G | 6000 | MVCC_READ_CONFLICT | 0.0500% | 0.0640% |
| G | 6000 | PHANTOM_READ_CONFLICT | 0.0500% | 0.0640% |
| G | 6000 | ENDORSEMENT_POLICY_FAILURE | 0.0500% | 0.0640% |
| G | 6000 | CHAINCODE_REJECT | 0.0500% | 0.0640% |
| G | 6000 | ENDORSE_MISMATCH | 0.0500% | 0.0640% |
| G | 6000 | GATEWAY_DEADLINE | 0.0500% | 0.0640% |
| G | 6000 | GATEWAY_UNAVAILABLE | 0.0500% | 0.0640% |
| G | 6000 | ORDERER_UNAVAILABLE | 0.0500% | 0.0640% |
| G | 6000 | COMMIT_TIMEOUT | 0.0500% | 0.0640% |
| G | 6000 | OTHER | 0.0500% | 0.0640% |
| H | 1500 | PHANTOM_READ_CONFLICT | 0.2000% | 0.2555% |
| H | 1500 | ENDORSEMENT_POLICY_FAILURE | 0.2000% | 0.2555% |
| H | 1500 | CHAINCODE_REJECT | 0.2000% | 0.2555% |
| H | 1500 | GATEWAY_DEADLINE | 0.2000% | 0.2555% |
| H | 1500 | GATEWAY_UNAVAILABLE | 0.2000% | 0.2555% |
| H | 1500 | ORDERER_UNAVAILABLE | 0.2000% | 0.2555% |
| H | 1500 | COMMIT_TIMEOUT | 0.2000% | 0.2555% |
| H | 1500 | OTHER | 0.2000% | 0.2555% |

## Per-run detail

| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|
| E | 1 | 2000 | 2000 | 522.6 | 525.7 | 649.1 | 732.6 | 201.9 | 884.0 | 188.50 |
| E | 2 | 2000 | 2000 | 519.2 | 520.6 | 690.8 | 777.1 | 314.1 | 909.6 | 186.87 |
| E | 3 | 2000 | 2000 | 519.3 | 525.2 | 688.9 | 796.5 | 151.1 | 907.3 | 187.95 |
| F | 1 | 2000 | 2000 | 604.7 | 619.0 | 807.5 | 913.4 | 138.4 | 1093.0 | 156.43 |
| F | 2 | 2000 | 2000 | 551.5 | 526.5 | 784.0 | 900.7 | 303.7 | 1040.8 | 174.80 |
| F | 3 | 2000 | 2000 | 568.3 | 524.3 | 845.3 | 932.4 | 358.1 | 1143.3 | 173.16 |
| G | 1 | 2000 | 2000 | 584.5 | 572.2 | 807.3 | 926.6 | 259.9 | 1077.4 | 169.79 |
| G | 2 | 2000 | 2000 | 620.0 | 601.2 | 876.3 | 992.9 | 161.2 | 1330.9 | 152.98 |
| G | 3 | 2000 | 2000 | 656.0 | 641.2 | 947.1 | 1094.3 | 207.4 | 1515.4 | 148.84 |
| H | 1 | 500 | 10 | 533.8 | 602.8 | 642.0 | 642.0 | 214.9 | 642.0 | n/a |
| H | 2 | 500 | 10 | 583.9 | 609.8 | 700.9 | 700.9 | 409.6 | 700.9 | n/a |
| H | 3 | 500 | 10 | 421.6 | 432.5 | 574.6 | 574.6 | 231.7 | 574.6 | n/a |