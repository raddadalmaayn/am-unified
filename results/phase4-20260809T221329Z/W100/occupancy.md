## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 100 | 2000 | 2000 | 546 | 3.66 | 4.13 | 12.84 | 7264.8 | 379.7 | 6877.1 | yes |
| E r2 | 100 | 2000 | 2000 | 559 | 3.58 | 4.11 | 12.48 | 8051.7 | 403.1 | 7614.9 | yes |
| E r3 | 100 | 2000 | 2000 | 664 | 3.01 | 4.04 | 10.34 | 10078.2 | 391.3 | 9661.6 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 100 | 3.58 | 4.11 | 3.66 | 12.48 | 8051.7 |

### Hypothesis verdict

Condition E (W=20), median tx_per_block = **3.58**, median block_rate = **4.11/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = 10; blocks are NOT filling.

**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 74013 | 54 |
| E | 2 | true | 69862 | 51 |
| E | 3 | true | 75376 | 56 |

wrote am-unified/results/phase4-20260809T221329Z/W100/occupancy.md
