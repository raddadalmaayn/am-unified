## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A r1 | 1 | 500 | 500 | 500 | 1.00 | 22.38 | 20.50 | 47.2 | 12.1 | 35.0 | yes |
| A r2 | 1 | 500 | 500 | 500 | 1.00 | 19.43 | 17.88 | 56.2 | 12.3 | 43.2 | yes |
| A r3 | 1 | 500 | 500 | 500 | 1.00 | 22.75 | 20.84 | 47.3 | 12.7 | 34.7 | yes |
| B r1 | 1 | 500 | 500 | 500 | 1.00 | 20.74 | 18.96 | 51.2 | 16.4 | 35.0 | yes |
| B r2 | 1 | 500 | 500 | 500 | 1.00 | 23.11 | 21.07 | 47.7 | 14.1 | 33.6 | yes |
| B r3 | 1 | 500 | 500 | 500 | 1.00 | 21.50 | 19.57 | 48.8 | 14.0 | 34.3 | yes |
| C r1 | 1 | 500 | 500 | 500 | 1.00 | 22.19 | 20.28 | 49.4 | 16.0 | 33.5 | yes |
| C r2 | 1 | 500 | 500 | 500 | 1.00 | 19.56 | 17.92 | 54.7 | 16.4 | 38.9 | yes |
| C r3 | 1 | 500 | 500 | 500 | 1.00 | 21.95 | 20.11 | 50.1 | 16.5 | 33.7 | yes |
| D r1 | 1 | 500 | 500 | 0 | n/a | n/a | 128.12 | 7.8 | n/a | n/a | yes |
| D r2 | 1 | 500 | 500 | 0 | n/a | n/a | 131.77 | 7.6 | n/a | n/a | yes |
| D r3 | 1 | 500 | 500 | 0 | n/a | n/a | 131.14 | 7.6 | n/a | n/a | yes |
| E r1 | 100 | 2000 | 2000 | 264 | 7.58 | 72.43 | 411.28 | 225.4 | 83.2 | 141.1 | yes |
| E r2 | 100 | 2000 | 2000 | 266 | 7.52 | 69.33 | 390.71 | 245.4 | 88.2 | 154.4 | yes |
| E r3 | 100 | 2000 | 2000 | 274 | 7.30 | 69.78 | 381.78 | 246.8 | 91.3 | 153.8 | yes |
| F r1 | 100 | 2000 | 2000 | 286 | 6.99 | 67.01 | 351.21 | 276.8 | 100.8 | 170.4 | yes |
| F r2 | 100 | 2000 | 2000 | 259 | 7.72 | 64.98 | 376.08 | 251.9 | 95.5 | 150.8 | yes |
| F r3 | 100 | 2000 | 2000 | 297 | 6.73 | 68.96 | 348.08 | 260.3 | 99.0 | 156.5 | yes |
| G r1 | 100 | 2000 | 2000 | 326 | 6.13 | 67.97 | 312.52 | 302.8 | 111.5 | 180.9 | yes |
| G r2 | 100 | 2000 | 2000 | 308 | 6.49 | 71.19 | 346.46 | 274.0 | 101.4 | 165.2 | yes |
| G r3 | 100 | 2000 | 2000 | 310 | 6.45 | 72.81 | 352.08 | 276.0 | 103.5 | 167.8 | yes |
| H r1 | 100 | 500 | 9 | 66 | 0.14 | n/a | n/a | n/a | n/a | n/a | yes |
| H r2 | 100 | 500 | 9 | 70 | 0.13 | n/a | n/a | n/a | n/a | n/a | yes |
| H r3 | 100 | 500 | 9 | 58 | 0.16 | n/a | n/a | n/a | n/a | n/a | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| A | 1 | 1.00 | 22.38 | 20.42 | 20.50 | 47.3 |
| B | 1 | 1.00 | 21.50 | 19.70 | 19.57 | 48.8 |
| C | 1 | 1.00 | 21.95 | 20.08 | 20.11 | 50.1 |
| D | 1 | n/a | n/a | n/a | 131.14 | 7.6 |
| E | 100 | 7.52 | 69.78 | 51.01 | 390.71 | 245.4 |
| F | 100 | 6.99 | 67.01 | 49.21 | 351.21 | 260.3 |
| G | 100 | 6.45 | 71.19 | 52.53 | 346.46 | 276.0 |
| H | 100 | 0.14 | n/a | 47.96 | n/a | n/a |

### Hypothesis verdict

Condition E (W=100), median tx_per_block = **7.52**, median block_rate = **69.78/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 100; occupancy 7.5% of budget; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| A | 1 | true | 168 | 1 |
| A | 2 | true | 151 | 1 |
| A | 3 | true | 121 | 1 |
| B | 1 | true | 165 | 1 |
| B | 2 | true | 115 | 1 |
| B | 3 | true | 107 | 1 |
| C | 1 | true | 123 | 1 |
| C | 2 | true | 112 | 1 |
| C | 3 | true | 112 | 1 |
| D | 1 | true | 114 | 1 |
| D | 2 | true | 123 | 1 |
| D | 3 | true | 183 | 1 |
| E | 1 | true | 132 | 1 |
| E | 2 | true | 109 | 1 |
| E | 3 | true | 125 | 1 |
| F | 1 | true | 181 | 1 |
| F | 2 | true | 143 | 1 |
| F | 3 | true | 106 | 1 |
| G | 1 | true | 135 | 1 |
| G | 2 | true | 116 | 1 |
| G | 3 | true | 130 | 1 |
| H | 1 | true | 108 | 1 |
| H | 2 | true | 125 | 1 |
| H | 3 | true | 116 | 1 |

wrote am-unified/results/phase8-20260810T040300Z/occupancy.md
