## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A r1 | 1 | 500 | 500 | 500 | 1.00 | 11.29 | 10.73 | 90.8 | 11.7 | 79.0 | yes |
| A r2 | 1 | 500 | 500 | 500 | 1.00 | 13.85 | 13.04 | 76.5 | 6.8 | 69.7 | yes |
| A r3 | 1 | 500 | 500 | 500 | 1.00 | 13.81 | 13.04 | 76.6 | 6.7 | 70.0 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| A | 1 | 1.00 | 13.81 | 13.03 | 13.04 | 76.6 |

### Hypothesis verdict

Condition E not present in this dataset.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| A | 1 | true | 91 | 1 |
| A | 2 | true | 85 | 1 |
| A | 3 | true | 96 | 1 |