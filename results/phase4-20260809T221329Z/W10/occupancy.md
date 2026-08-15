## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 10 | 500 | 500 | 122 | 4.10 | 3.83 | 13.79 | 638.7 | 260.8 | 356.8 | yes |
| E r2 | 10 | 500 | 500 | 94 | 5.32 | 3.58 | 16.55 | 576.3 | 128.0 | 325.0 | yes |
| E r3 | 10 | 500 | 500 | 161 | 3.11 | 3.96 | 10.77 | 965.3 | 308.1 | 510.0 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 10 | 4.10 | 3.83 | 3.35 | 13.79 | 638.7 |

### Hypothesis verdict

Condition E (W=20), median tx_per_block = **4.10**, median block_rate = **3.83/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 10; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 13842 | 11 |
| E | 2 | true | 8802 | 7 |
| E | 3 | true | 18725 | 14 |

wrote am-unified/results/phase4-20260809T221329Z/W10/occupancy.md
