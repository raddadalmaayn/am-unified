## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 200 | 2000 | 2000 | 514 | 3.89 | 4.28 | 12.82 | 16744.6 | 437.7 | 16221.1 | yes |
| E r2 | 200 | 2000 | 2000 | 501 | 3.99 | 4.31 | 13.25 | 14977.8 | 405.2 | 14570.9 | yes |
| E r3 | 200 | 2000 | 2000 | 490 | 4.08 | 4.59 | 14.49 | 14200.0 | 411.4 | 13711.7 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 200 | 3.99 | 4.31 | 3.59 | 13.25 | 14977.8 |

### Hypothesis verdict

Condition E (W=20), median tx_per_block = **3.99**, median block_rate = **4.31/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 10; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 64198 | 46 |
| E | 2 | true | 58150 | 42 |
| E | 3 | true | 62477 | 46 |

wrote am-unified/results/phase4-20260809T221329Z/W200/occupancy.md
