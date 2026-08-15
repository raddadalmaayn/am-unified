# Deploy Two Separate Chaincodes — Running Log

## Phase 0 — Snapshot and locate sources

**Timestamp:** 2026-06-23 02:13 UTC. Host: laptop, Fabric peer v2.5.15, Go 1.22.2,
Docker 29.3.0. Network UP.

**Snapshot saved to** `backup/deploy/`: `docker_ps.txt`, `querycommitted.txt`,
`unified_smoke_baseline.txt`, `snapshot_time.txt`.

- Committed on `mychannel`: **`unified` v1.0 seq 1** (only). MUST NOT be disturbed.
- Containers Up (~6 days): peer0.org1 (7051), peer0.org2 (9051), orderer (7050),
  ca_org1/2/orderer, plus `peer0org1_unified_ccaas` + `peer0org2_unified_ccaas` (port 9999,
  network `fabric_test`).
- **Unified live PACKAGE_ID** (do not touch): `unified_1.0:065d94f57da86acc6d15c12a66f098e89a762ec82a1b5bbe49bb14b66b0105d9`.
- **Unified smoke baseline (known-good):** `GetSupplyChainMetrics` →
  `{"totalAssets":0,"activeActors":804,"totalRatings":936,...,"linkedEvents":535,...}` OK.

**Sources confirmed + compile-ready (have vendor/, go.mod, go.sum):**
- Provenance: `~/AM/am-provenance/am_provenance.go` — `package main`,
  single contract **`SmartContract`** (`contractapi.NewChaincode(&SmartContract{})`),
  fabric-contract-api-go **v1**. Call: `SmartContract:CreateMaterialCertification(assetID, materialType, materialBatchID, supplierID, offChainDataHash)`.
- Reputation: `~/AM/am-reputation/chaincode/contract.go` — `package main`,
  single contract **`ReputationContract`** (`contractapi.NewChaincode(&ReputationContract{})`),
  fabric-contract-api-go **v2**. Calls: `ReputationContract:InitConfig()`, `:AddStake(amount)`,
  `:SubmitRating(actorID, dimension, valueStr, evidence, timestampStr)`.

**Deployment method:** CCAAS (Chaincode-as-a-Service), replicating the proven
`~/am-unified/scripts/deploy.sh` recipe (the peer's in-container Docker builder is
broken; CCAAS is the working path). New chaincodes:
- `prov` — port 9991, image `prov_ccaas_image`, containers `peer0org{1,2}_prov_ccaas`.
- `rep`  — port 9992, image `rep_ccaas_image`,  containers `peer0org{1,2}_rep_ccaas`.
Both sequence 1, alongside `unified` (untouched).

## Phase 1 — Deploy two separate chaincodes (SUCCESS)

PHASE1_START 02:15:36 UTC; both deploys finished ~02:16:30 UTC (~1 min, well under
the 45-min breaker; 0 failed attempts). Deploy script: `harness/deploy_ccaas.sh`
(parametrized clone of the proven unified CCAAS recipe). Logs: `logs/deploy_prov.log`,
`logs/deploy_rep.log`.

- **prov** committed: `prov` v1.0 seq 1. PACKAGE_ID `prov_1.0:538347cdd8c8a2c63ba14836ed4f001512ce858a7dd74af6856ec6ce7889ef82`. Port 9991. Containers `peer0org{1,2}_prov_ccaas`.
  - Smoke: `CreateMaterialCertification(PROV-SMOKE-001,...)` → committed; `ReadAsset` → asset at `MATERIAL_CERTIFIED`. PASS.
- **rep** committed: `rep` v1.0 seq 1. PACKAGE_ID `rep_1.0:d39f2f21428158760ac16fe28c3794954e7818b1d02b561500009498ebb74433`. Port 9992. Containers `peer0org{1,2}_rep_ccaas`.
  - Smoke: `InitConfig` → `AddStake 1e8` → `SubmitRating(supplier_smoke_rep,quality,0.9,...)` → `GetReputation` shows score 0.5736, totalEvents 1. PASS.
- **Network-harm checks:** after EACH new commit, `unified:GetSupplyChainMetrics`
  returned the known-good baseline (activeActors 804, totalRatings 936...). Unified
  **never disrupted**; its containers still "Up 6 days".
- `querycommitted -C mychannel` now lists **prov, rep, unified** (all seq 1).

GATE PASSED → proceed to Phase 2. Original harness backed up to `backup/deploy/`.

Design A is now TWO GENUINELY SEPARATE CHAINCODES (`prov`, `rep`), not emulated.

## Phase 2 — Harness repointed at the REAL separate chaincodes

Edited `harness/{worker.js,run.js,bench.js}`: design A (`twotx`) now drives
`net.getContract('prov')` for tx1 (`CreateMaterialCertification`) and
`net.getContract('rep')` for tx2 (`SubmitRating`) — TWO separate chaincodes /
ledgers. Design B (`unified`) unchanged. Fault model, injection policies (window /
random-from-START), N, concurrency, payload, channel config all identical to the
prior run. Originals in `backup/deploy/`.

Smoke (no fault): twotx → PROV_COMMITTED (prov cc) → REP_COMMITTED (rep cc) → DONE;
unified → UNI_COMMITTED → DONE. Verifier validated on N=10 window batch: 10/10
DIVERGENT, with one case CLI-confirmed (`prov:ReadAsset` present, `rep:GetReputation`
totalEvents 0).

New injection driver `harness/run_ccfault.js` for the two points the emulated run
could not do:
- (i) `stop`     → `docker stop` both `*_rep_ccaas` (reputation process killed).
- (ii) `netsever`→ `docker network disconnect fabric_test *_rep_ccaas` (severed link).
Both keep provenance (`prov`), unified, peers and orderer untouched; rep is restored
and re-smoked afterwards. Rater `Admin` staked on `rep` (`AddStake 1e8`).

## Phase 3 — Divergence campaign (SUCCESS)

Per-condition raw JSON in `logs/run_sep_*/result.json`. Baseline (separate cc):
twotx 192.1 ms / 83.7 TPS; unified 100.6 ms / 144.7 TPS (`logs/bench_sep_*.json`).

| Design (A=2 separate cc) | Injection | Conc | N | DIVERGENT | Rate | 95% CI |
|---|---|---|---|---|---|---|
| A | client-crash window (iii) | 1 | 300 | 300 | 100% | [98.7,100] |
| A | client-crash window (iii) | 10 | 300 | 300 | 100% | [98.7,100] |
| A | client-crash random in-window | 1 | 300 | 199 | 66.3% | [60.8,71.4] |
| **A** | **(i) kill rep container** | 1 | 50 | **50** | **100%** | [92.9,100] |
| **A** | **(ii) sever rep network** | 1 | 50 | **50** | **100%** | [92.9,100] |
| B unified | window (iv) | 1 | 300 | 0 | 0% | [0,1.26] |
| B unified | random in-window | 1 | 300 | 0 | 0% | [0,1.26] |
| B unified | random in-window | 10 | 300 | 0 | 0% | [0,1.26] |

Unified aggregate: **0 / 900** fault-injected trials (rule-of-three 95% upper bound
0.333%). One container-stop divergence CLI-confirmed: `prov:ReadAsset` present,
`rep:GetReputation` totalEvents=0.

Injection points (i) and (ii) — impossible in the emulated run — both produced **100%
divergence**: provenance committed on `prov`, reputation never recorded on `rep`.

**Unified never disrupted** throughout (verified before/after every fault; "Up 6 days").

## Phase 4 — Report

Written to `DEPLOY_RESULTS_REPORT.md`. Network left healthy: prov, rep, unified all
committed; all 6 CCAAS containers Up; rep restored after both container faults.
