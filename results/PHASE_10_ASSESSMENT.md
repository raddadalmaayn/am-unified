# PHASE 10 ASSESSMENT — the atomicity study and Table 11

**Written:** 2026-08-10. **Zero runs were performed for this document.**
Everything below was read from files already on disk.

This assessment exists so you can decide between re-running the atomicity study,
running a reduced confirmation, and disclosing. **It does not make that decision.**

---

## 1. The premise of this phase is wrong, and that changes everything

The Phase 10 brief states:

> Gate 0 established that no fault-injection harness exists anywhere in the
> repository.

**The fault-injection harness exists.** It is at
`atomicity_comparison/harness/`, it is complete, and it implements
every mechanism the brief lists as "what rebuilding would require".

| Brief says rebuilding would require | Status | Evidence |
|---|---|---|
| child process per logical operation | **EXISTS** | `run.js:71` — `spawn('node', ['worker.js'])` per op |
| SIGKILL at pre-registered timings | **EXISTS** | `run.js:91,104` — `process.kill(pid,'SIGKILL')`; `window` and `random` policies |
| fsync'd progress markers | **EXISTS** | `worker.js:48` — `fs.fsyncSync(fd)`, "durable before we might be killed" |
| `docker stop` for the two-chaincode arm | **EXISTS** | `run_ccfault.js:73` — `docker stop ${REPC}` |
| `docker network disconnect` for the two-chaincode arm | **EXISTS** | `run_ccfault.js:75` — `docker network disconnect fabric_test` |
| independent key-based ledger walk | **EXISTS** | `run.js:127-144` — "Ledger verification (independent key-based walk)", `verify()` |

The harness header documents its own divergence definition, including a
conservative AMBIGUOUS class that is **excluded** rather than counted as
divergent — a methodological choice that favours the null hypothesis.

### 1.1 Why Gate 0 missed it

Gate 0 searched *the repository* — `~/am-unified` — and reported zero matches on
D1 and one teardown line on the laptop. `~/atomicity_comparison` is a **sibling
directory, not part of that repo**. The Gate 0 statement is true as scoped and
false as generalised. It should be corrected in Phase 9 alongside the §8.4/8.5
correction, because the Phase 10 brief inherited the error and framed the whole
decision around rebuilding something that already exists.

**Nothing needs to be built.** That removes the largest cost from every option
below.

---

## 2. What the 6,900 figure actually is

From `atomicity_comparison/FINAL_SUMMARY.md`, dated 2026-06-23, with per-trial
raw markers on disk:

**Design B (unified) fault-injected trials:**

| Group | Condition | N |
|---|---|---|
| 2 | B window seq | 2,000 |
| 2 | B random seq | 2,000 |
| 2 | B random conc | 2,000 |
| 4 | B MatCert/compliance | 300 |
| 4 | B Print/quality | 300 |
| 4 | B Delivery/delivery | 300 |
| | **Total** | **6,900** |

Result as recorded: **0 / 6,900 divergences**, Wilson 95% [0, 0.056]%,
rule-of-three upper bound 0.0435%.

The Design A (two-chaincode) comparison arm:

| Group | Condition | Divergent / N |
|---|---|---|
| 2 | A window seq | 2000/2000 (100%) |
| 2 | A window conc | 2000/2000 (100%) |
| 2 | A random seq | 665/2000 (33.25%) |
| 2 | A random conc | 271/2000 (13.55%) |
| 3 | A kill rep container | 100/100 (100%) |
| 3 | A sever rep network | 100/100 (100%) |
| 4 | A MatCert / Print / Delivery | 300/300 each (100%) |

The study is **not** undocumented. It has a pre-specified matrix, a running log,
per-condition confidence intervals, an explicit note that fault timing was
"fixed, never tuned", and a note recording that random-kill divergence rates came
out *lower* than an earlier small-N run — i.e. it reports a result that weakened
its own headline rather than hiding it.

**Raw per-trial evidence survives**: 2,001 files per 2,000-trial condition
(`.prog` markers plus a records file), 301 per 300-trial condition.

---

## 3. The binary question — confirmed, and it is a real problem

The brief is correct that the data was taken on a pre-assertion binary. This is
now precisely dated:

| | Commit | Date | Relationship to study |
|---|---|---|---|
| Study ran | — | **2026-06-23** | — |
| Assertion added | **`9a9db0e`** "Assert lifecycle predecessor in the bridge provenance path" | **2026-08-03** | **41 days after** |
| Current deployed source | `9a9db0ef` | — | post-assertion |

The current chaincode contains predecessor assertions at
`provenance_contract.go:145,185,229` and `integration_contract.go:348,871`.

**Why this matters specifically.** The assertion rejects a provenance write whose
predecessor state is wrong. In the two-chaincode arm, divergence is created by
the provenance write committing while the reputation write never lands. If the
assertion changes which provenance writes are *accepted*, it can change the rate
at which the divergence window is entered at all. It is not obvious in which
direction, and **it is not measurable from the existing data** — the pre- and
post-assertion binaries were never run against the same conditions.

This is the strongest argument for at least a reduced confirmation run.

---

## 4. Does the two-chaincode deployment still exist?

> **⚠️ SUPERSEDED 2026-08-11 — see `PHASE_9_REPORT.md` §5.** `prov` and `rep`
> were deployed as CCAAS at 03:19:34Z / 03:21:17Z on 2026-08-11 and are
> **committed on `mychannel` at sequence 1**, verified live on both orgs. The
> June-binary caveat below is **resolved and no longer load-bearing**: the June
> builds are byte-for-byte current source and the predecessor assertion never
> applied to prov or rep. §8 question 3 is closed. See `PHASE_9_REPORT.md` §5.1.


**Partly. The artifacts exist; the deployment does not.**

| Component | Status | Location |
|---|---|---|
| Provenance chaincode source | **EXISTS** | `AM/am-provenance` |
| Reputation chaincode source | **EXISTS** | `AM/am-reputation` |
| Built CCAAS packages | **EXIST** | `atomicity_comparison/build/prov.tar.gz`, `rep.tar.gz` |
| Deployment script | **EXISTS** | `atomicity_comparison/harness/deploy_ccaas.sh` |
| Currently committed on `mychannel` | **NO** | only `unified` v1.0 seq 1 |
| Study-era channel state | prov v1.0 + rep v1.0 + unified v1.0, all seq 1 | per `FINAL_SUMMARY.md` pre-flight |

The single-host network was torn down and rebuilt during Phase 8 with only the
unified chaincode. Restoring the two-chaincode arm means re-running
`deploy_ccaas.sh` for prov and rep — scripted, not a rebuild.

**Caveat that must not be glossed:** `prov.tar.gz` and `rep.tar.gz` are the
**June binaries**. Re-deploying them reproduces the study-era Design A arm but
does *not* rebuild prov/rep from current source. Whether Design A should be
re-run on its June binaries (reproducing the original comparison) or rebuilt from
current source (a different experiment) is a decision, not a detail.

---

## 5. Time estimate for a 500-trial confirmation, laptop, current binary

Per-trial cost is **measured, not estimated** — derived from the first and last
`.prog` marker timestamps in each original condition directory.

| Condition | Measured s/trial | 500 trials |
|---|---|---|
| A window seq | 1.422 | 11.9 min |
| A window conc | 0.084 | 0.7 min |
| A random seq | 1.914 | 16.0 min |
| A random conc | 0.067 | 0.6 min |
| **B window seq** | **12.289** | **102.4 min** |
| B random seq | 0.469 | 3.9 min |
| B random conc | 0.060 | 0.5 min |
| A MatCert / Print / Delivery | 0.700 / 0.842 / 0.832 | 19.8 min total |
| B MatCert / Print / Delivery | 0.399 / 0.390 / 0.400 | 9.9 min total |
| **Subtotal, Groups 2 + 4** | | **≈ 2 h 46 min** |

Add:
- Group 3 (infrastructure faults, 2 conditions): original ran N=100 in roughly
  2 minutes each; at N=500, **≈ 20 min** including container restart and network
  reconnect settling.
- Group 1 baseline (no faults, N=500 × 2 arms): **≈ 10 min**.
- Deploying prov + rep CCAAS and smoke-testing: **≈ 15 min**.

**Total ≈ 3 h 30 min of wall-clock trial time**, single-host laptop, unattended.

### 5.1 One condition dominates, and that is the lever

**B window seq alone is 102 of the 166 minutes** of Group 2+4 trial time. It is
slow because the unified window policy waits for the `UNI_SUBMIT` marker and then
holds open a divergence window before killing. If the confirmation needs to fit a
shorter budget, reducing *that one condition* buys far more than trimming all the
others combined.

### 5.2 Two caveats on the estimate

- These rates were measured at the **June state size**. Phase 8 established that
  single-host *concurrent* throughput halves as state grows (415.8 → 200.4 TPS
  between 7.5k and 37.5k counted keys) while *sequential* throughput moved only
  −6%. Most of these conditions are sequential or kill-dominated, so the estimate
  should hold within tens of percent — but the concurrent conditions
  (`*_conc`) could run slower than the table shows. They are also the cheapest
  conditions, so the absolute effect is small.
- The current ledger is far larger than in June. If the confirmation is run on a
  **fresh** network the rates should match the table more closely, at the cost of
  no longer being on the same ledger as anything else measured.

---

## 6. Statistical note on what 500 trials buys

The published claim is 0/6,900, rule-of-three upper bound **0.0435%**.

A confirmation at 500 trials per Design B condition gives 3,000 Design B trials
(3 Group 2 conditions × 500 + 3 Group 4 conditions × 500). If it returns zero
divergences, the rule-of-three upper bound is **3/3000 = 0.1%** — weaker than the
published bound by a factor of 2.3.

This is the central tension in the decision: **a 500-trial confirmation cannot
reproduce the published bound.** It can only establish that the post-assertion
binary does not show divergence at a coarser resolution. To match 0.0435% you
need the full 6,900, which by §5's rates is roughly **8 hours** of trial time
(dominated by B window seq at ~6.8 h for 2,000 trials, as originally measured).

---

## 7. The options, with tradeoffs. I am not choosing.

### Option A — Full re-run on the current binary
Reproduce all 15 conditions plus baseline at original N on the post-assertion
binary.

- **Cost:** ~8–9 h trial time, unattended, plus deployment and analysis. The
  harness exists, so engineering cost is near zero.
- **Gains:** Table 11 becomes a claim about the shipped binary, at the published
  resolution. The pre/post-assertion gap closes completely. The paper's central
  claim rests on data taken with the code that is actually described.
- **Risks:** If the assertion changes Design A's divergence rate, the headline
  contrast (100% vs 0%) could move, and you would be obliged to report it.
  That is a risk of finding something true, not a methodological risk.
- **Also:** requires re-deploying prov/rep. If they are re-deployed from the June
  packages, Design A is study-era code against a post-assertion Design B — an
  asymmetry that would need stating.

### Option B — Reduced confirmation at 500/condition
- **Cost:** ~3.5 h (§5), or ~1.5 h if B window seq is cut to 100–200 trials.
- **Gains:** Detects a gross change from the assertion. Cheap. Leaves the
  published numbers as the headline with a confirmation note.
- **Limits:** Cannot reproduce the 0.0435% bound (§6); best achievable is 0.1%.
  If it returns zero divergences you have consistency, not confirmation at
  strength. If it returns *any* divergence, the published claim is in serious
  trouble and you are into Option A anyway.

### Option C — Disclose, run nothing
State in the manuscript that Table 11 was produced on 2026-06-23 against a
pre-assertion build, name the commit, and cite the surviving harness and raw
per-trial data.

- **Cost:** zero runtime.
- **Gains:** Honest, and better supported than the brief assumed — the harness
  and 2,001-file-per-condition raw evidence **do** exist and can be cited or
  archived, so this is *not* "a harness no longer present in the repository".
  The disclosure is narrow: a binary-version gap, not missing provenance.
- **Risks:** A reviewer who notices that the assertion postdates the study may
  ask exactly the question §3 raises. Having the harness available makes that
  question cheap for them to press and cheap for you to answer — but only if you
  then run it.

### A fourth option the brief did not list
**Option D — targeted assertion-impact test.** Run only the conditions where the
assertion could plausibly matter: the Design A window conditions (where the
provenance write must commit for divergence to occur) at N=500, plus Design B
window seq at reduced N. Roughly **30–45 min**. This does not confirm Table 11,
but it directly tests §3's specific worry — whether the assertion changes the
rate of entering the divergence window — and would tell you whether Option A is
necessary or Option C is safe.

---

## 8. What I would want to know before deciding, stated as questions not answers

1. Is the manuscript's Table 11 claim about *the design* or about *the shipped
   binary*? If the former, Option C's disclosure is close to sufficient. If the
   latter, only Option A closes the gap.
2. Is the 0.0435% bound load-bearing in the argument, or is "zero divergences
   across thousands of fault-injected trials" enough? §6 says a reduced run
   cannot preserve the number.
3. Would you accept Design A on June binaries against Design B on current
   binaries, with that asymmetry disclosed? If not, prov/rep need rebuilding from
   current source, which is a larger job than anything in §5.

---

## 9. Corrections this assessment forces on earlier reports

1. **Gate 0 §1.5 "It does not exist"** is wrong as generalised. The harness
   exists at `~/atomicity_comparison/harness/`, outside the searched repo. To be
   corrected in Phase 9 with the §8.4/8.5 corrections.
2. **The Phase 10 brief inherited that error** and framed the decision around
   rebuilding. No rebuilding is required.
3. **"Table 11 has no reproducible harness"** is false. It has a harness, a
   pre-specified matrix, per-condition CIs, and raw per-trial markers on disk.

---

## 10. Summary of facts, no recommendation

- The harness **exists** and implements all five required mechanisms.
- The 6,900 figure decomposes exactly: 6,000 (Group 2) + 900 (Group 4).
- Raw per-trial data **survives**: 2,001 files per 2,000-trial condition.
- The assertion (`9a9db0e`) postdates the study by **41 days**. The gap is real.
- Design A is **not currently deployed**; packages and a deploy script exist.
- A 500/condition confirmation costs **≈ 3 h 30 min**, one condition being 102
  min of it.
- A 500/condition confirmation **cannot** reproduce the published 0.0435% bound;
  it reaches 0.1%.
- A full re-run costs **≈ 8–9 h** of unattended trial time.

**The decision is yours. I have not taken it, and no runs were performed.**
