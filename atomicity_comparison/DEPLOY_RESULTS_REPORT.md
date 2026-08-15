# Atomicity Comparison (v2) — Design A Deployed as TWO GENUINELY SEPARATE Chaincodes

**Date:** 2026-06-23 · **Host:** single laptop (Linux 6.17, x86_64) · single-host
Hyperledger Fabric test-network.

This run supersedes the prior report's key caveat. **Design A is no longer emulated:**
provenance and reputation are now two **independently deployed chaincodes** (`prov`,
`rep`) with separate packages, separate lifecycle definitions, separate CCAAS
containers, and separate ledger state namespaces. The atomic design (B, `unified`) is
unchanged. We re-ran the full divergence campaign and added the two fault-injection
points that were impossible before: **killing the reputation container** and **severing
its network** mid-transaction.

---

## 1. Environment

| Component | Value |
|-----------|-------|
| Date | 2026-06-23 |
| Host | single laptop, Linux 6.17, x86_64 |
| Fabric peer | v2.5.15 |
| Go / Node | go1.22.2 / v18.19.1 |
| Docker | 29.3.0 |
| Channel / state DB | `mychannel` / LevelDB |
| Chaincodes on channel | `prov` v1.0, `rep` v1.0, `unified` v1.0 (all seq 1) |
| Test-network | `~/AM/fabric-samples/test-network/` (identity `Admin@org1`) |
| Harness | `~/atomicity_comparison/harness/` (`worker.js`, `run.js`, `run_ccfault.js`, `bench.js`, `deploy_ccaas.sh`) |
| Raw logs | `~/atomicity_comparison/logs/run_sep_*/result.json`, `bench_sep_*.json`, `deploy_*.log` |

**Design A (now real, two separate chaincodes):**
- `prov` — package `prov_1.0:538347cd…`, port 9991, containers `peer0org{1,2}_prov_ccaas`.
  Single contract `SmartContract` (`am-provenance`, fabric-contract-api-go v1).
- `rep` — package `rep_1.0:d39f2f21…`, port 9992, containers `peer0org{1,2}_rep_ccaas`.
  Single contract `ReputationContract` (`am-reputation`, fabric-contract-api-go v2).

**Design B:** `unified` v1.0 (CCAAS, port 9999) — `IntegrationContract:RecordProvenanceWithReputation`.

**Unified was never disrupted.** Its `GetSupplyChainMetrics` returned a valid response
before deployment, after each new chaincode commit, and after each fault injection; its
containers stayed "Up 6 days" throughout.

---

## 2. What ran / what didn't

| Item | Status |
|------|--------|
| Deploy `prov` (separate cc) | **DONE** — committed, smoke (write+read) PASS |
| Deploy `rep` (separate cc) | **DONE** — committed, smoke (InitConfig/AddStake/SubmitRating/GetReputation) PASS |
| Baseline both designs | DONE (re-measured) |
| A: client-crash window (iii) seq + conc | DONE |
| A: client-crash random in-window | DONE |
| **A: (i) kill reputation container** | **DONE** (new — was impossible when emulated) |
| **A: (ii) sever reputation network** | **DONE** (new — was impossible when emulated) |
| B unified: window + random (seq, conc) | DONE |

Nothing skipped. Container/network faults targeted **only** the `rep` containers; `prov`,
`unified`, peers, orderer, and CAs were never touched, and `rep` was restored and
re-verified after each fault.

Deployment cost: ~1 minute, 0 failed attempts (well within the 45-min circuit breaker).
Method: CCAAS, replicating the proven `~/am-unified/scripts/deploy.sh` recipe (the peer's
in-container Docker builder is broken; CCAAS is the working path).

---

## 3. Baseline (no faults), re-measured with separate chaincodes

N=200 logical ops; sequential latency + concurrent throughput at C=20; distinct rated
actor per op; payload = one MATERIAL_CERTIFICATION event + one `quality=0.9` rating.

| Metric | Two-chaincode A (`prov`+`rep`) | Unified B |
|--------|-------------------------------|-----------|
| Invokes / commits per logical tx | **2 / 2** (separate chaincodes) | **1 / 1** |
| Sequential latency mean | 192.1 ms | **100.6 ms** |
| Sequential latency P95 | 199 ms | **105 ms** |
| Concurrent throughput (C=20) | 83.7 TPS | **144.7 TPS** |
| MVCC conflict rate | 0 / 200 | 0 / 200 |

Unified is ~1.9× faster and ~1.7× higher throughput. The two-chaincode latency is
slightly higher than the earlier same-binary emulation (192 vs 179 ms) because the two
writes now cross two separate CCAAS containers.

---

## 4. Divergence under fault injection (centerpiece)

**Verification (independent, key-based, both ledgers).** For each op:
`prov:ReadAsset(opId)` decides whether provenance committed; reputation presence is
decided on the `rep` ledger — for client-crash conditions via the fsync'd log proving
`SubmitRating` was never sent, and for the container/network conditions via
`rep:GetReputation(opId).totalEvents` (each op uses a unique rated actor == opId).
A **divergence** = provenance committed without its paired reputation. One container-stop
divergence was CLI-confirmed: `prov:ReadAsset` returns the asset; `rep:GetReputation`
returns `totalEvents:0`.

| Design A (two separate chaincodes) | Injection | Conc | N | **DIVERGENT** | Rate | 95% CI |
|---|---|---|---|---|---|---|
| A | client-crash, window (iii) | 1 | 300 | **300** | **100%** | [98.7, 100]% |
| A | client-crash, window (iii) | 10 | 300 | **300** | **100%** | [98.7, 100]% |
| A | client-crash, random in active window | 1 | 300 | **199** | **66.3%** | [60.8, 71.4]% |
| **A** | **(i) kill reputation container** | 1 | 50 | **50** | **100%** | [92.9, 100]% |
| **A** | **(ii) sever reputation network** | 1 | 50 | **50** | **100%** | [92.9, 100]% |
| **B unified** | window (iv) | 1 | 300 | **0** | **0%** | [0, 1.26]% |
| **B unified** | random in active window | 1 | 300 | **0** | **0%** | [0, 1.26]% |
| **B unified** | random in active window | 10 | 300 | **0** | **0%** | [0, 1.26]% |

(95% CI = Wilson.) **Design B aggregate: 0 divergences / 900 fault-injected trials →
rule-of-three 95% upper bound 3/900 = 0.333%.** As before, the unified random runs
include **105 (seq) + 39 (conc) CONSISTENT** ops — the client died *after* the atomic
commit and both the provenance event and the bridge link were already present together;
the rest were clean-aborts. Never a split state.

For Design A, the new infrastructure faults (i, ii) — the reputation chaincode killed or
network-partitioned in the window after the provenance commit — produced **100%
divergence**: every provenance event committed on `prov` while its rating never reached
`rep`. The client-crash random run diverged in 66.3% of trials (the complement were
clean-aborts where the fault preceded the provenance commit).

---

## 5. Exact reproduction parameters

- **Deploy:** `harness/deploy_ccaas.sh <name> <port> <src> <seq>` →
  `deploy_ccaas.sh prov 9991 ~/AM/am-provenance 1`, `deploy_ccaas.sh rep 9992 ~/AM/am-reputation/chaincode 1`.
- **Design A writes:** tx1 `prov:CreateMaterialCertification(assetID,"Ti-6Al-4V","batch-<id>",ratedActor,"hash-<id>")`; tx2 `rep:SubmitRating(ratedActor,"quality","0.9",evidence,ts)`. Rater `Admin@org1`, staked `AddStake 1e8` on `rep`; `rep:InitConfig` once.
- **Design B write:** `unified IntegrationContract:RecordProvenanceWithReputation(assetID,"MATERIAL_CERTIFICATION","hash-<id>",ratedActor,"0.9","quality",evidence)`.
- **N:** 300 per client-crash/unified condition; 50 per container/network condition; 200 baseline. **Concurrency:** 1 and 10.
- **Client-crash injection:** child process SIGKILL'd on first `PROV_COMMITTED` (`window`) or at `START + U(0,260 ms)` (`random`, hold=80 ms). **Unified:** `START + U(0,160 ms)`.
- **Container fault (i):** `docker stop peer0org{1,2}_rep_ccaas`, drive batch, `docker start`, wait 9 s, re-smoke. **Network fault (ii):** `docker network disconnect/connect fabric_test peer0org{1,2}_rep_ccaas`.
- **Channel config:** live network, unchanged. **State DB:** LevelDB.
- **Re-run faults:** `node run.js --mode=twotx|unified --policy=window|random --n=300 …`; `node run_ccfault.js --fault=stop|netsever --n=50`.

---

## 6. What the data shows (factual)

With provenance and reputation deployed as **two genuinely separate Fabric chaincodes**,
a fault placed between the two writes left the ledger **divergent** — a committed
provenance event with no paired reputation record — in **100% of trials** under a
client crash in the inter-write window (sequential and concurrent), **66.3%** under
randomly-timed in-window client crashes, and **100%** under both infrastructure faults
(reputation container killed; reputation network severed). The **unified single-read-write-set
design produced zero divergences across 900 fault-injected trials** (95% upper bound
0.333%), resolving every interrupted operation to "both writes present" or "neither."
Under fault-free load the unified design was also ~1.9× faster and ~1.7× higher throughput.

This confirms, on a real two-chaincode deployment, that splitting provenance and
reputation across independent transactions/chaincodes leaves a reachable divergent state
that ordinary faults — client crashes, a dead chaincode container, a network partition —
do reach; whereas co-locating them in one Fabric read-write set makes the
provenance↔reputation consistency invariant structurally enforceable (all-or-nothing).

---

## 7. Caveats

1. **RESOLVED — design A is no longer emulated.** It is a real two-chaincode deployment
   (`prov` + `rep`, separate packages/containers/ledgers). The previous report's central
   caveat is removed. Both new injection points (container kill, network sever) ran.
2. The client-crash divergence window is narrow relative to total op time; the 66.3%
   figure is for faults landing inside the active two-phase window (timed from the START
   marker), not for all crashes. The deterministic window and both infrastructure faults
   give 100%, showing the divergent state is reliably reachable when a fault occurs in the gap.
3. Single host, LevelDB, 2-org test-network, no Byzantine faults; verification is
   key-based. Absolute latency/TPS are laptop-scale; the result is the 0-vs-nonzero
   divergence contrast, not the magnitudes.
4. Container/network faults used N=50 (each op holds the rep service down for one
   endorsement timeout, ~10 s/op, so large N is impractical); the outcome is structural
   (100%) and CLI-confirmed, so 50 trials suffice. Rule-of-three would still bound a
   hypothetical zero result, but the observed rate is 100%.
5. The unified chaincode was deliberately never used as a fault target (shared, 6-day-live
   deployment); its health was verified before and after every step.
