# Unified Blockchain Provenance & Reputation System for Additive Manufacturing

A Hyperledger Fabric v3.1.0 implementation combining **provenance tracking** and **Bayesian reputation scoring** for additive manufacturing supply chains in a single atomic smart-contract system.

## Overview

Traditional blockchain supply-chain solutions address provenance *or* reputation — never both in one deployable system. This framework integrates three smart contracts in a single Go chaincode:

| Contract | Responsibility |
|---|---|
| `ProvenanceContract` | Lightweight AM lifecycle event recording with off-chain SHA-256 artefact integrity |
| `ReputationContract` | Multi-dimensional Bayesian (Beta distribution) reputation engine with stake-based incentives |
| `IntegrationContract` | Automated provenance-to-reputation bridge — converts verified events into trust signals atomically |

## Key Features

- **Atomic provenance + reputation** — one Fabric transaction records a lifecycle event *and* updates the Bayesian reputation accumulator
- **Reputation gates** — block actors below a trust threshold from participating in critical lifecycle steps
- **Five reputation dimensions** — quality, delivery, compliance, warranty, sustainability
- **Wilson confidence intervals** — uncertainty quantification on every score
- **Temporal decay** — exponential time-decay toward an uninformative prior (λ = 0.98/day)
- **Stake-backed ratings** — economic skin-in-the-game deters dishonest ratings; slash mechanism penalises bad actors
- **Lightweight on-chain footprint** — ~337 B per provenance event; bulk artefacts stored off-chain (S3/MinIO) with SHA-256 binding

## Repository Structure

```
am-unified/
├── chaincode/
│   └── unified/               # Go chaincode (Fabric v3.1.0, CCAAS)
│       ├── main.go            # Registers all 3 contracts
│       ├── types.go           # All data structures
│       ├── helpers.go         # Shared helpers (identity, math, state)
│       ├── provenance_contract.go
│       ├── reputation_contract.go
│       ├── integration_contract.go
│       ├── Dockerfile         # CCAAS container image
│       ├── go.mod / go.sum
│       └── vendor/            # Vendored Go dependencies
├── client-tests/
│   ├── performance_test.js    # 9 performance benchmarks
│   └── security_test.js       # 9 adversarial attack scenarios
├── scripts/
│   ├── deploy.sh              # Full CCAAS deployment pipeline
│   └── enroll_users.sh        # fabric-ca-client identity provisioning
└── results/
    ├── performance/           # Benchmark output (JSON + CSV)
    └── security/              # Security test output (JSON + TXT)
```

## Performance Results (Fabric v3.1.0, LevelDB, BatchTimeout=10 ms)

| Metric | Result |
|---|---|
| Provenance write latency (P50 / P95) | 48.7 ms / 54.9 ms |
| Reputation write latency (P50 / P95) | 50.8 ms / 59.0 ms |
| Integrated atomic write (P50 / P95) | 53.5 ms / 61.6 ms |
| Read latency `GetPartTrustReport` (P50) | 5.4 ms |
| Concurrent provenance TPS | 280.8 |
| Concurrent reputation TPS | 303.6 |
| Concurrent integrated TPS | 299.7 |

## Security Validation (9 attack vectors)

| Category | Fully Blocked | Partially Mitigated |
|---|---|---|
| Identity (self-rating, Sybil) | 1 / 2 | 1 / 2 |
| Access control (unauth. admin, gate) | 2 / 2 | 0 / 2 |
| Economic (insufficient stake) | 1 / 1 | 0 / 1 |
| Integrity (replay, tampering) | 1 / 2 | 1 / 2 |
| Manipulation (collusion) | 0 / 1 | 1 / 1 |
| **Total** | **6 / 9 (67%)** | **3 / 9 (33%)** |

Zero attacks fully succeeded.

## Deployment

### Prerequisites
- Docker + Docker Compose
- Go 1.21+
- Node.js 18+
- Hyperledger Fabric v3.1.0 binaries (`fabric-samples/bin` on PATH)

### Quick Start

```bash
# 1. Start the Fabric test network
cd ~/fabric-samples/test-network
./network.sh up createChannel -c mychannel -ca

# 2. Build and deploy chaincode (CCAAS)
cd ~/am-unified
bash scripts/deploy.sh

# 3. Enroll test identities
bash scripts/enroll_users.sh

# 4. Install client dependencies
cd client-tests && npm install

# 5. Run performance benchmarks
node performance_test.js

# 6. Run security validation
node security_test.js
```

Results are written to `results/performance/` and `results/security/`.

## Calling Convention

Fabric multi-contract calling format: `ContractName:FunctionName`

```bash
# Initialize reputation system
peer chaincode invoke ... -c '{"function":"ReputationContract:InitConfig","Args":[]}'

# Record a provenance event + auto-update reputation atomically
peer chaincode invoke ... -c '{"function":"IntegrationContract:RecordProvenanceWithReputation","Args":[...]}'

# Query full part history with all actor trust scores
peer chaincode query  ... -c '{"function":"IntegrationContract:GetPartTrustReport","Args":["PART-001"]}'
```

## Deployment Note: CCAAS

Standard Go chaincode lifecycle deployment (`peer lifecycle chaincode package --lang golang`) failed in the test environment due to Docker socket write errors during peer-side image builds. The chaincode is deployed via **Chaincode-as-a-Service (CCAAS)**: the pre-compiled static binary runs as an independent Docker container on the `fabric_test` network; peers connect to it via gRPC at `{{.peername}}_unified_ccaas:9999`.

## Related Work

This repository unifies two prior systems:
- `am-provenance` — standalone provenance chaincode
- `am-reputation` — standalone reputation chaincode
