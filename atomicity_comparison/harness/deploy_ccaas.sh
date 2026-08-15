#!/bin/bash
# Parametrized CCAAS deploy for ONE standalone chaincode, alongside `unified`.
# Replicates ~/am-unified/scripts/deploy.sh. Does NOT touch the unified chaincode.
# Usage: deploy_ccaas.sh <NAME> <PORT> <SRC_DIR> <SEQUENCE>
set -e
NAME="$1"; PORT="$2"; SRC="$3"; SEQ="${4:-1}"; VER="1.0"
CH="mychannel"
TN=~/AM/fabric-samples/test-network
export PATH=~/AM/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=~/AM/fabric-samples/config/
ORDERER_CA="${TN}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
O1="${TN}/organizations/peerOrganizations/org1.example.com"; O1CA="${O1}/peers/peer0.org1.example.com/tls/ca.crt"; O1ADM="${O1}/users/Admin@org1.example.com/msp"
O2="${TN}/organizations/peerOrganizations/org2.example.com"; O2CA="${O2}/peers/peer0.org2.example.com/tls/ca.crt"; O2ADM="${O2}/users/Admin@org2.example.com/msp"
BUILD=~/atomicity_comparison/build/${NAME}; mkdir -p "$BUILD"

echo "### [$NAME] Step1: build static binary from $SRC"
cd "$SRC"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=vendor -o "${BUILD}/${NAME}_ccaas" .
ls -lh "${BUILD}/${NAME}_ccaas"

echo "### [$NAME] Step2: docker image ${NAME}_ccaas_image"
cat > "${BUILD}/Dockerfile" <<DOCKERFILE
FROM alpine:3.19
RUN apk add --no-cache libc6-compat
WORKDIR /chaincode
COPY ${NAME}_ccaas .
RUN chmod +x ${NAME}_ccaas
EXPOSE ${PORT}
CMD ["./${NAME}_ccaas"]
DOCKERFILE
docker build -t ${NAME}_ccaas_image:latest "${BUILD}" >/dev/null
echo "image built"

echo "### [$NAME] Step3: CCAAS package"
PKG=$(mktemp -d)
echo "{\"path\":\"\",\"type\":\"ccaas\",\"label\":\"${NAME}_${VER}\"}" > "${PKG}/metadata.json"
mkdir -p "${PKG}/code"
echo "{\"address\":\"{{.peername}}_${NAME}_ccaas:${PORT}\",\"dial_timeout\":\"10s\",\"tls_required\":false}" > "${PKG}/code/connection.json"
tar czf "${PKG}/code.tar.gz" -C "${PKG}/code" connection.json
PKGFILE=~/atomicity_comparison/build/${NAME}.tar.gz
tar czf "${PKGFILE}" -C "${PKG}" metadata.json code.tar.gz
rm -rf "${PKG}"; ls -lh "${PKGFILE}"

install_on(){ export CORE_PEER_TLS_ENABLED=true CORE_PEER_LOCALMSPID="$1" CORE_PEER_TLS_ROOTCERT_FILE="$2" CORE_PEER_MSPCONFIGPATH="$3" CORE_PEER_ADDRESS="$4"; peer lifecycle chaincode install "${PKGFILE}"; }
echo "### [$NAME] Step4: install on Org1"; install_on Org1MSP "$O1CA" "$O1ADM" localhost:7051
echo "### [$NAME] Step5: install on Org2"; install_on Org2MSP "$O2CA" "$O2ADM" localhost:9051

echo "### [$NAME] Step6: resolve package id"
export CORE_PEER_LOCALMSPID=Org1MSP CORE_PEER_TLS_ROOTCERT_FILE="$O1CA" CORE_PEER_MSPCONFIGPATH="$O1ADM" CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode queryinstalled > /tmp/qi_${NAME}.txt
PID=$(sed -n "/${NAME}_${VER}/{s/^Package ID: //; s/, Label:.*$//; p;}" /tmp/qi_${NAME}.txt | head -1)
echo "PACKAGE_ID=$PID"
[ -z "$PID" ] && { echo "ERR_NO_PACKAGE_ID"; exit 11; }

echo "### [$NAME] Step7: start CCAAS containers"
for peer in peer0org1 peer0org2; do
  C="${peer}_${NAME}_ccaas"; docker rm -f "$C" 2>/dev/null || true
  docker run -d --name "$C" --network fabric_test \
    -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:${PORT} \
    -e CORE_CHAINCODE_ID_NAME="${PID}" \
    ${NAME}_ccaas_image:latest >/dev/null
  echo "  started $C"
done
sleep 3

approve_on(){ export CORE_PEER_LOCALMSPID="$1" CORE_PEER_TLS_ROOTCERT_FILE="$2" CORE_PEER_MSPCONFIGPATH="$3" CORE_PEER_ADDRESS="$4";
 peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
   --channelID "$CH" --name "$NAME" --version "$VER" --package-id "$PID" --sequence "$SEQ" --tls --cafile "$ORDERER_CA"; }
echo "### [$NAME] Step8: approve Org1"; approve_on Org1MSP "$O1CA" "$O1ADM" localhost:7051
echo "### [$NAME] Step9: approve Org2"; approve_on Org2MSP "$O2CA" "$O2ADM" localhost:9051

echo "### [$NAME] Step10: commit"
export CORE_PEER_LOCALMSPID=Org1MSP CORE_PEER_TLS_ROOTCERT_FILE="$O1CA" CORE_PEER_MSPCONFIGPATH="$O1ADM" CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --channelID "$CH" --name "$NAME" --version "$VER" --sequence "$SEQ" --tls --cafile "$ORDERER_CA" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$O1CA" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$O2CA"

echo "### [$NAME] Step11: querycommitted"
peer lifecycle chaincode querycommitted --channelID "$CH" --name "$NAME"
echo "### [$NAME] DEPLOY_DONE PID=$PID"
