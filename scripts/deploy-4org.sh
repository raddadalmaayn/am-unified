#!/bin/bash
set -e

# === Configuration ===
SSH_KEY="$HOME/.ssh/id_fabric"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
SCP="scp -i $SSH_KEY -o StrictHostKeyChecking=no"

D1="iot-lab@10.12.11.48"
D2="iot-lab@10.12.10.136"
D3="iot-lab@10.12.10.92"
D4="iot-lab@10.12.10.126"
ALL_DESKTOPS="$D1 $D2 $D3 $D4"

# Laptop-side paths
LAPTOP_NETWORK_DIR="$HOME/am-unified/network"
export PATH=$HOME/fabric-tools/bin:$PATH

# D1 is the control node — has osnadmin, peer, all Admin MSPs
# Crypto base on D1: ~/fabric-network/
D1_FABRIC="~/fabric-network"
D1_PEER_ORGS="$D1_FABRIC/peerOrganizations"
D1_ORDERER_ORGS="$D1_FABRIC/ordererOrganizations"

echo "============================================"
echo "  4-Org Deployment — Optimized (50ms batch)"
echo "  $(date)"
echo "============================================"

# --- Step 1: Stop old containers ---
echo ""
echo "=== Step 1: Cleaning all machines ==="
for host in $ALL_DESKTOPS; do
    echo "Cleaning $host..."
    $SSH $host "sudo docker stop \$(sudo docker ps -aq) 2>/dev/null; \
                sudo docker rm \$(sudo docker ps -aq) 2>/dev/null; \
                sudo rm -rf ~/fabric-network/orderer-data ~/fabric-network/peer0-*-data 2>/dev/null" || true
done

# --- Step 2: Generate genesis block (on laptop) ---
echo ""
echo "=== Step 2: Generating genesis block (50ms BatchTimeout) ==="
cd $LAPTOP_NETWORK_DIR/config
configtxgen -profile FourOrgsApplicationGenesis \
    -outputBlock $LAPTOP_NETWORK_DIR/genesis.block \
    -channelID amchannel
echo "Genesis block: $(ls -la $LAPTOP_NETWORK_DIR/genesis.block)"

# --- Step 3: Distribute genesis block to all machines ---
echo ""
echo "=== Step 3: Distributing genesis block ==="
for host in $ALL_DESKTOPS; do
    $SCP $LAPTOP_NETWORK_DIR/genesis.block $host:~/fabric-network/genesis.block
    echo "  → $host"
done

# --- Step 4: Start Orderer on D4 ---
# Crypto at ~/fabric-network/ordererOrganizations/... (NOT organizations/ordererOrganizations/)
echo ""
echo "=== Step 4: Starting Orderer on D4 ==="
$SSH $D4 'bash -s' << 'ORDERER_CMD'
cd ~/fabric-network
sudo docker run -d --name orderer.example.com \
    --network host \
    -e FABRIC_LOGGING_SPEC=INFO \
    -e ORDERER_GENERAL_LISTENADDRESS=0.0.0.0 \
    -e ORDERER_GENERAL_LISTENPORT=7050 \
    -e ORDERER_GENERAL_LOCALMSPID=OrdererMSP \
    -e ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp \
    -e ORDERER_GENERAL_TLS_ENABLED=true \
    -e ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key \
    -e ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt \
    -e ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt] \
    -e ORDERER_GENERAL_BOOTSTRAPMETHOD=none \
    -e ORDERER_CHANNELPARTICIPATION_ENABLED=true \
    -e ORDERER_ADMIN_TLS_ENABLED=true \
    -e ORDERER_ADMIN_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt \
    -e ORDERER_ADMIN_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key \
    -e ORDERER_ADMIN_TLS_CLIENTROOTCAS=[/var/hyperledger/orderer/tls/ca.crt] \
    -e ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:7053 \
    -v $(pwd)/ordererOrganizations/example.com/orderers/orderer.example.com/msp:/var/hyperledger/orderer/msp \
    -v $(pwd)/ordererOrganizations/example.com/orderers/orderer.example.com/tls:/var/hyperledger/orderer/tls \
    -v $(pwd)/orderer-data:/var/hyperledger/production/orderer \
    hyperledger/fabric-orderer:latest orderer
sleep 5
echo "Orderer status: $(sudo docker inspect -f '{{.State.Status}}' orderer.example.com)"
ORDERER_CMD

# --- Step 5: Start Peers ---
# Crypto at ~/fabric-network/peerOrganizations/... (NOT organizations/peerOrganizations/)
echo ""
echo "=== Step 5: Starting Peers ==="

# Peer Org1 on D1
$SSH $D1 'bash -s' << 'PEER1_CMD'
cd ~/fabric-network
sudo docker run -d --name peer0.org1.example.com --network host \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
    -e FABRIC_LOGGING_SPEC=INFO \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_PROFILE_ENABLED=false \
    -e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
    -e CORE_PEER_ID=peer0.org1.example.com \
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
    -e CORE_PEER_LISTENADDRESS=0.0.0.0:7051 \
    -e CORE_PEER_CHAINCODEADDRESS=peer0.org1.example.com:7052 \
    -e CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052 \
    -e CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org2.example.com:7051 \
    -e CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.example.com:7051 \
    -e CORE_PEER_LOCALMSPID=Org1MSP \
    -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
    -e CORE_OPERATIONS_LISTENADDRESS=0.0.0.0:9444 \
    -v /var/run/docker.sock:/host/var/run/docker.sock \
    -v $(pwd)/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp:/etc/hyperledger/fabric/msp \
    -v $(pwd)/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls:/etc/hyperledger/fabric/tls \
    -v $(pwd)/peer0-org1-data:/var/hyperledger/production \
    hyperledger/fabric-peer:latest peer node start
PEER1_CMD

# Peer Org2 on D2
$SSH $D2 'bash -s' << 'PEER2_CMD'
cd ~/fabric-network
sudo docker run -d --name peer0.org2.example.com --network host \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
    -e FABRIC_LOGGING_SPEC=INFO \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_PROFILE_ENABLED=false \
    -e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
    -e CORE_PEER_ID=peer0.org2.example.com \
    -e CORE_PEER_ADDRESS=peer0.org2.example.com:7051 \
    -e CORE_PEER_LISTENADDRESS=0.0.0.0:7051 \
    -e CORE_PEER_CHAINCODEADDRESS=peer0.org2.example.com:7052 \
    -e CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052 \
    -e CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.example.com:7051 \
    -e CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org2.example.com:7051 \
    -e CORE_PEER_LOCALMSPID=Org2MSP \
    -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
    -e CORE_OPERATIONS_LISTENADDRESS=0.0.0.0:9444 \
    -v /var/run/docker.sock:/host/var/run/docker.sock \
    -v $(pwd)/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/msp:/etc/hyperledger/fabric/msp \
    -v $(pwd)/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls:/etc/hyperledger/fabric/tls \
    -v $(pwd)/peer0-org2-data:/var/hyperledger/production \
    hyperledger/fabric-peer:latest peer node start
PEER2_CMD

# Peer Org3 on D3
$SSH $D3 'bash -s' << 'PEER3_CMD'
cd ~/fabric-network
sudo docker run -d --name peer0.org3.example.com --network host \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
    -e FABRIC_LOGGING_SPEC=INFO \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_PROFILE_ENABLED=false \
    -e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
    -e CORE_PEER_ID=peer0.org3.example.com \
    -e CORE_PEER_ADDRESS=peer0.org3.example.com:7051 \
    -e CORE_PEER_LISTENADDRESS=0.0.0.0:7051 \
    -e CORE_PEER_CHAINCODEADDRESS=peer0.org3.example.com:7052 \
    -e CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052 \
    -e CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.example.com:7051 \
    -e CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org3.example.com:7051 \
    -e CORE_PEER_LOCALMSPID=Org3MSP \
    -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
    -e CORE_OPERATIONS_LISTENADDRESS=0.0.0.0:9444 \
    -v /var/run/docker.sock:/host/var/run/docker.sock \
    -v $(pwd)/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/msp:/etc/hyperledger/fabric/msp \
    -v $(pwd)/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls:/etc/hyperledger/fabric/tls \
    -v $(pwd)/peer0-org3-data:/var/hyperledger/production \
    hyperledger/fabric-peer:latest peer node start
PEER3_CMD

# Peer Org4 on D4 (port 8051 to avoid conflict with orderer)
$SSH $D4 'bash -s' << 'PEER4_CMD'
cd ~/fabric-network
sudo docker run -d --name peer0.org4.example.com --network host \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
    -e FABRIC_LOGGING_SPEC=INFO \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_PROFILE_ENABLED=false \
    -e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt \
    -e CORE_PEER_ID=peer0.org4.example.com \
    -e CORE_PEER_ADDRESS=peer0.org4.example.com:8051 \
    -e CORE_PEER_LISTENADDRESS=0.0.0.0:8051 \
    -e CORE_PEER_CHAINCODEADDRESS=peer0.org4.example.com:8052 \
    -e CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:8052 \
    -e CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.example.com:7051 \
    -e CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org4.example.com:8051 \
    -e CORE_PEER_LOCALMSPID=Org4MSP \
    -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
    -e CORE_OPERATIONS_LISTENADDRESS=0.0.0.0:9445 \
    -v /var/run/docker.sock:/host/var/run/docker.sock \
    -v $(pwd)/peerOrganizations/org4.example.com/peers/peer0.org4.example.com/msp:/etc/hyperledger/fabric/msp \
    -v $(pwd)/peerOrganizations/org4.example.com/peers/peer0.org4.example.com/tls:/etc/hyperledger/fabric/tls \
    -v $(pwd)/peer0-org4-data:/var/hyperledger/production \
    hyperledger/fabric-peer:latest peer node start
PEER4_CMD

sleep 8
echo "--- Container Status ---"
for host in $ALL_DESKTOPS; do
    echo "  $host: $($SSH $host 'sudo docker ps --format "{{.Names}}:{{.Status}}" 2>/dev/null' | tr '\n' ' ')"
done

# --- Step 6: Create channel + join peers (all from D1 — has osnadmin, peer, all Admin MSPs) ---
echo ""
echo "=== Step 6: Channel creation + peer join (via D1) ==="

$SSH $D1 'bash -s' << 'CHANNEL_CMD'
export PATH=$HOME/fabric-tools/bin:$PATH
FN=~/fabric-network
PEER_ORGS=$FN/peerOrganizations
ORDERER_ORGS=$FN/ordererOrganizations

ORDERER_CA=$ORDERER_ORGS/example.com/tlsca/tlsca.example.com-cert.pem
ORDERER_ADMIN_CERT=$ORDERER_ORGS/example.com/users/Admin@example.com/tls/client.crt
ORDERER_ADMIN_KEY=$ORDERER_ORGS/example.com/users/Admin@example.com/tls/client.key

echo "Joining orderer to channel..."
osnadmin channel join \
    --channelID amchannel \
    --config-block $FN/genesis.block \
    -o orderer.example.com:7053 \
    --ca-file $ORDERER_CA \
    --client-cert $ORDERER_ADMIN_CERT \
    --client-key $ORDERER_ADMIN_KEY
echo "Orderer joined channel."

sleep 3

export CORE_PEER_TLS_ENABLED=true
export ORDERER_CA=$ORDERER_CA

# Join Org1
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORGS/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PEER_ORGS/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
peer channel join -b $FN/genesis.block && echo "Org1 joined."

# Join Org2
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORGS/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PEER_ORGS/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=peer0.org2.example.com:7051
peer channel join -b $FN/genesis.block && echo "Org2 joined."

# Join Org3
export CORE_PEER_LOCALMSPID="Org3MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORGS/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PEER_ORGS/org3.example.com/users/Admin@org3.example.com/msp
export CORE_PEER_ADDRESS=peer0.org3.example.com:7051
peer channel join -b $FN/genesis.block && echo "Org3 joined."

# Join Org4
export CORE_PEER_LOCALMSPID="Org4MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORGS/org4.example.com/peers/peer0.org4.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PEER_ORGS/org4.example.com/users/Admin@org4.example.com/msp
export CORE_PEER_ADDRESS=peer0.org4.example.com:8051
peer channel join -b $FN/genesis.block && echo "Org4 joined."

echo "All peers joined channel."
CHANNEL_CMD

# --- Step 7: Install + approve + commit chaincode (all from D1) ---
echo ""
echo "=== Step 7: Chaincode lifecycle (via D1) ==="

# First, transfer the CCAAS package from laptop to D1 if needed
if $SSH $D1 "[ ! -f ~/fabric-network/unified_1.0.tar.gz ]"; then
    echo "Building and uploading CCAAS package to D1..."
    mkdir -p /tmp/ccaas-pkg
    echo '{"address":"peer0.org1.example.com:9999","dial_timeout":"10s","tls_required":false}' > /tmp/ccaas-pkg/connection.json
    echo '{"type":"ccaas","label":"unified_1.0"}' > /tmp/ccaas-pkg/metadata.json
    cd /tmp/ccaas-pkg
    tar cfz code.tar.gz connection.json
    tar cfz /tmp/unified_1.0.tar.gz code.tar.gz metadata.json
    $SCP /tmp/unified_1.0.tar.gz $D1:~/fabric-network/unified_1.0.tar.gz
    echo "CCAAS package uploaded."
fi

# Run all lifecycle steps from D1
$SSH $D1 'bash -s' << 'LIFECYCLE_CMD'
export PATH=$HOME/fabric-tools/bin:$PATH
FN=~/fabric-network
PEER_ORGS=$FN/peerOrganizations
ORDERER_ORGS=$FN/ordererOrganizations
ORDERER_CA=$ORDERER_ORGS/example.com/tlsca/tlsca.example.com-cert.pem

# Install on Org1 first
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORGS/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PEER_ORGS/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051

peer lifecycle chaincode install $FN/unified_1.0.tar.gz
CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['installed_chaincodes'][0]['package_id'])")
echo "Package ID: $CC_PACKAGE_ID"

# Install on remaining orgs
for org_num in 2 3 4; do
    export CORE_PEER_LOCALMSPID="Org${org_num}MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORGS/org${org_num}.example.com/peers/peer0.org${org_num}.example.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$PEER_ORGS/org${org_num}.example.com/users/Admin@org${org_num}.example.com/msp
    if [ "$org_num" = "4" ]; then
        export CORE_PEER_ADDRESS=peer0.org${org_num}.example.com:8051
    else
        export CORE_PEER_ADDRESS=peer0.org${org_num}.example.com:7051
    fi
    peer lifecycle chaincode install $FN/unified_1.0.tar.gz && echo "Installed on Org${org_num}"
done

# Start CCAAS containers (one per machine, each on port 9999)
for machine_ip in 10.12.11.48 10.12.10.136 10.12.10.92 10.12.10.126; do
    ssh -i ~/.ssh/id_fabric -o StrictHostKeyChecking=no iot-lab@$machine_ip \
        "sudo docker run -d --name cc-unified --network host \
         -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 \
         -e CHAINCODE_ID=$CC_PACKAGE_ID \
         unified_ccaas_image:latest" && echo "CCAAS started on $machine_ip"
done
sleep 5

# Approve for all orgs
for org_num in 1 2 3 4; do
    export CORE_PEER_LOCALMSPID="Org${org_num}MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORGS/org${org_num}.example.com/peers/peer0.org${org_num}.example.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$PEER_ORGS/org${org_num}.example.com/users/Admin@org${org_num}.example.com/msp
    if [ "$org_num" = "4" ]; then
        export CORE_PEER_ADDRESS=peer0.org${org_num}.example.com:8051
    else
        export CORE_PEER_ADDRESS=peer0.org${org_num}.example.com:7051
    fi
    peer lifecycle chaincode approveformyorg \
        -o orderer.example.com:7050 --tls --cafile $ORDERER_CA \
        --channelID amchannel --name unified --version 1.0 \
        --package-id $CC_PACKAGE_ID --sequence 1 \
        && echo "Org${org_num} approved."
done

# Commit (using Org1)
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORGS/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PEER_ORGS/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051

peer lifecycle chaincode commit \
    -o orderer.example.com:7050 --tls --cafile $ORDERER_CA \
    --channelID amchannel --name unified --version 1.0 --sequence 1 \
    --peerAddresses peer0.org1.example.com:7051 \
    --tlsRootCertFiles $PEER_ORGS/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
    --peerAddresses peer0.org2.example.com:7051 \
    --tlsRootCertFiles $PEER_ORGS/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
    --peerAddresses peer0.org3.example.com:7051 \
    --tlsRootCertFiles $PEER_ORGS/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
    --peerAddresses peer0.org4.example.com:8051 \
    --tlsRootCertFiles $PEER_ORGS/org4.example.com/peers/peer0.org4.example.com/tls/ca.crt

peer lifecycle chaincode querycommitted --channelID amchannel --name unified && echo "Chaincode committed."
LIFECYCLE_CMD

echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE — Ready for benchmark"
echo "  Run: bash ~/am-unified/scripts/run-benchmark.sh"
echo "============================================"
