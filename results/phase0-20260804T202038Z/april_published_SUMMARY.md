# Geo-Distributed Benchmark — Publication-Grade Results (Fix Phase 2)

**Date:** 2026-04-20  
**Testbed:** 4-org LAN (D1=Manufacturer+SDK, D2=Supplier, D3=Logistics, D4=Regulator+Orderer)  
**Channel:** amchannel  
**Sample sizes:** Sequential n=500 per type × 3 runs = 1500 total; Concurrent n=2000, c=20 × 3 runs = 6000 total  
**Chaincode fix:** 22 state-writing `time.Now().Unix()` calls replaced with deterministic `GetTxTimestamp().GetSeconds()`  
**Binary deployed:** MD5 `61df001722b0beb0ad27cfc31614a432` — verified identical on all 4 nodes  

---

## Failure Rates (3 back-to-back runs)

| Test                                | Run 1 | Run 2 | Run 3 | Total fails/n | Rate | 95% CI upper |
|-------------------------------------|-------|-------|-------|---------------|------|--------------|
| provenance_sequential               | 0/500 | 0/500 | 0/500 | 0/1500 | 0.00% | < 0.200% |
| reputation_sequential               | 0/500 | 0/500 | 0/500 | 0/1500 | 0.00% | < 0.200% |
| bridge_sequential                   | 0/500 | 0/500 | 0/500 | 0/1500 | 0.00% | < 0.200% |
| read_latency                        | 0/500 | 0/500 | 0/500 | 0/1500 | 0.00% | < 0.200% |
| cross_org_endorsement               | 0/50 | 0/50 | 0/50 | 0/150 | 0.00% | < 2.000% |
| concurrent_provenance               | 0/2000 | 0/2000 | 0/2000 | 0/6000 | 0.00% | < 0.050% |
| concurrent_reputation               | 0/2000 | 0/2000 | 0/2000 | 0/6000 | 0.00% | < 0.050% |
| concurrent_bridge                   | 0/2000 | 0/2000 | 0/2000 | 0/6000 | 0.00% | < 0.050% |
| high_contention_reputation          | 1900/2000 | 1900/2000 | 1900/2000 | 5700/6000 | 95.00% | — |

## Sequential Latency — Median across 3 runs

| Test                                | Mean | P50 | P95 | P99 |
|-------------------------------------|------|-----|-----|-----|
| provenance_sequential               | 370ms | 355ms | 468ms | 935ms |
| reputation_sequential               | 376ms | 357ms | 478ms | 989ms |
| bridge_sequential                   | 383ms | 367ms | 481ms | 802ms |
| read_latency                        | 5ms | 5ms | 6ms | 8ms |
| cross_org_endorsement               | 346ms | 345ms | 401ms | 501ms |

## Concurrent Throughput — Median TPS across 3 runs

| Test                                | Run 1 TPS | Run 2 TPS | Run 3 TPS | Median TPS | MVCC% |
|-------------------------------------|-----------|-----------|-----------|------------|-------|
| concurrent_provenance               |     30.69 |     28.91 |     29.95 |      29.95 | 0.0% |
| concurrent_reputation               |     29.81 |     29.90 |     30.03 |      29.90 | 0.0% |
| concurrent_bridge                   |     29.20 |     29.35 |     29.98 |      29.35 | 0.0% |
| high_contention_reputation          |      1.51 |      1.51 |      1.53 |       1.51 | 95.0% |

## Before vs. After Fix

| Test                                     | Before | After | Δ |
|------------------------------------------|--------|-------|---|
| reputation_sequential failure rate       | 1.2% | 0.00% | −100% |
| bridge_sequential failure rate           | 2.4% | 0.00% | −100% |
| concurrent_reputation failure rate       | 1.6% | 0.00% | −100% |
| concurrent_bridge failure rate           | 2.5% | 0.00% | −100% |

## Endorsement Mismatch Evidence

Peer logs grepped for `mismatch`, `rwset.*diff` patterns at end of each run.
Cumulative counts reflect peer lifetime (not just this session).
Increments per run = 1900 lines — exclusively from `high_contention_reputation` MVCC conflicts (expected).

**Run 1:**
    D1 (peer0.org1.example.com): mismatch_lines=5115
    D2 (peer0.org2.example.com): mismatch_lines=6729
    D3 (peer0.org3.example.com): mismatch_lines=6729
    D4 (peer0.org4.example.com): mismatch_lines=6737
**Run 2:**
    D1 (peer0.org1.example.com): mismatch_lines=5115
    D2 (peer0.org2.example.com): mismatch_lines=8629
    D3 (peer0.org3.example.com): mismatch_lines=8629
    D4 (peer0.org4.example.com): mismatch_lines=8637
**Run 3:**
    D1 (peer0.org1.example.com): mismatch_lines=5115
    D2 (peer0.org2.example.com): mismatch_lines=10529
    D3 (peer0.org3.example.com): mismatch_lines=10529
    D4 (peer0.org4.example.com): mismatch_lines=10537

*Zero new endorsement-mismatch entries from reputation_sequential, bridge_sequential, concurrent_reputation, or concurrent_bridge across all 3 runs.*

---

## Exit Criteria

- ✅ PASS **reputation_sequential**: 0/1500 failures — 95% CI upper < 0.200%
- ✅ PASS **bridge_sequential**: 0/1500 failures — 95% CI upper < 0.200%
- ✅ PASS **concurrent_provenance**: 0/6000 failures — 95% CI upper < 0.050%
- ✅ PASS **concurrent_reputation**: 0/6000 failures — 95% CI upper < 0.050%
- ✅ PASS **concurrent_bridge**: 0/6000 failures — 95% CI upper < 0.050%

### ✅ ALL EXIT CRITERIA MET — results are publication-ready

---
*Session directory:* `~/am-unified/results/fix2-20260420-161332/`  
*Raw JSON results:* `run1/results.json`, `run2/results.json`, `run3/results.json`
