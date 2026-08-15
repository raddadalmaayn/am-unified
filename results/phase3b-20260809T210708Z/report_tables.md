### Per-run verification

| Run | submitted = committed + errors | Invariant | Peers agree (h, hash) | netem | cc sha256 all 4 | Resource coverage |
|---|---|---|---|---|---|---|
| E/run1 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| E/run2 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| E/run3 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| F/run1 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| F/run2 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| F/run3 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| G/run1 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| G/run2 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| G/run3 | 2000 = 2000 + 0 | OK | True, True | null | match | FULL |
| H/run1 | 500 = 27 + 473 | OK | True, True | null | match | FULL |
| H/run2 | 500 = 28 + 472 | OK | True, True | null | match | FULL |
| H/run3 | 500 = 28 + 472 | OK | True, True | null | match | FULL |

### Run timeline

| Run | Start (UTC) | End (UTC) | Duration | Cooldown observed (ms) |
|---|---|---|---|---|
| E/run1 | 21:07:21.367 | 21:09:59.798 | 158.4 s | 0 |
| E/run2 | 21:12:24.716 | 21:15:30.594 | 185.9 s | 60,000 |
| E/run3 | 21:18:04.337 | 21:20:52.322 | 168.0 s | 60,001 |
| F/run1 | 21:23:22.694 | 21:26:08.872 | 166.2 s | 60,000 |
| F/run2 | 21:28:39.318 | 21:31:16.687 | 157.4 s | 60,001 |
| F/run3 | 21:33:43.007 | 21:36:39.120 | 176.1 s | 60,000 |
| G/run1 | 21:39:12.203 | 21:41:51.726 | 159.5 s | 60,002 |
| G/run2 | 21:44:14.789 | 21:47:12.703 | 177.9 s | 60,000 |
| G/run3 | 21:49:33.881 | 21:52:14.665 | 160.8 s | 60,000 |
| H/run1 | 21:54:39.704 | 21:54:52.684 | 13.0 s | 60,002 |
| H/run2 | 21:55:54.962 | 21:56:08.577 | 13.6 s | 60,006 |
| H/run3 | 21:57:11.876 | 21:57:26.487 | 14.6 s | 60,000 |

### Latency and throughput (median across runs)

| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse P50 ms | Order+Commit P50 ms | Steady TPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 3 | 6000 | 6000 | 0 | 1701.2 | 1609.2 | 2641.7 | 3300.2 | 396.1 | 1227.8 | 11.70 |
| F | 3 | 6000 | 6000 | 0 | 1676.4 | 1597.0 | 2613.6 | 3248.9 | 405.6 | 1164.4 | 11.93 |
| G | 3 | 6000 | 6000 | 0 | 1635.9 | 1557.3 | 2561.3 | 2899.6 | 426.9 | 1109.7 | 12.14 |
| H | 3 | 1500 | 83 | 1417 | 516.2 | 453.1 | 836.3 | 989.5 | 133.6 | 329.1 | 2.68 |

### Ledger reconciliation

| Run | committed | blocks (height_delta) | tx/block | 4-peer height_delta identical |
|---|---|---|---|---|
| E/run1 | 2000 | 576 | 3.47 | yes |
| E/run2 | 2000 | 661 | 3.03 | yes |
| E/run3 | 2000 | 608 | 3.29 | yes |
| F/run1 | 2000 | 588 | 3.40 | yes |
| F/run2 | 2000 | 552 | 3.62 | yes |
| F/run3 | 2000 | 624 | 3.21 | yes |
| G/run1 | 2000 | 563 | 3.55 | yes |
| G/run2 | 2000 | 610 | 3.28 | yes |
| G/run3 | 2000 | 574 | 3.48 | yes |
| H/run1 | 27 | 34 | 0.79 | yes |
| H/run2 | 28 | 38 | 0.74 | yes |
| H/run3 | 28 | 39 | 0.72 | yes |

### Ledger convergence (A3: first-class measurement)

| Run | W | committed | Converged | wait_ms | polls | Last peer(s) to converge |
|---|---|---|---|---|---|---|
| E/run1 | 20 | 2000 | True | 84,538 | 59 | org2 |
| E/run2 | 20 | 2000 | True | 93,329 | 66 | org2 |
| E/run3 | 20 | 2000 | True | 89,951 | 64 | org2 |
| F/run1 | 20 | 2000 | True | 89,831 | 65 | org2 |
| F/run2 | 20 | 2000 | True | 85,636 | 61 | org2 |
| F/run3 | 20 | 2000 | True | 92,456 | 66 | org2 |
| G/run1 | 20 | 2000 | True | 82,476 | 60 | org2 |
| G/run2 | 20 | 2000 | True | 80,690 | 57 | org2 |
| G/run3 | 20 | 2000 | True | 84,530 | 61 | org2 |
| H/run1 | 20 | 27 | True | 1,745 | 2 | org2 |
| H/run2 | 20 | 28 | True | 2,705 | 3 | org2 |
| H/run3 | 20 | 28 | True | 1,691 | 2 | org2 |

### State size per run (DR4)

| Run | counted_keys before | counted_keys after | Δ | activeActors | totalRatings | linkedEvents |
|---|---|---|---|---|---|---|
| E/run1 | 94,287 | 94,287 | +0 | 37,562 | 38,661 | 18,064 |
| E/run2 | 94,287 | 94,287 | +0 | 37,562 | 38,661 | 18,064 |
| E/run3 | 94,287 | 94,287 | +0 | 37,562 | 38,661 | 18,064 |
| F/run1 | 94,287 | 98,287 | +4,000 | 39,562 | 40,661 | 18,064 |
| F/run2 | 98,287 | 102,287 | +4,000 | 41,562 | 42,661 | 18,064 |
| F/run3 | 102,287 | 106,287 | +4,000 | 43,562 | 44,661 | 18,064 |
| G/run1 | 106,287 | 112,287 | +6,000 | 45,562 | 46,661 | 20,064 |
| G/run2 | 112,287 | 118,287 | +6,000 | 47,562 | 48,661 | 22,064 |
| G/run3 | 118,287 | 124,287 | +6,000 | 49,562 | 50,661 | 24,064 |
| H/run1 | 124,287 | 124,315 | +28 | 49,563 | 50,688 | 24,064 |
| H/run2 | 124,315 | 124,344 | +29 | 49,564 | 50,716 | 24,064 |
| H/run3 | 124,344 | 124,373 | +29 | 49,565 | 50,744 | 24,064 |

`totalAssets` is omitted: it is defective and always reads 0 (assets are stored under bare IDs with no key prefix, so the range scan cannot match them). Asset count is **not measured**; no estimate is substituted. Total LevelDB key count remains unobtainable read-only.

### Resource utilisation

**Idle baseline** (samples outside every run window, i.e. cooldown periods)

| Node | Container | Role | n | CPU% median | CPU% p95 | Mem MB median | Mem MB peak |
|---|---|---|---|---|---|---|---|
| D1 | HARNESS_bench.js |  | 692 | 0.00 | 1.00 | 123.9 | 125.7 |
| D1 | cc-unified |  | 697 | 0.00 | 0.02 | 26.4 | 33.9 |
| D1 | peer0.org1.example.com |  | 697 | 3.45 | 6.90 | 433.5 | 493.0 |
| D2 | cc-unified |  | 702 | 0.00 | 0.02 | 24.0 | 25.0 |
| D2 | orderer2.example.com | follower (D2) | 702 | 1.15 | 1.37 | 272.1 | 353.7 |
| D2 | peer0.org2.example.com |  | 702 | 8.74 | 16.73 | 442.7 | 476.2 |
| D3 | cc-unified |  | 693 | 0.00 | 0.01 | 26.6 | 28.1 |
| D3 | orderer3.example.com | follower (D3) | 693 | 1.69 | 2.04 | 406.7 | 458.5 |
| D3 | peer0.org3.example.com |  | 693 | 6.78 | 8.90 | 439.6 | 483.9 |
| D4 | cc-unified |  | 699 | 0.00 | 0.01 | 25.0 | 27.0 |
| D4 | orderer.example.com | LEADER (D4) | 699 | 1.97 | 2.90 | 914.4 | 989.0 |
| D4 | peer0.org4.example.com |  | 699 | 2.41 | 4.39 | 636.1 | 692.5 |

**Condition E — under load**

| Node | Container | Role | n | CPU% median | CPU% p95 | CPU% peak | Mem MB median | Mem MB p95 | Mem MB peak |
|---|---|---|---|---|---|---|---|---|---|
| D1 | HARNESS_bench.js |  | 243 | 9.80 | 15.60 | 21.40 | 121.9 | 131.1 | 132.3 |
| D1 | cc-unified |  | 243 | 1.77 | 2.99 | 53.63 | 27.0 | 28.0 | 29.3 |
| D1 | peer0.org1.example.com |  | 243 | 22.77 | 33.54 | 48.72 | 360.2 | 400.2 | 414.4 |
| D2 | cc-unified |  | 246 | 0.79 | 1.67 | 2.34 | 24.2 | 24.9 | 25.2 |
| D2 | orderer2.example.com | follower (D2) | 246 | 2.31 | 2.71 | 4.11 | 197.7 | 219.8 | 225.0 |
| D2 | peer0.org2.example.com |  | 246 | 12.97 | 16.96 | 20.21 | 347.3 | 402.5 | 410.6 |
| D3 | cc-unified |  | 242 | 1.58 | 2.93 | 5.65 | 27.4 | 28.6 | 29.2 |
| D3 | orderer3.example.com | follower (D3) | 242 | 3.08 | 3.83 | 5.17 | 329.1 | 354.8 | 359.0 |
| D3 | peer0.org3.example.com |  | 242 | 17.26 | 25.98 | 40.76 | 384.6 | 403.3 | 414.9 |
| D4 | cc-unified |  | 243 | 1.31 | 2.91 | 4.16 | 25.8 | 27.1 | 27.6 |
| D4 | orderer.example.com | LEADER (D4) | 243 | 6.77 | 11.53 | 15.73 | 885.6 | 908.8 | 913.9 |
| D4 | peer0.org4.example.com |  | 243 | 11.67 | 20.40 | 32.46 | 564.5 | 592.3 | 596.1 |

**Condition F — under load**

| Node | Container | Role | n | CPU% median | CPU% p95 | CPU% peak | Mem MB median | Mem MB p95 | Mem MB peak |
|---|---|---|---|---|---|---|---|---|---|
| D1 | HARNESS_bench.js |  | 237 | 9.30 | 13.50 | 19.00 | 124.0 | 125.0 | 125.3 |
| D1 | cc-unified |  | 237 | 3.05 | 5.67 | 31.82 | 27.6 | 29.0 | 31.9 |
| D1 | peer0.org1.example.com |  | 237 | 24.16 | 33.94 | 49.44 | 430.8 | 448.3 | 459.0 |
| D2 | cc-unified |  | 241 | 1.68 | 2.82 | 4.10 | 24.0 | 24.8 | 25.3 |
| D2 | orderer2.example.com | follower (D2) | 241 | 2.24 | 2.71 | 3.73 | 268.8 | 305.5 | 308.9 |
| D2 | peer0.org2.example.com |  | 241 | 13.71 | 18.70 | 31.25 | 433.0 | 447.4 | 461.1 |
| D3 | cc-unified |  | 236 | 3.51 | 5.99 | 7.87 | 27.9 | 29.0 | 29.6 |
| D3 | orderer3.example.com | follower (D3) | 236 | 3.04 | 3.78 | 4.97 | 389.9 | 426.6 | 430.7 |
| D3 | peer0.org3.example.com |  | 236 | 19.97 | 29.45 | 36.43 | 424.3 | 443.2 | 451.4 |
| D4 | cc-unified |  | 238 | 2.79 | 5.49 | 7.48 | 25.9 | 27.1 | 27.9 |
| D4 | orderer.example.com | LEADER (D4) | 238 | 7.04 | 11.30 | 12.84 | 909.5 | 940.6 | 945.0 |
| D4 | peer0.org4.example.com |  | 238 | 13.96 | 24.20 | 28.94 | 624.4 | 641.2 | 643.2 |

**Condition G — under load**

| Node | Container | Role | n | CPU% median | CPU% p95 | CPU% peak | Mem MB median | Mem MB p95 | Mem MB peak |
|---|---|---|---|---|---|---|---|---|---|
| D1 | HARNESS_bench.js |  | 238 | 9.35 | 14.25 | 19.00 | 123.0 | 124.5 | 124.7 |
| D1 | cc-unified |  | 238 | 3.74 | 7.14 | 23.57 | 27.6 | 28.7 | 32.9 |
| D1 | peer0.org1.example.com |  | 238 | 25.71 | 37.55 | 45.06 | 461.7 | 489.8 | 515.3 |
| D2 | cc-unified |  | 241 | 2.12 | 3.32 | 4.62 | 23.8 | 25.0 | 25.3 |
| D2 | orderer2.example.com | follower (D2) | 241 | 2.27 | 2.74 | 3.47 | 320.9 | 348.2 | 353.1 |
| D2 | peer0.org2.example.com |  | 241 | 14.95 | 19.90 | 38.40 | 457.4 | 474.1 | 503.5 |
| D3 | cc-unified |  | 235 | 4.62 | 8.30 | 10.86 | 28.1 | 29.3 | 30.0 |
| D3 | orderer3.example.com | follower (D3) | 235 | 3.06 | 3.87 | 5.01 | 419.7 | 452.2 | 458.4 |
| D3 | peer0.org3.example.com |  | 235 | 22.17 | 31.32 | 43.82 | 452.7 | 480.1 | 484.5 |
| D4 | cc-unified |  | 237 | 3.76 | 7.52 | 11.22 | 26.2 | 27.3 | 28.3 |
| D4 | orderer.example.com | LEADER (D4) | 237 | 6.95 | 11.74 | 14.06 | 959.0 | 983.0 | 994.6 |
| D4 | peer0.org4.example.com |  | 237 | 15.10 | 26.46 | 36.88 | 654.8 | 688.6 | 691.9 |

**Condition H — under load**

| Node | Container | Role | n | CPU% median | CPU% p95 | CPU% peak | Mem MB median | Mem MB p95 | Mem MB peak |
|---|---|---|---|---|---|---|---|---|---|
| D1 | HARNESS_bench.js |  | 20 | 18.05 | 24.02 | 24.40 | 107.9 | 120.0 | 120.3 |
| D1 | cc-unified |  | 20 | 7.90 | 26.17 | 38.83 | 27.4 | 29.1 | 29.1 |
| D1 | peer0.org1.example.com |  | 20 | 41.61 | 50.07 | 53.77 | 490.0 | 492.6 | 492.8 |
| D2 | cc-unified |  | 20 | 3.83 | 5.63 | 6.19 | 24.3 | 25.2 | 25.3 |
| D2 | orderer2.example.com | follower (D2) | 20 | 2.22 | 2.40 | 2.42 | 327.1 | 348.9 | 348.9 |
| D2 | peer0.org2.example.com |  | 20 | 21.74 | 28.14 | 29.87 | 472.5 | 475.9 | 476.1 |
| D3 | cc-unified |  | 19 | 10.76 | 23.47 | 23.90 | 28.5 | 30.0 | 30.1 |
| D3 | orderer3.example.com | follower (D3) | 19 | 2.77 | 3.16 | 3.56 | 407.5 | 412.4 | 412.7 |
| D3 | peer0.org3.example.com |  | 19 | 40.05 | 58.69 | 58.95 | 474.5 | 475.7 | 476.2 |
| D4 | cc-unified |  | 20 | 7.88 | 16.75 | 17.55 | 26.8 | 27.8 | 27.9 |
| D4 | orderer.example.com | LEADER (D4) | 20 | 5.98 | 11.00 | 11.67 | 945.7 | 953.9 | 953.9 |
| D4 | peer0.org4.example.com |  | 20 | 21.45 | 44.40 | 53.25 | 677.8 | 681.2 | 681.4 |

