## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 100 | 2000 | 2000 | 422 | 4.74 | 49.78 | 188.50 | 526.1 | 183.8 | 332.9 | yes |
| E r2 | 100 | 2000 | 2000 | 443 | 4.51 | 51.55 | 186.87 | 526.2 | 186.1 | 322.3 | yes |
| E r3 | 100 | 2000 | 2000 | 410 | 4.88 | 48.19 | 187.95 | 535.8 | 190.2 | 321.2 | yes |
| F r1 | 100 | 2000 | 2000 | 442 | 4.52 | 45.82 | 156.43 | 620.8 | 225.5 | 384.4 | yes |
| F r2 | 100 | 2000 | 2000 | 417 | 4.80 | 48.50 | 174.80 | 525.5 | 194.6 | 324.7 | yes |
| F r3 | 100 | 2000 | 2000 | 434 | 4.61 | 47.24 | 173.16 | 522.3 | 191.0 | 330.4 | yes |
| G r1 | 100 | 2000 | 2000 | 481 | 4.16 | 48.18 | 169.79 | 572.8 | 222.5 | 334.0 | yes |
| G r2 | 100 | 2000 | 2000 | 498 | 4.02 | 47.44 | 152.98 | 607.2 | 233.8 | 372.6 | yes |
| G r3 | 100 | 2000 | 2000 | 533 | 3.75 | 48.08 | 148.84 | 647.3 | 232.3 | 393.9 | yes |
| H r1 | 100 | 500 | 10 | 108 | 0.09 | n/a | n/a | n/a | n/a | n/a | yes |
| H r2 | 100 | 500 | 10 | 105 | 0.10 | n/a | n/a | n/a | n/a | n/a | yes |
| H r3 | 100 | 500 | 10 | 93 | 0.11 | n/a | n/a | n/a | n/a | n/a | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 100 | 4.74 | 49.78 | 37.15 | 187.95 | 526.2 |
| F | 100 | 4.61 | 47.24 | 35.92 | 173.16 | 525.5 |
| G | 100 | 4.02 | 48.08 | 37.74 | 152.98 | 607.2 |
| H | 100 | 0.10 | n/a | 32.50 | n/a | n/a |

### Hypothesis verdict

Condition E (W=100), median tx_per_block = **4.74**, median block_rate = **49.78/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 100; occupancy 4.7% of budget; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 172 | 1 |
| E | 2 | true | 204 | 1 |
| E | 3 | true | 173 | 1 |
| F | 1 | true | 199 | 1 |
| F | 2 | true | 217 | 1 |
| F | 3 | true | 229 | 1 |
| G | 1 | true | 218 | 1 |
| G | 2 | true | 229 | 1 |
| G | 3 | true | 218 | 1 |
| H | 1 | true | 197 | 1 |
| H | 2 | true | 214 | 1 |
| H | 3 | true | 183 | 1 |

wrote am-unified/results/phase8b-20260810T202806Z/occupancy.md
