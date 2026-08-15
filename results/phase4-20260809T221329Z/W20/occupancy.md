## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 20 | 500 | 500 | 141 | 3.55 | 4.24 | 12.76 | 1507.5 | 405.8 | 1142.1 | yes |
| E r2 | 20 | 500 | 500 | 115 | 4.35 | 4.42 | 15.61 | 1246.6 | 361.7 | 763.7 | yes |
| E r3 | 20 | 500 | 500 | 154 | 3.25 | 4.32 | 11.69 | 1737.7 | 356.4 | 1263.9 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 20 | 3.55 | 4.32 | 3.81 | 12.76 | 1507.5 |

### Hypothesis verdict

Condition E (W=20), median tx_per_block = **3.55**, median block_rate = **4.32/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 10; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 17808 | 14 |
| E | 2 | true | 14070 | 11 |
| E | 3 | true | 18496 | 14 |

wrote am-unified/results/phase4-20260809T221329Z/W20/occupancy.md
