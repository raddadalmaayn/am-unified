## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 50 | 2000 | 2000 | 640 | 3.13 | 3.93 | 10.73 | 4620.5 | 414.5 | 4148.1 | yes |
| E r2 | 50 | 2000 | 2000 | 604 | 3.31 | 4.07 | 11.78 | 4257.8 | 414.4 | 3831.9 | yes |
| E r3 | 50 | 2000 | 2000 | 517 | 3.87 | 4.21 | 14.23 | 3419.8 | 414.6 | 2967.6 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 50 | 3.31 | 4.07 | 3.69 | 11.78 | 4257.8 |

### Hypothesis verdict

Condition E (W=20), median tx_per_block = **3.31**, median block_rate = **4.07/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 10; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 76030 | 55 |
| E | 2 | true | 82454 | 60 |
| E | 3 | true | 79082 | 57 |

wrote am-unified/results/phase4-20260809T221329Z/W50/occupancy.md
