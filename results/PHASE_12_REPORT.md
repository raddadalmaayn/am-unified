# PHASE 12 REPORT — BatchTimeout probe, single-host testbed

**Session:** 2026-08-12, 03:24Z → 03:40Z
**Directory:** `results/phase12-20260812T032452Z/`
**Harness:** `bench.js` v2.1.0, `--clients=1`, three runs per condition, 60 s cooldowns
**Deployment:** single-host 2-org, `mychannel`, Fabric v3.1.0, unified CCAAS
binary `41f333d6…`, source commit `9a9db0ef`, chaincode tree clean.

Every figure was read from a file on disk or recomputed from `txs.jsonl`.
Nothing is estimated. The channel configuration was changed twice and restored;
both changes and the restoration were verified by re-fetch and decode (§1, §4).

---

## 0. Why this probe exists

The Section 5.2 sentence quantifying the 50 ms → 10 ms tuning rested on
old-harness numbers with no fragment behind them, and its 280.8 TPS contradicted
the re-measured Table 7. Phase 8 established that `BatchTimeout` is near-binding
on the single host (14.3 ms observed block interval against a 10 ms setting) and
slack on the four-node lab, so this is the regime where the parameter actually
binds. Measuring it is both a repair to that sentence and direct evidence for the
block-production mechanism that Sections 5.5.2 and 6.3 now rest on.

---

## 1. 12a — configuration before the probe

Fetched with `peer channel fetch config` and decoded with `configtxlator`.

| Field | Value |
|---|---|
| `sequence` | **3** |
| `BatchTimeout.timeout` | **10ms** ✅ confirmed |
| `BatchSize.max_message_count` | **100** |
| `BatchSize.preferred_max_bytes` | 2,097,152 |
| `BatchSize.absolute_max_bytes` | 103,809,024 |

Artifacts: `config/config_block_10ms.pb`, `config/config_10ms_v31.json`.

### 1.1 A finding that lands outside this phase

**`max_message_count` on the single-host channel is 100, not 10.** The four-node
lab channel is 10 (recorded in every Phase 3B manifest). The two testbeds do not
share this parameter.

This falsifies a sentence introduced into Section 5.3 in the previous pass, which
reads *"Block occupancy on this testbed reaches 6.5--7.5 transactions per block
against a \texttt{MaxMessageCount} of 10, so blocks here are cut close to the
count limit."* Both halves are wrong: the limit is 100, and 6.5–7.5 against 100
is not close to it. Blocks on the single host are cut by the timeout, exactly as
on the lab — the difference between the testbeds is the *timeout's* effect at a
given arrival rate, not the count ceiling. **Flagged for repair; not corrected
here, because Section 5.3 is outside this pass's scope.**

### 1.2 Toolchain

The `peer` on `$PATH` at `~/fabric-tools/bin` is **v2.5.15**, against a v3.1.0
network. 12c asked for the container binary in preference. The binary actually
used is `AM/fabric-samples/bin/peer`, **v3.1.0, commit SHA
`8f08391`** — identical version *and* commit to the peer inside
`peer0.org1.example.com`, verified by running `peer version` in both. It is the
same build, driven from the host, which avoids copying the orderer admin MSP into
a container. `configtxlator` v3.1.0 came from the same directory; decoding the
same config block with v2.5.15 and v3.1.0 produced byte-identical JSON, so the
version skew had no effect on the decode path either way.

---

## 2. 12b and 12d — measurements

Sequential = condition A (provenance, $W{=}1$, $n{=}500 \times 3$).
Concurrent = condition E (provenance, $W{=}100$, $n{=}2000 \times 3$).
All six runs: every transaction committed, invariant held, both peers agreed on
height and block hash.

| | **10 ms** | **50 ms** | change |
|---|---|---|---|
| **Sequential ($W{=}1$)** | | | |
| Mean latency | **40.1 ms** | 76.6 ms | **−47.7 %** |
| P50 latency | 40.9 ms | 76.6 ms | −46.6 % |
| P50 range across runs | 35.2–45.8 ms | 76.5–90.8 ms | — |
| Steady TPS | 24.90 | 13.04 | +90.9 % |
| Transactions per block | 1.00 | 1.00 | — |
| Blocks per second | 28.16 | 13.81 | +103.9 % |
| Committed | 1500/1500 | 1500/1500 | — |
| State size at measurement | 79,421 keys, height 20,926 | 79,427 keys, height 23,219 | — |
| **Concurrent ($W{=}100$)** | | | |
| Steady TPS | **427.79** | 416.67 | **+2.7 %** |
| Total-window TPS | 432.98 | 423.27 | +2.3 % |
| P50 latency | 227.3 ms | 231.9 ms | −2.0 % |
| Transactions per block | **7.81** | **24.39** | −68.0 % |
| Blocks per second | **71.97** | **23.25** | +209.5 % |
| Committed | 6000/6000 | 6000/6000 | — |
| State size at measurement | 79,424 keys, height 22,429 | 79,430 keys, height 24,722 | — |

---

## 3. What the probe shows

**Sequential latency is dominated by the timeout, and the published percentage
survives.** At one transaction in flight there is never a second transaction to
fill a block, so every block waits out the full `BatchTimeout`. Latency tracks it
almost exactly: the 36.5 ms difference in mean latency against a 40 ms difference
in timeout setting. The measured **−47.7 %** is within half a point of the
**−47 %** the manuscript has claimed all along. The published *absolute* values
(91.8 → 49.0 ms) do not reproduce — this run measured 76.6 → 40.1 ms — which is
expected, since the state is now 79,421 counted keys against roughly 7,500 when
the original figure was taken. **The ratio was right; the absolutes were stale.**

**Concurrent throughput is almost entirely insensitive to the timeout, and the
published claim that it rose is not reproduced.** The manuscript states the
change raised provenance throughput from 260.8 to 280.8 TPS, a 7.7 % gain. The
measured effect at $W{=}100$ is **+2.7 %**, and the mechanism explains why it is
small: throughput is the product of block rate and block occupancy, and the two
move in opposite directions by almost exactly compensating factors.

```
10 ms:   7.81 tx/block  x  71.97 blocks/s
50 ms:  24.39 tx/block  x  23.25 blocks/s
```

Occupancy falls 3.1× as the rate rises 3.1×. **The timeout sets the granularity
at which the ledger is written, not the rate at which work passes through it.**

**Neither setting is count-bound.** At 50 ms the orderer packs 24.39 transactions
into a block against a `max_message_count` of 100; at 10 ms it packs 7.81. Both
are far below the ceiling, so in both cases blocks are cut by the timeout
expiring. This is the single-host counterpart of the distributed finding in
Section 5.5.2 and it is stronger evidence, because here the timeout was actually
varied and the occupancy moved with it in the predicted direction.

### 3.1 What this does not establish

The probe covers one operation type (provenance) at two concurrency levels on one
testbed at one state size. It does not establish that the compensation is exact
at other loads, and the $W{=}100$ result should not be read as "BatchTimeout does
not matter" — it matters a great deal at low concurrency, which is the regime the
sequential tables report.

---

## 4. 12e — restoration, verified

| Step | `sequence` | `BatchTimeout` | Verified by |
|---|---|---|---|
| Before probe | 3 | 10ms | fetch + decode |
| After 12c | **4** | **50ms** | fetch + decode |
| After 12e | **5** | **10ms** ✅ | fetch + decode |

Each update wrote **only** `BatchTimeout` — confirmed by decoding the
`ConfigUpdate` and listing the write set (`{"writes":["BatchTimeout"]}`), with an
empty read set on the first and no other group touched.

Diffing the restored config against the pre-probe config, with `sequence`
removed, yields exactly one difference: the `version` counter on the
`BatchTimeout` value, 1 → 3, which increments on every modification and is not a
configuration parameter. **Every configuration value is back to its pre-probe
state.** Both peers report identical height and block hash.

Signature requirement, checked rather than assumed: `BatchTimeout.mod_policy` is
`Admins` within the `Orderer` group, whose `Admins` policy is `MAJORITY` over
sub-policy `Admins` across Orderer organizations, of which this channel has one
(`OrdererOrg`). A single OrdererMSP admin signature therefore suffices, and
`peer channel update` run as that identity both signed and submitted. No Org1 or
Org2 signature was needed. (This differs from the four-node lab, where three
signatures are required.)

---

## 5. 12f — emitted fragment

`results/latex_fragments/phase12_batchtimeout_sentence.tex`, with companion
`.txt` provenance, generated by `client-tests/emit_latex_phase12.js`. No number
in it is typed by hand; each is read from `analysis.json`, `occupancy.json`, a
run manifest, or recomputed from `txs.jsonl` through `steady.js`, and the `.txt`
names the file and JSON path for every one.

> Reducing `BatchTimeout` from 50 ms to 10 ms reduces mean sequential provenance
> write latency from 76.6 ms to 40.1 ms (−47.7 %), because at one transaction in
> flight every block waits out the full timeout. It leaves concurrent throughput
> at W=100 essentially unchanged, 416.67 against 427.79 TPS (+2.7 %): the shorter
> timeout cuts smaller blocks more often, 7.81 transactions per block at 71.97
> blocks per second against 24.39 at 23.25, and their product, which is
> throughput, is conserved. Both settings were measured on the same deployment at
> a state size of 79,424 counted keys.

**Not yet inserted into the manuscript.** Section 5.2 is outside this pass's
scope; the fragment is ready for the pass that takes it.

---

## 6. Deviations and caveats

1. **`channel_params` inside the manifests records an error**, as it did in
   Phase 8. `bench.js:544` fetches with `-o orderer.example.com:7050`, and that
   name does not resolve on this host; adding it to `/etc/hosts` needs root,
   which is not available without a password. The configuration is captured
   independently and completely in `config/` using
   `--ordererTLSHostnameOverride`, so nothing is unmeasured — but the manifests
   carry the same gap as Phase 8's, which keeps them comparable.
2. **State size is roughly 10× the Phase 8 baseline** (79,42x counted keys against
   7,509). Absolute figures here are not comparable to Table 7; the 10 ms against
   50 ms comparison is internally controlled because both settings were measured
   within 15 minutes of each other on the same deployment, with state growing by
   only 9 keys across the whole probe.
3. **Sequential latency at 50 ms shows a wider run-to-run range** (76.5–90.8 ms
   P50) than at 10 ms (35.2–45.8 ms). Three runs is too few to characterise that
   spread; it is reported rather than smoothed.
4. The probe used `--clients=1`, matching Phase 8, so the connection-multiplicity
   question of Phase 4b is held constant and not re-opened here.

---

## 7. Consequences for the manuscript

| Where | Consequence |
|---|---|
| §5.2 BatchTimeout sentence | Replace with the emitted fragment. The −47 % survives; the absolute values and the throughput claim do not. |
| §5.3 `MaxMessageCount` sentence | **Wrong** — single-host limit is 100, not 10, and occupancy is not close to it (§1.1). Must be repaired. |
| §5.5.2, §6.3 | Strengthened. The mechanism argued there from the lab is now confirmed on the single host with the parameter actually varied. |
| §4.3 | Its forward reference to the §5.2 sentence remains valid; the sentence continues to quantify the tuning, with measured numbers. |
