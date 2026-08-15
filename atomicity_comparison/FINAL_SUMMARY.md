# FINAL Atomicity Experiment — Running Log

**Started:** 2026-06-23 ~19:03 UTC. Single-host laptop. Pre-specified matrix
(Groups 1–4). All conditions reported as measured; fault timing fixed, never tuned.

## Pre-flight
- Committed on `mychannel`: prov v1.0, rep v1.0, unified v1.0 (all seq 1). Snapshot in `backup/deploy/final_*`.
- Containers Up: prov/rep ccaas (~16-17h), unified ccaas + peers/orderer/CAs (~6d).
- unified smoke: GetSupplyChainMetrics OK (activeActors 1207, totalRatings 1481).
- prov smoke: CreateMaterialCertification + ReadAsset OK. rep smoke: SubmitRating + GetReputation OK (alpha>2).
- Verification path = independent key-based ledger walk: prov:ReadAsset(opId) + rep:GetReputation(opId).

## Group 1 — Baseline (no faults), N=1000
| Metric | A (prov+rep) | B (unified) |
|---|---|---|
| invokes/commits per logical tx | 2/2 | 1/1 |
| seq latency mean | 206.4 ms | 109.8 ms |
| seq P50 / P95 | 206 / 215 ms | 109 / 116 ms |
| concurrent TPS (C=20) | 76.9 | 145.1 |
| MVCC conflict rate | 0/1000 | 0/1000 |
Raw: logs/final_bench_{twotx,unified}.json

## Batch finalized after stopping a stalled wait loop
Killed 7 background poller shells (no-progress). The actual experiment batch was NOT
killed — it finished on its own (all Groups 1/2/4 complete). Group 3 then run fresh at N=100.

## Group 2 (client-crash, N=2000) — AS MEASURED
- A window seq:  2000/2000 DIVERGENT (100%) CI[99.81,100]
- A window conc: 2000/2000 DIVERGENT (100%) CI[99.81,100]
- A random seq:  665/2000 (33.25%) CI[31.22,35.35]; 1335 clean-abort
- A random conc: 271/2000 (13.55%) CI[12.12,15.12]; 1729 clean-abort
- B window seq:  0/2000 (2000 clean-abort) CI[0,0.19]
- B random seq:  0/2000 (2000 clean-abort) CI[0,0.19]
- B random conc: 0/2000 (2000 clean-abort) CI[0,0.19]
NOTE: random rates lower than earlier small-N run (~66%) — fixed un-tuned U(0,260ms)
timing + higher prov-commit latency (206ms) means more kills land pre-commit → clean-abort.
NOTE: B random produced 0 CONSISTENT this run (all clean-abort) — kills consistently
preceded the atomic commit; both clean-abort and consistent are non-divergent.

## Group 3 (infrastructure faults, N=100, fresh) — AS MEASURED
- A kill rep container: 100/100 DIVERGENT (100%) CI[96.30,100]
- A sever rep network:  100/100 DIVERGENT (100%) CI[96.30,100]
CLI-confirmed orphan each: prov:ReadAsset present (MATERIAL_CERTIFIED), rep:GetReputation totalEvents=0.
rep restored + reconnected + healthy after both. unified healthy throughout.

## Group 4 (event-type generalization, window, N=300) — AS MEASURED
- A MatCert/compliance: 300/300 (100%); A Print/quality: 300/300 (100%); A Delivery/delivery: 300/300 (100%)
- B MatCert/compliance: 0/300; B Print/quality: 0/300; B Delivery/delivery: 0/300

## Design B aggregate: 0 / 6900 fault-injected trials. Wilson95%[0,0.056]%, rule-of-three upper 0.0435%.
## Completeness: ALL 15 conditions + Group 1 baseline COMPLETE. None partial/missing.
