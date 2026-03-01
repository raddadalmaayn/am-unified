#!/bin/bash
# ==============================================================================
# deploy.sh – Package and deploy the unified AM chaincode to the test network
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
TEST_NETWORK_PATH=~/fabric-samples/test-network
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Add Fabric binaries to PATH
export PATH=~/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=~/fabric-samples/config/

# Orderer CA
ORDERER_CA="${TEST_NETWORK_PATH}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

# Org1 environment
ORG1_MSP="${TEST_NETWORK_PATH}/organizations/peerOrganizations/org1.example.com"
ORG1_TLS_CA="${ORG1_MSP}/peers/peer0.org1.example.com/tls/ca.crt"
ORG1_ADMIN_MSP="${ORG1_MSP}/users/Admin@org1.example.com/msp"

# Org2 environment
ORG2_MSP="${TEST_NETWORK_PATH}/organizations/peerOrganizations/org2.example.com"
ORG2_TLS_CA="${ORG2_MSP}/peers/peer0.org2.example.com/tls/ca.crt"
ORG2_ADMIN_MSP="${ORG2_MSP}/users/Admin@org2.example.com/msp"

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Deploying Unified AM Chaincode: ${CHAINCODE_NAME}${NC}"
echo -e "${GREEN}================================================${NC}"

# ── Step 0: Pre-checks ─────────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Pre-checks...${NC}"
if ! peer version &>/dev/null; then
    echo -e "${RED}ERROR: 'peer' command not found. Add fabric-samples/bin to PATH.${NC}"
    exit 1
fi

if [ ! -f "${TEST_NETWORK_PATH}/network.sh" ]; then
    echo -e "${RED}ERROR: Test network not found at ${TEST_NETWORK_PATH}${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Pre-checks passed${NC}"

# ── Step 1: Build/verify Go code compiles ─────────────────────────────────────
echo -e "\n${YELLOW}==> Verifying Go source compiles...${NC}"
cd "${PROJECT_DIR}/chaincode"
go build -v ./unified/... 2>&1 | tail -5
echo -e "${GREEN}✅ Go source compiles successfully${NC}"
cd "${PROJECT_DIR}"

# ── Step 2: Package the chaincode ─────────────────────────────────────────────
echo -e "\n${YELLOW}==> Packaging chaincode...${NC}"
cd "${TEST_NETWORK_PATH}"
peer lifecycle chaincode package "${PROJECT_DIR}/${CHAINCODE_NAME}.tar.gz" \
    --path "${PROJECT_DIR}/chaincode/unified" \
    --lang golang \
    --label "${CHAINCODE_NAME}_${CHAINCODE_VERSION}" \
    --connTimeout 10s
echo -e "${GREEN}✅ Packaged → ${CHAINCODE_NAME}.tar.gz${NC}"
ls -lh "${PROJECT_DIR}/${CHAINCODE_NAME}.tar.gz"

# ── Step 3: Install on Org1 ───────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Installing on Org1...${NC}"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_CA}"
export CORE_PEER_MSPCONFIGPATH="${ORG1_ADMIN_MSP}"
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode install "${PROJECT_DIR}/${CHAINCODE_NAME}.tar.gz"
echo -e "${GREEN}✅ Installed on Org1${NC}"

# ── Step 4: Install on Org2 ───────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Installing on Org2...${NC}"
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG2_TLS_CA}"
export CORE_PEER_MSPCONFIGPATH="${ORG2_ADMIN_MSP}"
export CORE_PEER_ADDRESS=localhost:9051

peer lifecycle chaincode install "${PROJECT_DIR}/${CHAINCODE_NAME}.tar.gz"
echo -e "${GREEN}✅ Installed on Org2${NC}"

# ── Step 5: Get Package ID ────────────────────────────────────────────────────
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

# ── Step 6: Approve for Org1 ──────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Approving for Org1...${NC}"
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

# ── Step 7: Approve for Org2 ──────────────────────────────────────────────────
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

# ── Step 8: Commit ────────────────────────────────────────────────────────────
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

# ── Step 9: Verify ────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}==> Verifying deployment...${NC}"
peer lifecycle chaincode querycommitted \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}"

# ── Step 10: Smoke test – init reputation config ───────────────────────────────
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
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Enroll test users: ./scripts/enroll_users.sh"
echo "  2. Run performance tests: node client-tests/performance_test.js"
echo "  3. Run security tests: node client-tests/security_test.js"
