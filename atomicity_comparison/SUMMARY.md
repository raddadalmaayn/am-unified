# Atomicity Comparison — Two-Chaincode vs Unified-Chaincode

**Started:** 2026-06-22 21:33 UTC (laptop, single-host)
**Author:** automated run (Claude Code)

## Goal

Two Hyperledger Fabric designs for AM supply-chain provenance+reputation:
- **(A) Two-chaincode:** provenance and reputation committed as SEPARATE Fabric
  transactions (independent read-write sets). The provenance↔reputation binding is
  the client's responsibility; nothing makes the two commits atomic.
- **(B) Unified:** provenance + reputation + bridge link written by ONE chaincode
  invocation, i.e. a SINGLE Fabric read-write set, committed all-or-nothing.

**Central claim to test empirically:** Under a fault injected *between* the
provenance write and the reputation write, design (A) can leave the ledger
DIVERGENT (a committed provenance event with no paired reputation record), at a
MEASURABLE NONZERO rate; design (B) cannot diverge (structural, ZERO).

---

## Phase 0 — Setup and environment

**Working dir:** `~/atomicity_comparison/` (`backup/`, `logs/`, `harness/`).

### Environment
| Component | Value |
|-----------|-------|
| Date | 2026-06-22 |
| Host | single laptop, Linux 6.17, x86_64 |
| Go | go1.22.2 |
| Node | v18.19.1 / npm 9.2.0 |
| Docker | 29.3.0 |
| Fabric peer | v2.5.15 |
| Network state | **UP** (containers up ~6 days) |

### Running Fabric containers
peer0.org1, peer0.org2, orderer, ca_org1, ca_org2, ca_orderer — all `Up`.
Plus CCAAS chaincode containers: `peer0org1_unified_ccaas`, `peer0org2_unified_ccaas`.
Docker network: `fabric_test`.

### Relevant code/paths found
| Path | Role |
|------|------|
| `~/am-unified/chaincode/unified/` | **Unified (B)** chaincode source (1 binary, 3 contracts: ProvenanceContract, ReputationContract, IntegrationContract) |
| `~/AM/am-provenance/am_provenance.go` | Standalone provenance chaincode source (two-chaincode design A, source) |
| `~/AM/am-reputation/chaincode/contract.go` | Standalone reputation chaincode source (two-chaincode design A, source) |
| `~/AM/fabric-samples/test-network/` | **Active** Fabric test-network (real crypto + running containers) |
| `~/am-unified/client-tests/` | Existing benchmark harness (fabric-gateway) — reused for connection pattern |

> Note: memory/older scripts reference `~/fabric-samples/test-network`, but the
> **live** network is mounted from `~/AM/fabric-samples/test-network` (confirmed via
> `docker inspect` of peer0.org1). Identities present: `Admin@org1`, `User1@org1`.

### Committed chaincode on `mychannel`
`unified` v1.0 seq 1 — committed and serving (verified via `peer lifecycle
chaincode querycommitted`). This is design (B), already deployed.

### Backup
- `backup/client-tests-package.json` (reference). No network config is modified by
  this experiment (read-only against the live ledger + client-side fault injection),
  so nothing else needed backing up. Each experiment uses fresh, unique asset IDs.

### Design decision (important, for honesty)
The atomicity-relevant variable is **whether the provenance and reputation writes
land in ONE Fabric read-write set or TWO independent transactions** — not the number
of deployed binaries. The unified binary exposes `ProvenanceContract`,
`ReputationContract` and `IntegrationContract` as separately-addressable contracts,
so:
- **Design B (unified, atomic):** one submit → `IntegrationContract:RecordProvenanceWithReputation` (writes EVENT_, asset, rating, reputation, and `PROV_REP_LINK:` in a single RW-set).
- **Design A (two-chaincode, non-atomic):** modeled as TWO independent submits —
  `ProvenanceContract:CreateMaterialCertification` (tx1) then `ReputationContract:SubmitRating` (tx2).
  These are two independent RW-sets / commits, faithfully reproducing the
  cross-transaction non-atomicity of physically-separate chaincodes. (An attempt to
  also stand up two *physically separate* CCAAS containers for injection point (i)
  is recorded in Phase 1/3 with its outcome.)

This is stated plainly so a reviewer understands exactly what (A) models.

---

## Phase 1 — Bring up ledger + validate both systems

Network was already **UP**; no bring-up needed. Unified chaincode `unified` v1.0
committed on `mychannel` (verified). Reputation config already initialized
(`InitConfig` returns "already initialized"); rater `Admin` staked via `AddStake`
(stake is keyed by the caller's normalized cert ID, which is what `SubmitRating`'s
gate checks — confirmed working below).

**Smoke tests (harness `worker.js`, no fault):**
- **Design A (twotx):** `ProvenanceContract:CreateMaterialCertification` committed,
  then `ReputationContract:SubmitRating` committed → returned a RATING id. Both
  read back. Markers: `PROV_COMMITTED` → `REP_COMMITTED|RATING:66b4bda5...` → `DONE`. PASS.
- **Design B (unified):** `IntegrationContract:RecordProvenanceWithReputation`
  committed (single tx) → `UNI_COMMITTED` → `DONE`. PASS.

State DB is **LevelDB** (CouchDB rich queries fail: `GET_QUERY_RESULT failed`),
so verification uses only **key-based** reads (`ReadAsset`,
`GetLinkedRatingsForAsset`) — an independent ledger walk, not trusting client logs.

**Genuinely-separate containers (injection point i):** Both provenance and
reputation live in ONE CCAAS binary (`unified_ccaas`), so there is no separate
"reputation container" to kill. The faithful equivalent of "fault between the two
writes" is the **client-crash-between-transactions** injection (point iii), which
targets the exact same non-atomic boundary (two independent RW-sets). This is what
Phase 3 drives. We did not kill the shared CCAAS container (would disrupt the live
6-day deployment and is not discriminating — it affects both designs identically).

**Harness validation (N=12, window injection):**
- twotx: **12/12 DIVERGENT** (provenance asset on-chain, reputation never submitted).
- unified: **12/12 CLEAN_ABORT** (single tx killed pre-commit → neither side wrote), 0 divergent.

Independently confirmed one divergent case via `peer chaincode query`:
`ReadAsset` returns the asset at stage `MATERIAL_CERTIFIED`, and
`GetLinkedRatingsForAsset` returns empty → a real orphaned provenance event on the ledger.

GATE: both designs come up, deploy, and smoke-test PASS. No design skipped.

---

## Phase 2 — Baseline normal-operation comparison (no faults)

Identical workload both designs: **N=200** logical ops, sequential latency +
concurrent throughput at **concurrency C=20**, distinct rated actor per op
(isolates the design difference — number of invokes/commits — from hot-key MVCC
contention, which is identical for both designs). Payload: one
MATERIAL_CERTIFICATION event + one `quality=0.9` rating. Channel config unchanged
(live network). Harness: `harness/bench.js`. Raw: `logs/bench_twotx.json`, `logs/bench_unified.json`.

| Metric | Two-chaincode (A) | Unified (B) |
|--------|-------------------|-------------|
| Invokes / logical tx | **2** | **1** |
| Commits / logical tx | **2** (independent RW-sets) | **1** (single RW-set) |
| Sequential latency mean | 178.6 ms | **94.0 ms** |
| Sequential latency P50 | 178 ms | **94 ms** |
| Sequential latency P95 | 189 ms | **98 ms** |
| Concurrent throughput (C=20) | 86.7 TPS | **163.5 TPS** |
| MVCC conflict rate | 0 / 200 | 0 / 200 |

The unified design is ~1.9× faster end-to-end and ~1.9× higher throughput — direct
consequence of one commit vs two. MVCC ≈ 0 for both (distinct actors). The point of
this table is that the unified design's atomicity does **not** cost performance — it
*improves* it, because it halves the number of ordering/commit rounds.

---

## Phase 3 — Divergence under fault injection (KEY EXPERIMENT)

**Fault model.** Each logical provenance+reputation operation runs in a child
process; a controller SIGKILLs it (an uncontrollable client crash). Markers are
fsync'd before each step so the post-mortem ledger walk is exact.

**Injection points mapped to the task list.**
- (iii) *crash client after the first write commits, before the second is issued* →
  policy `window`: kill the instant `PROV_COMMITTED` appears (twotx) — lands in the
  inter-write gap by construction.
- (iv) *interrupt the unified tx mid-flight* → policy `window`/`random`: kill before
  the single commit (twotx analog is `random`).
- (i)/(ii) *kill the reputation container / sever the cross-chaincode link* — not
  separately runnable here because provenance+reputation share ONE CCAAS binary;
  (iii) targets the identical non-atomic boundary (two independent RW-sets) and is
  the faithful equivalent. Documented, not faked.
- `random`: kill at a uniform random delay measured from the `START` marker, i.e.
  landing somewhere inside the active two-phase transaction window (not in Node
  process-startup dead time).

**Verification pass (independent, key-based ledger walk, LevelDB-safe).** For every
op: `ProvenanceContract:ReadAsset(opId)` (provenance committed?) and, for unified,
`IntegrationContract:GetLinkedRatingsForAsset(opId)` (bridge link present?). twotx
reputation absence is established by the fsync'd log proving `SubmitRating` was never
sent (kill before `REP_SUBMIT`); the orphaned provenance is then confirmed on-chain.
One divergent case was additionally confirmed by hand via `peer chaincode query`.

### Results (N=300 per condition unless noted)

| Design | Injection | Conc | N | Killed | **DIVERGENT** | Rate | 95% CI | Other classes |
|--------|-----------|------|---|--------|---------------|------|--------|---------------|
| **A two-chaincode** | window (iii), seq | 1 | 300 | 300 | **300** | **100%** | [98.74,100]% | — |
| **A two-chaincode** | window (iii), conc | 10 | 300 | 300 | **300** | **100%** | [98.74,100]% | — |
| **A two-chaincode** | random in-window | 1 | 300 | 300 | **178** | **59.3%** | [53.7,64.7]% | 119 clean-abort, 3 ambiguous |
| A two-chaincode | random from spawn¹ | 1 | 300 | 300 | 0 | 0% | [0,1.26]% | 300 clean-abort |
| **B unified** | window (iv), seq | 1 | 300 | 300 | **0** | **0%** | [0,1.26]% | 300 clean-abort |
| **B unified** | random in-window | 1 | 300 | 300 | **0** | **0%** | [0,1.26]% | 205 clean-abort, **95 consistent** |
| **B unified** | random in-window | 10 | 300 | 299 | **0** | **0%** | [0,1.26]% | 265 clean-abort, **34 consistent**, 1 biz-err |
| B unified | window (iv), older² | 1 | 300 | 300 | 0 | 0% | [0,1.26]% | 300 clean-abort |
| B unified | random, older² | 1 | 300 | 300 | 0 | 0% | [0,1.26]% | 300 clean-abort |

¹ Random delay timed from process *spawn*: the kill almost always precedes the
provenance commit (Node startup ~150 ms), so it aborts cleanly. Reported to show the
divergence window is narrow relative to total op time, and to motivate the
`from START` timing used in the in-window rows. **Not** evidence against divergence.
² First-pass random/window timed from spawn (same dilution); superseded by the
`from START` rows. Kept for completeness; both still 0 divergent.

**Aggregate (Design B, unified):** **0 divergences across 1,512 fault-injected
trials** (5×300 + 12 validation). Rule-of-three 95% upper bound = **3/1512 = 0.198%**.

### What actually happened vs expected
- **Expected:** twotx nonzero divergence on ≥1 injection point; unified zero. **Confirmed.**
- twotx: **100%** divergence when the fault lands in the inter-write gap (deterministic,
  both sequential and concurrent); **59.3%** under random faults during the active window.
- unified: **0%** everywhere. Crucially, the **95 + 34 "consistent"** unified cases are
  ops where the client was killed *after* the atomic commit — provenance event AND
  bridge link were both already present *together*. The single RW-set is never observed
  half-applied: every kill yields either "neither" (clean abort) or "both" (consistent).

---

## Phase 4 — Final report

Self-contained report written to `~/atomicity_comparison/RESULTS_REPORT.md`
(environment, what ran/skipped, baseline table, divergence table, reproduction
parameters, factual reading, caveats). Raw per-condition data in
`~/atomicity_comparison/logs/run_*/result.json` and `logs/bench_*.json`.

**Headline:** two-chaincode (two independent RW-sets) → 100% divergence on in-window
faults, 59.3% on random in-window faults. Unified (single RW-set) → 0 / 1,512
fault-injected trials (95% upper bound 0.198%); killed unified ops are always "both"
or "neither", never split.
