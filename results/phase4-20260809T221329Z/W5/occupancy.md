## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 5 | 500 | 500 | 182 | 2.75 | 3.10 | 7.98 | 587.4 | 165.0 | 336.8 | yes |
| E r2 | 5 | 500 | 500 | 175 | 2.86 | 3.14 | 8.41 | 564.3 | 133.6 | 328.6 | yes |
| E r3 | 5 | 500 | 500 | 168 | 2.98 | 2.97 | 8.28 | 561.5 | 110.7 | 331.0 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 5 | 2.86 | 3.10 | 2.94 | 8.28 | 564.3 |

### Hypothesis verdict

Condition E (W=20), median tx_per_block = **2.86**, median block_rate = **3.10/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 10; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 10156 | 8 |
| E | 2 | true | 13593 | 11 |
| E | 3 | true | 7833 | 6 |

wrote am-unified/results/phase4-20260809T221329Z/W5/occupancy.md
