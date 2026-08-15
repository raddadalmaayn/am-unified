## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 20 | 1000 | 1000 | 309 | 3.24 | 4.03 | 11.46 | 1586.0 | 362.9 | 1190.9 | yes |
| E r1 | 20 | 1000 | 1000 | 366 | 2.73 | 3.95 | 9.49 | 2071.8 | 382.5 | 1677.1 | NO |
| E r1 | 20 | 1000 | 1000 | 402 | 2.49 | 3.96 | 8.66 | 2244.8 | 374.3 | 1811.6 | NO |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 20 | 2.73 | 3.96 | 3.59 | 9.49 | 2071.8 |

### Hypothesis verdict

Condition E (W=20), median tx_per_block = **2.73**, median block_rate = **3.96/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 10; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 30064 | 35 |
| E | 1 | false | 30273 | 36 |
| E | 1 | false | 30468 | 36 |