#!/bin/bash
# ==============================================================================
# deploy.sh – Build and deploy the unified AM chaincode via CCAAS
# ==============================================================================
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Configuration ──────────────────────────────────────────────────────────────
CHAINCODE_NAME="unified"
CHANNEL_NAME="mychannel"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE="1"
CCAAS_PORT=9999
TEST_NETWORK_PATH=~/AM/fabric-samples/test-network
PROJECT_DIR=~/am-unified
BUILD_DIR="${PROJECT_DIR}/build"

export PATH=~/AM/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=~/AM/fabric-samples/config/

ORDERER_CA="${TEST_NETWORK_PATH}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

ORG1_MSP="${TEST_NETWORK_PATH}/organizations/peerOrganizations/org1.example.com"
ORG1_TLS_CA="${ORG1_MSP}/peers/peer0.org1.example.com/tls/ca.crt"
ORG1_ADMIN_MSP="${ORG1_MSP}/users/Admin@org1.example.com/msp"

ORG2_MSP="${TEST_NETWORK_PATH}/organizations/peerOrganizations/org2.example.com"
ORG2_TLS_CA="${ORG2_MSP}/peers/peer0.org2.example.com/tls/ca.crt"
ORG2_ADMIN_MSP="${ORG2_MSP}/users/Admin@org2.example.com/msp"

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Deploying Unified AM Chaincode (CCAAS)${NC}"
echo -e "${GREEN}================================================${NC}"

# ── Step 0: Pre-checks ─────────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Pre-checks...${NC}"
for cmd in peer go docker; do
    if ! command -v $cmd &>/dev/null; then
        echo -e "${RED}ERROR: '$cmd' not found${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ Pre-checks passed${NC}"

# ── Step 1: Build static Go binary ──────────────────────────────────────────────
echo -e "\n${YELLOW}==> Building static binary...${NC}"
mkdir -p "${BUILD_DIR}"
cd "${PROJECT_DIR}/chaincode/unified"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o "${BUILD_DIR}/unified_ccaas" .
BINSIZE=$(ls -lh "${BUILD_DIR}/unified_ccaas" | awk '{print $5}')
echo -e "${GREEN}✅ Built ${BUILD_DIR}/unified_ccaas (${BINSIZE})${NC}"

# ── Step 2: Build Docker image ───────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Building Docker image...${NC}"
cat > "${BUILD_DIR}/Dockerfile" <<'DOCKERFILE'
FROM alpine:3.19
RUN addgroup -S cc && adduser -S cc -G cc
COPY unified_ccaas /chaincode/unified_ccaas
RUN chmod +x /chaincode/unified_ccaas
USER cc
EXPOSE 9999
CMD ["/chaincode/unified_ccaas"]
DOCKERFILE

docker build -t unified_ccaas_image:latest "${BUILD_DIR}"
echo -e "${GREEN}✅ Docker image built${NC}"

# ── Step 3: Create CCAAS package ─────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Creating CCAAS package...${NC}"
CCAAS_PKG_DIR=$(mktemp -d)

# metadata.json — type must NOT be "golang"
cat > "${CCAAS_PKG_DIR}/metadata.json" <<EOF
{"path":"","type":"ccaas","label":"${CHAINCODE_NAME}_${CHAINCODE_VERSION}"}
EOF

# connection.json for each peer (template variable resolved by ccaas_builder)
mkdir -p "${CCAAS_PKG_DIR}/code"
cat > "${CCAAS_PKG_DIR}/code/connection.json" <<EOF
{"address":"{{.peername}}_${CHAINCODE_NAME}_ccaas:${CCAAS_PORT}","dial_timeout":"10s","tls_required":false}
EOF

# Inner tar: code.tar.gz containing connection.json
tar czf "${CCAAS_PKG_DIR}/code.tar.gz" -C "${CCAAS_PKG_DIR}/code" connection.json

# Outer tar: the installable package
tar czf "${PROJECT_DIR}/${CHAINCODE_NAME}.tar.gz" -C "${CCAAS_PKG_DIR}" metadata.json code.tar.gz

rm -rf "${CCAAS_PKG_DIR}"
echo -e "${GREEN}✅ CCAAS package created${NC}"
ls -lh "${PROJECT_DIR}/${CHAINCODE_NAME}.tar.gz"

# ── Step 4: Install on Org1 ──────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Installing on Org1...${NC}"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_CA}"
export CORE_PEER_MSPCONFIGPATH="${ORG1_ADMIN_MSP}"
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode install "${PROJECT_DIR}/${CHAINCODE_NAME}.tar.gz"
echo -e "${GREEN}✅ Installed on Org1${NC}"

# ── Step 5: Install on Org2 ──────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Installing on Org2...${NC}"
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG2_TLS_CA}"
export CORE_PEER_MSPCONFIGPATH="${ORG2_ADMIN_MSP}"
export CORE_PEER_ADDRESS=localhost:9051

peer lifecycle chaincode install "${PROJECT_DIR}/${CHAINCODE_NAME}.tar.gz"
echo -e "${GREEN}✅ Installed on Org2${NC}"

# ── Step 6: Get Package ID ───────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Resolving package ID...${NC}"
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_CA}"
export CORE_PEER_MSPCONFIGPATH="${ORG1_ADMIN_MSP}"
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode queryinstalled > /tmp/queryinstalled.txt
cat /tmp/queryinstalled.txt

PACKAGE_ID=$(sed -n "/${CHAINCODE_NAME}_${CHAINCODE_VERSION}/{s/^Package ID: //; s/, Label:.*$//; p;}" /tmp/queryinstalled.txt)
if [ -z "${PACKAGE_ID}" ]; then
    echo -e "${RED}ERROR: Could not determine Package ID${NC}"
    exit 1
fi
echo -e "${GREEN}Package ID: ${PACKAGE_ID}${NC}"

# ── Step 7: Start CCAAS containers ──────────────────────────────────────────────
echo -e "\n${YELLOW}==> Starting CCAAS containers...${NC}"
for peer in peer0org1 peer0org2; do
    CONTAINER="${peer}_${CHAINCODE_NAME}_ccaas"
    docker rm -f "${CONTAINER}" 2>/dev/null || true
    docker run -d \
        --name "${CONTAINER}" \
        --network fabric_test \
        -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:${CCAAS_PORT} \
        -e CORE_CHAINCODE_ID_NAME="${PACKAGE_ID}" \
        unified_ccaas_image:latest
    echo -e "${GREEN}  ✅ ${CONTAINER} started${NC}"
done
sleep 2

# ── Step 8: Approve for Org1 ─────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Approving for Org1...${NC}"
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_CA}"
export CORE_PEER_MSPCONFIGPATH="${ORG1_ADMIN_MSP}"
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode approveformyorg \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --package-id "${PACKAGE_ID}" \
    --sequence "${CHAINCODE_SEQUENCE}" \
    --tls \
    --cafile "${ORDERER_CA}"
echo -e "${GREEN}✅ Approved for Org1${NC}"

# ── Step 9: Approve for Org2 ─────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Approving for Org2...${NC}"
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG2_TLS_CA}"
export CORE_PEER_MSPCONFIGPATH="${ORG2_ADMIN_MSP}"
export CORE_PEER_ADDRESS=localhost:9051

peer lifecycle chaincode approveformyorg \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --package-id "${PACKAGE_ID}" \
    --sequence "${CHAINCODE_SEQUENCE}" \
    --tls \
    --cafile "${ORDERER_CA}"
echo -e "${GREEN}✅ Approved for Org2${NC}"

# ── Step 10: Commit ──────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Committing chaincode to channel...${NC}"
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_CA}"
export CORE_PEER_MSPCONFIGPATH="${ORG1_ADMIN_MSP}"
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode commit \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --sequence "${CHAINCODE_SEQUENCE}" \
    --tls \
    --cafile "${ORDERER_CA}" \
    --peerAddresses localhost:7051 \
    --tlsRootCertFiles "${ORG1_TLS_CA}" \
    --peerAddresses localhost:9051 \
    --tlsRootCertFiles "${ORG2_TLS_CA}"
echo -e "${GREEN}✅ Chaincode committed${NC}"

# ── Step 11: Verify ──────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Verifying deployment...${NC}"
peer lifecycle chaincode querycommitted \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}"

# ── Step 12: Smoke test ──────────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Smoke test: initialising reputation config...${NC}"
sleep 3

peer chaincode invoke \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --tls \
    --cafile "${ORDERER_CA}" \
    -C "${CHANNEL_NAME}" \
    -n "${CHAINCODE_NAME}" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "${ORG1_TLS_CA}" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "${ORG2_TLS_CA}" \
    -c '{"function":"ReputationContract:InitConfig","Args":[]}'

sleep 3

echo -e "\n${YELLOW}==> Smoke test: creating material certification...${NC}"
peer chaincode invoke \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --tls \
    --cafile "${ORDERER_CA}" \
    -C "${CHANNEL_NAME}" \
    -n "${CHAINCODE_NAME}" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "${ORG1_TLS_CA}" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "${ORG2_TLS_CA}" \
    -c '{"function":"ProvenanceContract:CreateMaterialCertification","Args":["PART-SMOKE-001","Ti-6Al-4V","MAT-BATCH-001","SupplierAlpha","sha256:abc123def456"]}'

sleep 2

echo -e "\n${YELLOW}==> Querying smoke test asset...${NC}"
peer chaincode query \
    -C "${CHANNEL_NAME}" \
    -n "${CHAINCODE_NAME}" \
    -c '{"function":"ProvenanceContract:ReadAsset","Args":["PART-SMOKE-001"]}'

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  CCAAS Deployment complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "CCAAS containers: peer0org1_unified_ccaas, peer0org2_unified_ccaas"
echo "Package ID: ${PACKAGE_ID}"
