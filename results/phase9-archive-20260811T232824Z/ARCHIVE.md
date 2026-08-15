# PHASE 9 ARCHIVE

**Generated:** 2026-08-11T23:28:28Z  
**Files indexed:** 26,255 — **all 26,255 hashed** (the >8 MB size cap was never reached)

## Coverage

| Tree | Files | Bytes |
|---|---|---|
| `client-tests` | 16 | 242,662 |
| `results` | 441 | 104,159,616 |
| `harness` | 16 | 79,683 |
| `atomicity_logs` | 25,782 | 9,853,657 |

`INDEX.json` is not published: it listed absolute operator paths and was
excluded from the public repository. Any number in the manuscript is still
traceable in one step: find the value in a `latex_fragments/*.txt` provenance
file, which names the source JSON and the JSON path within it.

## Contents copied into this directory

- `PHASE_9_REPORT.md` — consolidation and corrections
- `PHASE_11_REPORT.md` — corrected Design B fault model
- `RECOVERY_STATUS.md` — post power-loss assessment (with its correction banner)
- `latex_fragments/` — the 15 emitted fragments, post-D3

## Not copied, indexed in place

The raw run trees stay where they are (≈200 MB across `results/` and
`atomicity_comparison/logs/`) rather than being duplicated here.

## Known gaps

- `probe-20260804T212237Z/` was analysed over SSH and never pulled from D1; the
  D1 copy is unverified and the lab has been unreachable since 2026-08-10 ~21:50Z.
- Phase 11's C6 attempt 1 wrote only to `/tmp` and was destroyed by the reboot.
  It is unrecoverable and was re-run in full.
- Phase 6 is incomplete (6a rep 1 valid only; 6b absent).

**Rule adopted:** no run may direct its only output to `/tmp`.
