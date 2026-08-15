## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 20 | 2000 | 2000 | 576 | 3.47 | 3.85 | 12.57 | 1504.4 | 394.6 | 1019.3 | yes |
| E r2 | 20 | 2000 | 2000 | 661 | 3.03 | 3.70 | 10.51 | 1780.9 | 401.5 | 1306.9 | yes |
| E r3 | 20 | 2000 | 2000 | 608 | 3.29 | 3.79 | 11.70 | 1605.1 | 394.6 | 1227.1 | yes |
| F r1 | 20 | 2000 | 2000 | 588 | 3.40 | 3.73 | 11.93 | 1596.8 | 402.4 | 1162.4 | yes |
| F r2 | 20 | 2000 | 2000 | 552 | 3.62 | 3.68 | 12.52 | 1541.7 | 442.4 | 996.5 | yes |
| F r3 | 20 | 2000 | 2000 | 624 | 3.21 | 3.72 | 11.19 | 1778.7 | 406.8 | 1282.0 | yes |
| G r1 | 20 | 2000 | 2000 | 563 | 3.55 | 3.71 | 12.37 | 1560.8 | 451.2 | 1054.5 | yes |
| G r2 | 20 | 2000 | 2000 | 610 | 3.28 | 3.60 | 11.09 | 1701.1 | 428.0 | 1241.1 | yes |
| G r3 | 20 | 2000 | 2000 | 574 | 3.48 | 3.71 | 12.14 | 1556.1 | 423.5 | 1115.0 | yes |
| H r1 | 20 | 500 | 27 | 34 | 0.79 | 50.85 | 2.99 | 497.5 | 184.6 | 316.4 | yes |
| H r2 | 20 | 500 | 28 | 38 | 0.74 | 33.99 | 2.68 | 503.6 | 178.1 | 337.0 | yes |
| H r3 | 20 | 500 | 28 | 39 | 0.72 | 27.79 | 2.14 | 766.3 | 254.3 | 491.1 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 20 | 3.29 | 3.79 | 3.63 | 11.70 | 1605.1 |
| F | 20 | 3.40 | 3.72 | 3.57 | 11.93 | 1596.8 |
| G | 20 | 3.48 | 3.71 | 3.54 | 12.14 | 1560.8 |
| H | 20 | 0.74 | 33.99 | 2.99 | 2.68 | 503.6 |

### Hypothesis verdict

Condition E (W=20), median tx_per_block = **3.29**, median block_rate = **3.79/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 10; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 84538 | 59 |
| E | 2 | true | 93329 | 66 |
| E | 3 | true | 89951 | 64 |
| F | 1 | true | 89831 | 65 |
| F | 2 | true | 85636 | 61 |
| F | 3 | true | 92456 | 66 |
| G | 1 | true | 82476 | 60 |
| G | 2 | true | 80690 | 57 |
| G | 3 | true | 84530 | 61 |
| H | 1 | true | 1745 | 2 |
| H | 2 | true | 2705 | 3 |
| H | 3 | true | 1691 | 2 |

wrote am-unified/results/phase3b-20260809T210708Z/occupancy.md
