# Atomicity comparison — fault-injection harness and results

This directory holds the code and evidence for the atomicity study reported in
the manuscript. It supports three floats:

| Manuscript float | What it reports |
|---|---|
| `tab:divergence` | Ledger divergence by kill policy and by event type, unified design versus a client-orchestrated two-chaincode control |
| `tab:atomicity_baseline` | Fault-free cost comparison of the two designs |
| `fig:tx_timeline` | Measured transaction phase boundaries and the interval in which a partial write could exist |

## What is included, and what is not

**Aggregates for the ten reported conditions.** Each condition directory under
`logs/` contains its `result.json` (and the run's `.log`/`.err` where present),
which is what every number in `tab:divergence` is computed from.

**Raw per-trial logs for the calibration run only.** `fig:tx_timeline` is
derived from all 200 `.prog` progress-marker files in
`logs/run_P11_C1_calib_1786420116548/`, so that directory is included in full.
Raw per-trial logs of the other conditions are not included; their aggregates
are.

**Approximately 69 superseded pilot directories are excluded.** These are
earlier `FG2`, `FG4`, `sep_*`, `twotx_*`, `unified_*`, `SMOKE` and `val_*` runs,
plus the superseded siblings of three reported conditions. No number in the
manuscript is derived from any of them.

## Condition-to-directory map

| Reported condition | Directory |
|---|---|
| Calibration, no fault (n=200) | `logs/run_P11_C1_calib_1786420116548` |
| Kill pre-endorsement (n=500) | `logs/run_P11_P1_pre_1786420670477` |
| Kill post-endorsement (n=500) | `logs/run_P11_P2_postendorse_1786421087319` |
| Kill post-submission (n=500) | `logs/run_P11_P3_postsubmit_1786420297369` |
| Kill random (n=500) | `logs/run_P11_P4v2_random_1786421901120` |
| Material certification (n=300) | `logs/run_P11_C5v2_matcert_1786422240462` |
| Print completion (n=300) | `logs/run_P11_C5v2_print_1786422446813` |
| Delivery (n=300) | `logs/run_P11_C5v2_delivery_1786422651978` |
| Two-chaincode control, before (n=500) | `logs/run_D4_A_window_seq_1786418704674` |
| Two-chaincode control, after (n=500) | `logs/run_P11_C7b_A_window_seq_postC6_1786490336410` |

## `tab:atomicity_baseline` comes from `run_P11_C6_rerun_1786490203`

Read it from `logs/run_P11_C6_rerun_1786490203/c6_twotx.json` and
`c6_unified.json`.

This is worth stating explicitly: the six root-level `bench_*.json` files in the
original working tree look like plausible sources for that table and **are not**.
They are earlier runs at n=200 and n=1000 with different absolute values. The
reported table is the n=500 re-run in the `C6` directory.

## Running the harness

The harness reads two environment variables rather than hard-coded paths:

```bash
export FABRIC_CRYPTO_PATH=/path/to/test-network/organizations/peerOrganizations/org1.example.com
export ATOMICITY_LOGS_DIR=/path/to/output/logs
node harness/run11.js --policy=postsubmit --n=500 --evt=MATERIAL_CERTIFICATION --dim=quality --label=P3
```

Both are required; the scripts fail immediately with a message naming the
variable if either is unset.

`harness/lib.js` is the shared module every entry point imports. Verification is
an independent key-based ledger walk (`reverify11.js`, `reverify_d4.js`,
`reverify_pertrial.js`) performed after the trial loop, reading only through the
chaincodes' read-only query interfaces.
