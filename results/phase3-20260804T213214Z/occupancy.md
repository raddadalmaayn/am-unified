## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A r1 | 1 | 500 | 500 | 500 | 1.00 | 2.32 | 2.28 | 421.9 | 83.9 | 323.8 | yes |
| A r2 | 1 | 500 | 500 | 500 | 1.00 | 2.38 | 2.34 | 403.4 | 69.8 | 323.5 | yes |
| A r3 | 1 | 500 | 500 | 500 | 1.00 | 2.36 | 2.32 | 401.6 | 71.9 | 323.4 | yes |
| B r1 | 1 | 500 | 500 | 500 | 1.00 | 2.31 | 2.28 | 418.3 | 84.5 | 324.4 | yes |
| B r2 | 1 | 500 | 500 | 500 | 1.00 | 2.30 | 2.27 | 411.3 | 79.4 | 325.2 | yes |
| B r3 | 1 | 500 | 500 | 500 | 1.00 | 2.28 | 2.25 | 423.0 | 87.1 | 326.1 | yes |
| C r1 | 1 | 500 | 500 | 500 | 1.00 | 2.30 | 2.26 | 412.7 | 84.3 | 320.2 | yes |
| C r2 | 1 | 500 | 500 | 500 | 1.00 | 2.27 | 2.24 | 413.6 | 92.4 | 320.5 | yes |
| C r3 | 1 | 500 | 500 | 500 | 1.00 | 2.33 | 2.30 | 402.7 | 76.2 | 319.8 | yes |
| D r1 | 1 | 500 | 500 | 0 | n/a | n/a | 251.54 | 3.9 | n/a | n/a | yes |
| D r2 | 1 | 500 | 500 | 0 | n/a | n/a | 255.58 | 3.8 | n/a | n/a | yes |
| D r3 | 1 | 500 | 500 | 0 | n/a | n/a | 249.95 | 3.9 | n/a | n/a | yes |
| E r1 | 20 | 2000 | 2000 | 620 | 3.23 | 3.66 | 11.10 | 1625.0 | 382.1 | 1193.1 | yes |
| E r2 | 20 | 2000 | 2000 | 659 | 3.03 | 3.90 | 11.13 | 1781.1 | 365.3 | 1318.4 | yes |
| E r3 | 20 | 2000 | 2000 | 671 | 2.98 | 3.86 | 10.80 | 1790.2 | 383.3 | 1333.5 | yes |
| F r1 | 20 | 2000 | 2000 | 683 | 2.93 | 3.89 | 10.69 | 1797.4 | 387.1 | 1379.8 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| A | 1 | 1.00 | 2.36 | 2.32 | 2.32 | 403.4 |
| B | 1 | 1.00 | 2.30 | 2.27 | 2.27 | 418.3 |
| C | 1 | 1.00 | 2.30 | 2.26 | 2.26 | 412.7 |
| D | 1 | n/a | n/a | n/a | 251.54 | 3.9 |
| E | 20 | 3.03 | 3.86 | 3.73 | 11.10 | 1781.1 |
| F | 20 | 2.93 | 3.89 | 3.74 | 10.69 | 1797.4 |

### Hypothesis verdict

Condition E (W=20), median tx_per_block = **3.03**, median block_rate = **3.86/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 10; occupancy 30.3% of budget; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| A | 1 | true | 246 | 1 |
| A | 2 | true | 469 | 1 |
| A | 3 | true | 225 | 1 |
| B | 1 | true | 264 | 1 |
| B | 2 | true | 460 | 1 |
| B | 3 | true | 340 | 1 |
| C | 1 | true | 1529 | 2 |
| C | 2 | true | 339 | 1 |
| C | 3 | true | 215 | 1 |
| D | 1 | true | 225 | 1 |
| D | 2 | true | 220 | 1 |
| D | 3 | true | 218 | 1 |
| E | 1 | true | 65050 | 48 |
| E | 2 | true | 76173 | 56 |
| E | 3 | true | 73547 | 54 |
| F | 1 | true | 77804 | 57 |

wrote am-unified/results/phase3-20260804T213214Z/occupancy.md
