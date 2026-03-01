#!/bin/bash
# ==============================================================================
# enroll_users.sh – Register and enrol all test identities via fabric-ca-client.
# Users: Admin (re-enrol), buyer1, tps_user_1–30
# ==============================================================================
set -e

export PATH=/home/raddad/fabric-samples/bin:$PATH

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

TEST_NETWORK_PATH="/home/raddad/fabric-samples/test-network"
CA_ADMIN_USER="admin"
CA_ADMIN_PASS="adminpw"
CA_URL="localhost:7054"
ORG_AFFILIATION="org1.department1"

export FABRIC_CA_CLIENT_HOME="${TEST_NETWORK_PATH}/organizations/peerOrganizations/org1.example.com"
CA_TLS_CERT="${TEST_NETWORK_PATH}/organizations/fabric-ca/org1/tls-cert.pem"

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Enrolling Test Users for Unified AM System${NC}"
echo -e "${GREEN}================================================${NC}"

if ! fabric-ca-client version &>/dev/null; then
    echo -e "${RED}ERROR: fabric-ca-client not found${NC}"; exit 1
fi

enroll_user() {
    local name="$1" pass="$2"
    fabric-ca-client register \
        --id.name "${name}" --id.secret "${pass}" \
        --id.type client --id.affiliation "${ORG_AFFILIATION}" \
        -u "https://${CA_ADMIN_USER}:${CA_ADMIN_PASS}@${CA_URL}" \
        --tls.certfiles "${CA_TLS_CERT}" 2>&1 | grep -v "^20" | grep -E "(Error|already|registered)" | head -1 || true
    fabric-ca-client enroll \
        -u "https://${name}:${pass}@${CA_URL}" \
        --caname ca-org1 \
        -M "${FABRIC_CA_CLIENT_HOME}/users/${name}@org1.example.com/msp" \
        --tls.certfiles "${CA_TLS_CERT}" >/dev/null 2>&1
    echo -e "  ${GREEN}✓${NC} ${name}"
}

echo -e "\n${YELLOW}==> Re-enrolling Admin...${NC}"
fabric-ca-client enroll \
    -u "https://admin:adminpw@${CA_URL}" \
    --caname ca-org1 \
    -M "${FABRIC_CA_CLIENT_HOME}/users/Admin@org1.example.com/msp" \
    --tls.certfiles "${CA_TLS_CERT}" >/dev/null 2>&1
echo -e "  ${GREEN}✓${NC} Admin"

echo -e "\n${YELLOW}==> Enrolling buyer1...${NC}"
enroll_user "buyer1" "buyer1pw"

echo -e "\n${YELLOW}==> Enrolling tps_user_1 through tps_user_30...${NC}"
for i in $(seq 1 30); do
    enroll_user "tps_user_${i}" "tps_user_pw_${i}"
done

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  All identities enrolled successfully.${NC}"
echo -e "${GREEN}  Ready to run: node client-tests/performance_test.js${NC}"
echo -e "${GREEN}================================================${NC}"
