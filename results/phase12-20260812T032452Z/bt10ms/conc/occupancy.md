## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 100 | 2000 | 2000 | 256 | 7.81 | 70.19 | 411.02 | 235.2 | 88.7 | 143.8 | yes |
| E r2 | 100 | 2000 | 2000 | 277 | 7.22 | 79.21 | 428.65 | 228.4 | 83.3 | 143.5 | yes |
| E r3 | 100 | 2000 | 2000 | 253 | 7.91 | 71.97 | 426.43 | 225.9 | 83.6 | 141.5 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 100 | 7.81 | 71.97 | 51.72 | 426.43 | 228.4 |

### Hypothesis verdict

Condition E (W=100), median tx_per_block = **7.81**, median block_rate = **71.97/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = UNKNOWN (not recorded in manifest); occupancy n/a; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 86 | 1 |
| E | 2 | true | 91 | 1 |
| E | 3 | true | 98 | 1 |