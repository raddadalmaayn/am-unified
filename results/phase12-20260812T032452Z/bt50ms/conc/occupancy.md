## Block occupancy per condition

`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.
`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.

| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E r1 | 100 | 2000 | 2000 | 87 | 22.99 | 23.97 | 412.98 | 235.2 | 85.8 | 147.7 | yes |
| E r2 | 100 | 2000 | 2000 | 80 | 25.00 | 22.45 | 420.63 | 233.8 | 85.2 | 147.3 | yes |
| E r3 | 100 | 2000 | 2000 | 82 | 24.39 | 23.25 | 425.04 | 225.2 | 81.2 | 143.3 | yes |

### Median across runs, per condition

| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |
|---|---|---|---|---|---|---|
| E | 100 | 24.39 | 23.25 | 16.49 | 420.63 | 233.8 |

### Hypothesis verdict

Condition E (W=100), median tx_per_block = **24.39**, median block_rate = **23.25/s**.

- Blocks carry roughly one transaction (tx_per_block < 2): **NO**
- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.
- MaxMessageCount = UNKNOWN (not recorded in manifest); occupancy n/a; blocks are NOT filling.

**MaxMessageCount IS binding.** Phase 7b is warranted.

### Ledger convergence per run

| Cond | Run | Converged | wait_ms | polls |
|---|---|---|---|---|
| E | 1 | true | 89 | 1 |
| E | 2 | true | 93 | 1 |
| E | 3 | true | 91 | 1 |