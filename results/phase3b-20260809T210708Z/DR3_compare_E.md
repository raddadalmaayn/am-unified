### Per-run, both sessions (not merged)

| Session | Run | Committed | P50 ms | P95 ms | P99 ms | Endorse med ms | Ord+Commit med ms | Steady TPS | Blocks | tx/block | Converge ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-04 | run1 | 2000 | 1616.8 | 3132.0 | 3691.5 | 381.0 | 1190.9 | 11.24 | 620 | 3.23 | 65,050 |
| 2026-08-04 | run2 | 2000 | 1778.2 | 2537.0 | 2765.7 | 366.4 | 1311.7 | 11.23 | 659 | 3.03 | 76,173 |
| 2026-08-04 | run3 | 2000 | 1791.2 | 2815.6 | 3151.8 | 384.1 | 1330.5 | 10.94 | 671 | 2.98 | 73,547 |
| 2026-08-09 | run1 | 2000 | 1507.1 | 2641.8 | 3300.2 | 394.7 | 1025.7 | 12.73 | 576 | 3.47 | 84,538 |
| 2026-08-09 | run2 | 2000 | 1776.8 | 3051.5 | 5195.0 | 402.6 | 1290.1 | 10.64 | 661 | 3.03 | 93,329 |
| 2026-08-09 | run3 | 2000 | 1609.3 | 2609.2 | 3031.9 | 396.1 | 1227.8 | 11.86 | 608 | 3.29 | 89,951 |

### Median across three runs, side by side

| Metric | 2026-08-04 | 2026-08-09 | Δ | Δ % |
|---|---|---|---|---|
| P50 total latency ms | 1778.2 | 1609.3 | -168.9 | -9.5% |
| P95 total latency ms | 2815.6 | 2641.8 | -173.9 | -6.2% |
| Endorse median ms | 381.0 | 396.1 | +15.1 | +4.0% |
| Order+commit median ms | 1311.7 | 1227.8 | -83.8 | -6.4% |
| Steady TPS tx/s | 11.23 | 11.86 | +0.62 | +5.6% |
| tx_per_block  | 3.03 | 3.29 | +0.25 | +8.4% |
| Convergence wait ms | 73547 | 89951 | +16404 | +22.3% |

### Starting state size per session

- **2026-08-04**: counted_keys not recorded (harness predates v2.1.0); state size for this session is reported at phase level instead. No value is substituted.
- **2026-08-09**: counted_keys at run start = 94,287, 94,287, 94,287
