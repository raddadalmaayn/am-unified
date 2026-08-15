## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A r1 | 1 | 500 | 500 | 500 | 1.00 | 24.00 | 21.89 | 45.8 | 11.8 | 34.0 | yes |
| A r2 | 1 | 500 | 500 | 500 | 1.00 | 30.91 | 27.45 | 35.2 | 6.6 | 28.7 | yes |
| A r3 | 1 | 500 | 500 | 500 | 1.00 | 28.16 | 24.90 | 40.9 | 6.7 | 30.7 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| A | 1 | 1.00 | 28.16 | 25.21 | 24.90 | 40.9 |

### Hypothesis verdict

Condition E not present in this dataset.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| A | 1 | true | 127 | 1 |
| A | 2 | true | 97 | 1 |
| A | 3 | true | 110 | 1 |