# GATE 0 REPORT — Phase 0 Inventory and Integrity

**Session date:** 2026-08-04
**Captured:** 2026-08-04T20:20:38Z onward
**Evidence directory:** `am-unified/results/phase0-20260804T202038Z/`
**Scope:** Phase 0 only. No measurement taken, no configuration changed, no chaincode
touched, no `.tex` file edited. Everything below is measured from the live system or
read from disk; nothing is estimated, interpolated or carried over from a previous
session's summary.

---

## VERDICT

**GATE 0: PASS.** None of the five stop conditions holds.

| Stop condition | Result |
|---|---|
| Peers disagree on block height | ❌ does not hold — all four agree at height 17664, identical hash |
| Fewer than three consenters active | ❌ does not hold — all three report `status: active` |
| Deployed chaincode does not match `9a9db0e` | ❌ does not hold — verified by symbol content, identical on all four nodes |
| Application Endorsement policy is not MAJORITY | ❌ does not hold — policy is `MAJORITY Endorsement` |
| Any node already has a qdisc applied | ❌ does not hold — default qdiscs only, no netem anywhere |

Proceeding is permitted. Three decisions are requested at the end of this document
before Phase 1 begins.

---

## 1. CONTRADICTIONS AGAINST THE STATED CONTEXT

### 1.1 One real contradiction: Fabric version

| Stated belief | Measured value |
|---|---|
| Hyperledger Fabric **v3.1.0** | **v3.1.4** |

`peer version` inside every peer container reports `Version: v3.1.4`.
`orderer version` inside every orderer container reports `Version: v3.1.4`.

Image digests, identical across nodes:

```
peer    hyperledger/fabric-peer:latest      sha256:222c37c35011fca3b10d7d...   (D1, D2, D3, D4)
orderer hyperledger/fabric-orderer:*        sha256:5cf04c3399a0b9a374840d51e09c0a0fce5ef8d8a59dc8fd24ec999d37b4c7f8
```

**Why this matters beyond bookkeeping.** The manuscript states "Hyperledger Fabric
v3.1.0" in the architecture section, the implementation section and the abstract. On
the evidence available today the testbed has never been v3.1.0 for any measurement.
This is a correction item for the paper, not something Phase 0 can fix, and the paper
was not edited.

### 1.2 Everything else in the context block is confirmed

| Stated belief | Status |
|---|---|
| D1 = Org1 Manufacturer peer + its own CCAAS container + SDK client | ✅ confirmed |
| D2 = Org2 Supplier peer + CCAAS | ✅ confirmed |
| D3 = Org3 Logistics peer + CCAAS | ✅ confirmed |
| D4 = Org4 Regulator peer + CCAAS | ✅ confirmed |
| Raft ordering runs three consenters across D2, D3, D4 | ✅ confirmed (`orderer2`→D2, `orderer3`→D3, `orderer.example.com`→D4) |
| BatchTimeout 50 ms | ✅ confirmed |
| MaxMessageCount 10 | ✅ confirmed |
| PreferredMaxBytes 2 MB | ✅ confirmed (2097152) |
| Application Endorsement = MAJORITY, evaluated as 3-of-4 | ✅ confirmed |
| Chaincode carries the predecessor assertion, commit `9a9db0e` | ✅ confirmed |

### 1.3 Secondary findings that are not contradictions but should be recorded

1. **No Fabric CA container is running on any node.** Enrolled MSP material persists
   on disk so nothing is blocked, but Figure 1 and Section 3.3 both state that each
   organization operates a dedicated Fabric CA, and at runtime today none does.
2. **Orderer image tag differs on D4** (`hyperledger/fabric-orderer:latest`) versus
   D2 and D3 (`hyperledger/fabric-orderer:3.1.4`). The image **digest is identical**,
   so there is no version skew. Tag inconsistency only.
3. **`peer` CLI in `~/fabric-tools/bin` on D1 is v2.5.15** against a v3.1.4 network.
   It works for `getinfo`, `querycommitted`, `queryapproved`, `fetch config` and
   `chaincode invoke`. Whether it can drive a `channel update` against v3.1.4 should
   be verified **before** Phase 7 rather than discovered mid-mutation.
4. **No metrics provider is enabled on any orderer.** The operations endpoint on D2
   and D3 (`:9446`) returns nothing, and **D4's orderer has no operations endpoint
   configured at all**. Prometheus Raft metrics are therefore unavailable.
5. **`osnadmin` exists only on D1**, not on D2/D3/D4 and not inside the orderer
   images. All three orderers were queried from D1.
6. **`peer0.org2.example.com` has been up 3 months** while every other container is
   at 23 hours. It was not restarted with the rest of the topology change. Not a
   fault, but an inconsistency worth knowing if D2 behaves oddly later.
7. **Inter-node interface names differ per node.** Phase 5 must apply netem
   per-node, not from a single shared variable.

---

## 2. PHASE 0a — REPOSITORY AND CHAINCODE INTEGRITY

### 2.1 Repository state (laptop)

```
root:    am-unified
branch:  main
HEAD:    9a9db0ef541d2e400effdb08e3b4a135692a2c10
subject: Assert lifecycle predecessor in the bridge provenance path (2026-08-03 15:28:12 -0600)
9a9db0e is ancestor of HEAD: YES (it IS HEAD)
```

Working tree is **dirty, but only in paths irrelevant to the chaincode**:

```
 M scripts/deploy.sh
?? Paper/
?? results/geo-distributed/
?? results/post-time-fix-20260420-143353/
```

No file under `chaincode/unified/` is modified. The tree that produced the deployed
binary is clean.

### 2.2 Committed chaincode definition, queried on each peer

Identical on all four peers:

```json
{"sequence":3,"version":"1.0",
 "approvals":{"Org1MSP":true,"Org2MSP":true,"Org3MSP":true,"Org4MSP":true}}
```

### 2.3 Package IDs per organization

They differ. **This is expected** with per-org connection addresses under CCAAS and
is explicitly not treated as a fault.

| Org | Approved package ID (sequence 3) |
|---|---|
| Org1 | `unified_1.0:c1ded1df7bc04996697612e1b160b26c9dfeb0f1d8ee9cfe1ac065c17661e36b` |
| Org2 | `unified_1.0:d5341812bb1d50af53086caba4e34fba86bdab0b28284efab368e980e87ed67e` |
| Org3 | `unified_1.0:e36470d8d8144e94310125acc9165477e697b6a6f3c6ed20b600c68d131a70b6` |
| Org4 | `unified_1.0:ef5524c83fc91330f3d23bfeff7448cf3876458b6bfee6a75c117f89d417597c` |

Each org's `queryapproved` names its own package ID, and each `cc-unified` container's
`CORE_CHAINCODE_ID_NAME` matches its host org.

### 2.4 Binary digest across all four nodes

**Byte-identical on D1, D2, D3, D4:**

```
sha256  46ae8a9f2cfcac4cf967ddcd0bf47e381f3f3377b8647b52c94dd39cb40ecff5
md5     d1bda4727696177d2b0389eb1121649b
image   sha256:69ace66880c3a5b8b814fbdf66f11c168843dbd4b0cde85c0082b9247ad089f5
size    18,388,633 bytes
```

### 2.5 Correspondence to commit 9a9db0e

A rebuild cannot byte-match because Go embeds the build path in the binary. Verified
instead by **symbol content**, which is decisive.

Three Phase A assertion strings, all **PRESENT** in the deployed binary:

```
requires stage %s, current stage is %s                            PRESENT
requires stage %s, asset does not exist                           PRESENT
is a genesis event and requires an asset that does not yet exist  PRESENT
```

Three pre-Phase-A per-function strings, all **ABSENT** (grep count 0 on every node):

```
RecordPrintJob requires stage MATERIAL_CERTIFIED
RecordInspection requires stage PRINT_COMPLETE
RecordCertification requires stage INSPECTION_PASSED
```

The superseded binary is still on disk beside the live one and carries the inverse
symbol set:

```
/chaincode/unified_ccaas               18,388,633 B  (live, Phase A)
/chaincode/unified_ccaas.pre-phaseA.bak 18,372,570 B  (April time-fix build)
```

### 2.6 Integrity caveat that must be carried forward

Under CCAAS the chaincode definition **does not hash the binary**. The package
contains only a `connection.json`. Sequence 3 reuses the same package IDs as
sequence 2. The lifecycle definition therefore provides **no integrity binding to the
deployed code**, and "sequence 3 is committed" must never be cited as proof that the
Phase A code is running. The symbol evidence in §2.5 is the only thing that
establishes it.

---

## 3. PHASE 0b — BLOCK HEIGHT ON ALL FOUR PEERS

All four agree.

| Node | Peer | Height | Current block hash |
|---|---|---|---|
| D1 | peer0.org1.example.com | 17664 | `Kp3DAYVCPR5S+kNnfsbgL+8+h4jBFz/bNPi74EUv7qI=` |
| D2 | peer0.org2.example.com | 17664 | `Kp3DAYVCPR5S+kNnfsbgL+8+h4jBFz/bNPi74EUv7qI=` |
| D3 | peer0.org3.example.com | 17664 | `Kp3DAYVCPR5S+kNnfsbgL+8+h4jBFz/bNPi74EUv7qI=` |
| D4 | peer0.org4.example.com | 17664 | `Kp3DAYVCPR5S+kNnfsbgL+8+h4jBFz/bNPi74EUv7qI=` |

Previous block hash on all four: `VsYjnxac2N4Mny54iLnCj6vBrDY5N0kF6CMMYF9LUw4=`.

---

## 4. PHASE 0c — CHANNEL CONFIGURATION

Fetched with `peer channel fetch config` against `orderer.example.com:7050`, decoded
with `configtxlator proto_decode --type common.Block`.

**Saved to:** `channel_config_phase0.json` (81,750 bytes) in this directory.

Config sequence **6**. Last config block **15138**. Current height 17664.

### 4.1 Values extracted verbatim

**Application Endorsement policy:**

```json
{
  "mod_policy": "Admins",
  "policy": { "type": 3, "value": { "rule": "MAJORITY", "sub_policy": "Endorsement" } },
  "version": "0"
}
```

**LifecycleEndorsement policy:**

```json
{"type":3,"value":{"rule":"MAJORITY","sub_policy":"Endorsement"}}
```

**Application organizations:** `Org1MSP, Org2MSP, Org3MSP, Org4MSP`
→ MAJORITY over four organizations = **3-of-4**.

**BatchTimeout:**

```json
{"timeout":"50ms"}
```

**BatchSize:**

```json
{
  "absolute_max_bytes": 103809024,
  "max_message_count": 10,
  "preferred_max_bytes": 2097152
}
```

`absolute_max_bytes` = 99 MB, `preferred_max_bytes` = 2 MB.

**ConsensusType:**

```json
{"type":"etcdraft","state":"STATE_NORMAL",
 "options":{"election_tick":10,"heartbeat_tick":1,"max_inflight_blocks":10,
            "snapshot_interval_size":16777216,"tick_interval":"100ms"}}
```

**Full consenter list with addresses:**

```
orderer.example.com:7050
orderer2.example.com:7050
orderer3.example.com:7050
```

**OrdererAddresses value:**

```json
{"addresses":["orderer.example.com:7050","orderer2.example.com:7050","orderer3.example.com:7050"]}
```

### 4.2 Config element versions

Relevant to Phase 7, because these increment on mutation and give a clean audit trail:

| Element | Version | Meaning |
|---|---|---|
| `Orderer.BatchSize` | 0 | never modified since genesis |
| `Orderer.BatchTimeout` | 0 | never modified since genesis |
| `Application.Endorsement` | 0 | never modified since genesis |
| `Application.LifecycleEndorsement` | 0 | never modified since genesis |
| `Orderer.ConsensusType` | **2** | the only element ever changed (consenter set + Raft tuning) |

Batching and endorsement have been constant for the entire life of the channel. Any
measurement difference between April, August 3 and today is **not** attributable to
batching or endorsement configuration.

---

## 5. PHASE 0d — ORDERER STATE AND CONSENSUS PARTICIPATION

### 5.1 Leader identification

Leader is **node 1 = `orderer.example.com` on D4**, at **term 4**.

```
2026-08-03 21:16:48.338 UTC  node=1  Raft leader changed: 0 -> 1
2026-08-03 22:10:58.335 UTC  node=1  Raft leader changed: 1 -> 0
2026-08-03 22:11:13.551 UTC  node=1  raft.node: 1 elected leader 1 at term 4
2026-08-03 22:11:13.552 UTC  node=1  Raft leader changed: 0 -> 1
2026-08-03 22:11:13.548 UTC  node=2  raft.node: 2 elected leader 1 at term 4
2026-08-03 22:11:31.233 UTC  node=3  raft.node: 3 elected leader 1 at term 4
```

All three nodes independently agree on leader 1 at term 4. No election has occurred
since 2026-08-03 22:11:31 UTC.

### 5.2 Live per-consenter participation evidence

`osnadmin channel list --channelID amchannel` run from D1 against each orderer's
admin endpoint on port 7053, using each orderer's own TLS material:

| Consenter | Node | consensusRelation | status | height |
|---|---|---|---|---|
| orderer.example.com | D4 | `consenter` | **`active`** | **17664** |
| orderer2.example.com | D2 | `consenter` | **`active`** | **17664** |
| orderer3.example.com | D3 | `consenter` | **`active`** | **17664** |

**Why this satisfies the "not one leader with two dead followers" requirement.** Each
orderer independently reports **its own replicated ledger height**, and all three
match each other and all four peers at 17664. A follower that had stopped receiving
append-entries would lag here. This is per-consenter evidence of successful
replication, not a restatement of the config list.

Supporting historical evidence from the follower logs:

```
node=2  Store ActiveNodes [1 2 3] channel=amchannel
node=3  Store ActiveNodes [1 2 3] channel=amchannel
```

### 5.3 What could NOT be obtained, and why

Live heartbeat / append-entries counters are **not available**, for two independent
reasons:

1. **No metrics provider is enabled on any orderer.** `curl :9446/metrics` on D2 and
   D3 returns no `consensus_etcdraft_*` series. **D4's orderer has no
   `ORDERER_OPERATIONS_LISTENADDRESS` at all**, so it has no operations endpoint.
2. **Raft heartbeats log only at DEBUG level**, and the cluster is idle, so no
   append-entries lines appear in the current logs.

Enabling either would require changing orderer configuration, which Phase 0
explicitly forbids ("report, do not fix"). A live alternative is proposed in §12.

---

## 6. PHASE 0e — CONTAINER INVENTORY

### 6.1 All containers on all four nodes

| Node | Container | Image tag | Status |
|---|---|---|---|
| D1 | `peer0.org1.example.com` | `hyperledger/fabric-peer:latest` | Up 23 hours |
| D1 | `cc-unified` | `unified_ccaas_image:latest` | Up 23 hours |
| D2 | `peer0.org2.example.com` | `hyperledger/fabric-peer:latest` | **Up 3 months** |
| D2 | `cc-unified` | `unified_ccaas_image:latest` | Up 23 hours |
| D2 | `orderer2.example.com` | `hyperledger/fabric-orderer:3.1.4` | Up 23 hours |
| D3 | `peer0.org3.example.com` | `hyperledger/fabric-peer:latest` | Up 23 hours |
| D3 | `cc-unified` | `unified_ccaas_image:latest` | Up 23 hours |
| D3 | `orderer3.example.com` | `hyperledger/fabric-orderer:3.1.4` | Up 23 hours |
| D4 | `peer0.org4.example.com` | `hyperledger/fabric-peer:latest` | Up 23 hours |
| D4 | `cc-unified` | `unified_ccaas_image:latest` | Up 23 hours |
| D4 | `orderer.example.com` | `hyperledger/fabric-orderer:latest` | Up 23 hours |

**Container types absent:** no Fabric CA container on any node. Total 11 containers
across 4 nodes: 4 peers, 4 chaincode, 3 orderers, 0 CAs.

Host uptimes: D1 16 weeks 5 days, D2 16 weeks 5 days, D3 18 weeks, D4 23 hours.

### 6.2 Peer-to-chaincode locality — verified on live TCP state

Verified from established socket state, not from configuration files.

| Node | `CORE_PEER_CHAINCODEADDRESS` | peer netmode | cc netmode | Established connection on :9999 |
|---|---|---|---|---|
| D1 | `peer0.org1.example.com:7052` | host | host | `D1:45450 ↔ D1:9999` |
| D2 | `peer0.org2.example.com:7052` | host | host | `D2:41926 ↔ D2:9999` |
| D3 | `peer0.org3.example.com:7052` | host | host | `D3:50846 ↔ D3:9999` |
| D4 | `peer0.org4.example.com:8052` | host | host | `D4:39594 ↔ D4:9999` |

**Every peer connects to a chaincode container on its own host. No peer reaches a
shared endpoint.** Note D4 uses ports 8051/8052 where D1, D2, D3 use 7051/7052.

---

## 7. PHASE 0f — NODE.JS AND FABRIC SDK

| Item | Value |
|---|---|
| Node.js on D1 (SDK host) | **v18.20.8** |
| Node.js on laptop | v18.19.1 |
| npm on laptop | 9.2.0 |
| `@hyperledger/fabric-gateway` | **1.10.1** (declared `^1.8.0`) |
| `@grpc/grpc-js` | 1.14.3 |
| `fabric-network` | 2.2.20 (installed, not used by the geo harness) |
| `fabric-ca-client` | 2.2.20 |

Declared dependencies in `client-tests/package.json`:

```json
{"@grpc/grpc-js":"^1.13.4","@hyperledger/fabric-gateway":"^1.8.0",
 "fabric-ca-client":"2.2","fabric-network":"2.2"}
```

The existing geo harness imports `@hyperledger/fabric-gateway`.

**Consequence for Phase 1c: the phase split IS obtainable.** With fabric-gateway
1.10.1 the submission can be decomposed into `proposal.endorse()` →
`transaction.submit()` → `await commit.getStatus()`, with timestamps taken between
each step. Endorsement latency and order-plus-commit latency will therefore be
**measured separately, not approximated**. The 1c fallback path (total latency only,
with a stated limitation) is not needed.

---

## 8. PHASE 0g — BENCHMARK SCRIPTS AND RESULTS INVENTORY

### 8.1 The specific question: how many April benchmark JSON files exist

**Answer: three full-size April runs back the published median, not one. But a fourth
full-size run exists and was excluded without disclosure.**

Full-size runs (`sequential_runs`=500, `concurrent_runs`=2000, `c`=20) on 2026-04-20:

| File (UTC timestamp) | prov_seq mean | conc_prov TPS | In published set? |
|---|---|---|---|
| `geo_benchmark_2026-04-20T22-28-10-999Z.json` | 359.658 ms | 30.979 | ❌ **excluded** |
| `geo_benchmark_2026-04-20T22-49-35-257Z.json` | 358.280 ms | 30.686 | ✅ `fix2/run1` |
| `geo_benchmark_2026-04-20T23-06-08-151Z.json` | 369.926 ms | 28.908 | ✅ `fix2/run2` |
| `geo_benchmark_2026-04-20T23-22-41-037Z.json` | 371.650 ms | 29.946 | ✅ `fix2/run3` |

Mapping confirmed by modification times: `fix2-20260420-161332/run1` (16:49 local =
22:49 UTC), `run2` (17:06 = 23:06 UTC), `run3` (17:22 = 23:22 UTC).

**The 22:28 UTC run is not an outlier.** Its provenance sequential mean (359.658 ms)
sits between run1 and run2, and its concurrent TPS (30.979) is the highest of the
four. That makes the exclusion harder to justify rather than easier. There is no
stated selection criterion anywhere in `SUMMARY.md`.

### 8.2 All benchmark result files, with modification times

Smaller / smoke runs:

| File | seq | conc | c | prov_seq mean | conc_prov TPS |
|---|---|---|---|---|---|
| `…2026-04-08T21-38-30-911Z.json` | 50 | 200 | 20 | 348.02 ms | 32.222 |
| `…2026-04-08T22-47-12-096Z.json` | 50 | 200 | 20 | 345.74 ms | 33.041 |
| `…2026-04-20T20-36-10-456Z.json` | 50 | 200 | 20 | 373.70 ms | 25.536 |
| `…2026-04-20T20-40-44-442Z.json` | 50 | 200 | 20 | 365.32 ms | 32.884 |
| `…2026-08-03T21-36-08-896Z.json` | 50 | 50 | 20 | 375.48 ms | 32.680 |
| `…2026-08-03T21-38-53-045Z.json` | 20 | 20 | 20 | 344.20 ms | 34.247 |

August full-size run:

| File | seq | conc | c | prov_seq mean | conc_prov TPS |
|---|---|---|---|---|---|
| `…2026-08-03T22-35-10-774Z.json` | 500 | 2000 | 20 | **431.102 ms** | **21.301** |

**The August 3 full-size run is a single run. There is no second or third.** This
contrasts directly with April, where three exist.

Other artifacts in `results/geo-distributed-v2/`: `benchmark_10k_*.json/.csv` (Apr 8),
`docker_stats_10k_20260408_174627.txt`, `network_baseline_*.txt` (Apr 8),
`orderer_20260408_153903.log`, `peer_org{1,2,3,4}_20260408_153903.log`,
`scalability_2026-04-08T23-07-18-887Z.csv`, `scalability_2026-08-03T21-36-57-116Z.csv`.

Results directories on D1: `geo-distributed/`, `geo-distributed-v2/`, `performance/`,
`security/`.
Results directories on the laptop: `fix2-20260420-161332/` (+ `.zip`),
`geo-distributed/`, `performance/`, `post-time-fix-20260420-143353/`, `security/`, and
this new `phase0-20260804T202038Z/`.

### 8.3 Benchmark scripts on D1

| File | Size | Modified |
|---|---|---|
| `geo_benchmark.js` | 24,543 B | 2026-04-20 16:13 |
| `_smoke_bench.js` | 24,540 B | 2026-08-03 15:33 |
| `_smoke_sweep.js` | 6,190 B | 2026-08-03 15:33 |
| `_fault_bench.js` | 24,540 B | 2026-08-03 15:37 |
| `scalability_test.js` | 6,191 B | 2026-04-08 16:22 |
| `benchmark_10k.js` | 28,055 B | 2026-04-08 17:30 |
| `smoke_test.js` | 5,605 B | 2026-04-20 14:32 |
| `quick_test.sh` | 810 B | 2026-04-08 16:20 |
| `performance_test.js` | 27,778 B | 2026-03-30 15:39 |
| `security_test.js` | 28,778 B | 2026-03-30 15:39 |
| `ci_gate_test.js` | 11,254 B | 2026-03-30 15:39 |
| `sybil_ci_gate_test.js` | 13,017 B | 2026-03-30 15:39 |
| `buffer_concurrent_test.js` | 3,832 B | 2026-03-30 15:39 |
| `enrollAdmin.js` / `enrollUsers.js` | 1,913 / 4,362 B | 2026-03-30 15:39 |

---

## 9. PHASE 0h — FAULT-INJECTION HARNESS

**It does not exist.**

Search performed on both the laptop repo and D1, for `SIGKILL`, `child_process`,
`fork(`, `docker stop`, `docker network disconnect`, `fsync`, across `*.js`, `*.sh`,
`*.go`, `*.py`, `*.ts`, excluding `node_modules/` and `vendor/`.

| Location | Matches |
|---|---|
| D1 `~/am-unified` | **zero** |
| Laptop `am-unified` | **one**: `scripts/deploy-4org.sh:35` |

The single laptop match is a teardown line in a deployment script:

```bash
$SSH $host "sudo docker stop \$(sudo docker ps -aq) 2>/dev/null; \
```

That is not fault injection.

**`_fault_bench.js` is not a fault harness.** A case-insensitive grep for
`fault|kill|stop|crash|partition|inject` inside it returns **0 matches**. It is a copy
of `geo_benchmark.js` with the run counts reduced, carrying a misleading filename.

**Consequence:** Table 10's fault-injection matrix has no reproducible harness
anywhere in this repository. Phase 6 will be building this capability from nothing,
not re-running an existing tool.

---

## 10. PHASE 0i — NETWORK BASELINE AND PHASE 5 PRE-FLIGHT

### 10.1 Interfaces and MTU

Interface names differ per node. Phase 5 must apply netem per-node.

| Node | Inter-node interface | MTU | Prefix |
|---|---|---|---|
| D1 | `enp4s0f0` | 1500 | /23 |
| D2 | `enp0s25` | 1500 | /23 |
| D3 | `eno1` | 1500 | /23 |
| D4 | `eno1` | 1500 | /23 |

All four nodes sit on a single private `/23`, so all
inter-node traffic is single-hop on one L2 segment.

### 10.2 qdisc state — clean

| Node | `tc qdisc show dev <iface>` |
|---|---|
| D1 | `qdisc mq 0: root` + `qdisc fq_codel 0: parent :1 …` |
| D2 | `qdisc fq_codel 0: root refcnt 2 …` |
| D3 | `qdisc fq_codel 0: root refcnt 2 …` |
| D4 | `qdisc fq_codel 0: root refcnt 2 …` |

**No netem on any node. No non-default qdisc on any node.** Phase 5 pre-flight is
clean and the GATE 0 qdisc condition does not trigger.

### 10.3 Full ping matrix

`ping -c 100 -i 0.2` between every ordered node pair. **0% packet loss on all twelve
pairs.** Values are min / avg / max / mdev in milliseconds.

| source → dest | D1 | D2 | D3 | D4 |
|---|---|---|---|---|
| **D1 →** | — | 0.285 / **0.359** / 0.445 / 0.030 | 0.232 / **0.635** / 0.956 / 0.197 | 0.242 / **0.427** / 0.943 / 0.169 |
| **D2 →** | 0.217 / **0.350** / 0.550 / 0.061 | — | 0.157 / **0.499** / 0.780 / 0.187 | 0.152 / **0.371** / 0.764 / 0.188 |
| **D3 →** | 0.247 / **0.520** / 0.732 / 0.125 | 0.153 / **0.290** / 0.573 / 0.085 | — | 0.155 / **0.527** / 1.107 / 0.279 |
| **D4 →** | 0.186 / **0.436** / 0.803 / 0.146 | 0.171 / **0.282** / 0.555 / 0.061 | 0.171 / **0.531** / 1.094 / 0.258 | — |

Every pair is sub-millisecond, consistent with the manuscript's "sub-1 ms RTT" LAN
characterization. These figures are the WAN baseline against which Phase 5's 10 ms,
25 ms and 50 ms targets will be measured, and the restoration target for step 5g.

---

## 11. PHASE 0j AND 0k — STORAGE

### 11.1 Results filesystem (0j)

| Host | Path | Device | FS | Size | Available | Inodes free |
|---|---|---|---|---|---|---|
| D1 | `am-unified/results` | `/dev/sda2` | **ext4** | 915 G | **834 G** | 60,652,725 |
| Laptop | `am-unified/results` | `/dev/nvme0n1p2` | ext4 | 247 G | 70 G | — |

**Not tmpfs.** Phase 1b's requirement that `txs.jsonl` must not sit on tmpfs is
satisfiable in place, with ample space for per-transaction records at the volumes
Phases 3 through 8 imply.

### 11.2 State-size baseline — checkpoint 1 of 4 (0k)

| Node | production dir | `stateLeveldb` | `chains` (block store) | files in stateLeveldb |
|---|---|---|---|---|
| D1 | 471 M | 29 M | 434 M | 20 |
| D2 | 471 M | 28 M | 434 M | 20 |
| D3 | 470 M | 28 M | 434 M | 20 |
| D4 | 470 M | 28 M | 434 M | 20 |

Peer production directories:
`fabric-network/peer0-org{1,2,3,4}-data`.

### 11.3 Key count — partially obtainable, and one instrument defect

**Total LevelDB key count is NOT obtainable read-only.** The `ledgerutil` build
present on D1 exposes only three commands:

```
compare [<flags>] <snapshotPath1> <snapshotPath2>
identifytxs [<flags>] <snapshotDiffsPath> [<blockStorePath>]
verify [<flags>] [<blockStorePath>]
```

There is no key-count command. A true total requires taking a peer snapshot, which
means stopping a peer. That was not done, and Phase 0 forbids it.

**An exact read-only substitute exists.** `IntegrationContract:GetSupplyChainMetrics`
range-scans state prefixes and returns counts. Baseline captured today:

```json
{"totalAssets":0,"activeActors":32047,"totalRatings":33146,
 "totalDisputes":0,"linkedEvents":16299,"generatedAt":1785875324}
```

| Counter | Value | Underlying prefix |
|---|---|---|
| `activeActors` | 32,047 | `REPUTATION:` |
| `totalRatings` | 33,146 | rating keys |
| `linkedEvents` | 16,299 | `PROV_REP_LINK:` |
| `totalDisputes` | 0 | `DISPUTE:` |
| `totalAssets` | **0 — defective** | see below |

⚠️ **`totalAssets` reads 0 although assets certainly exist.** Assets are stored under
bare asset IDs with no key prefix, so the range scan in `GetSupplyChainMetrics` cannot
match them. This is a defect in the metrics function, **not an empty ledger**. At each
of the four state-growth checkpoints I will report the three counters that work and
state plainly that asset count is not measured, rather than substituting an estimate.

Counted keys at baseline: **81,492** across the three working classes.

---

## 12. OPEN DECISIONS BEFORE PHASE 1

GATE 0 passes, so Phase 1 may proceed. Three decisions are requested first.

1. **The v3.1.4 finding (§1.1).** The manuscript says v3.1.0 in at least three places.
   The paper was not edited and will not be. Should this be carried as a formal
   correction item in the eventual `REPORT.md`?

2. **The excluded April run at 22:28 UTC (§8.1).** Include it in the published set, or
   document the exclusion with an explicit criterion? As it stands the published
   median is three of four full-size runs with no stated selection rule, and the
   excluded run is not an outlier.

3. **Live Raft participation evidence (§5.3).** Prometheus metrics are unavailable and
   heartbeats are DEBUG-only, so today's evidence is `osnadmin` status plus matching
   independent heights. Should Phase 2 additionally sample each orderer's height
   immediately before and after the dry run, to demonstrate all three advancing
   together under live load? This costs nothing and needs no configuration change.

---

## 13. WHAT HAPPENS NEXT (not yet started)

Phase 1 has not begun. Per the plan, the first action in Phase 1 will be to **print
the existing `runConcurrent` function verbatim** and state its dispatch pattern,
before any new code is written. The old harness will be renamed and retained, not
deleted.

Nothing in Phases 1 through 9 has been executed. No measurement has been taken. No
configuration, chaincode, endorsement policy or network setting has been modified in
this session.

---

## APPENDIX — FILES IN THIS EVIDENCE DIRECTORY

| File | Bytes | Contents |
|---|---|---|
| `channel_config_phase0.json` | 81,750 | Full decoded channel config, Phase 0 baseline |
| `phase0_evidence.txt` | 2,114 | Condensed raw capture: repo, versions, digests, heights, osnadmin, ping matrix, interfaces, qdisc, storage |
| `april_published_SUMMARY.md` | 5,117 | Copy of the April 20 published three-run summary, for the §8.1 comparison |
| `GATE0_REPORT.md` | this file | Full Phase 0 report |
