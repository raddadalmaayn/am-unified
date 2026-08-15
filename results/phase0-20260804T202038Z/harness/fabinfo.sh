#!/bin/bash
# fabinfo.sh — emit ledger + orderer state as a single JSON object.
# Used by bench.js for 1h (ledger reconciliation) and D3 (orderer height sampling).
# Read-only. Runs on D1, which holds all four orgs' MSP material and the only
# osnadmin binary in the lab.
export PATH=$HOME/fabric-tools/bin:$PATH
export FABRIC_CFG_PATH=$HOME/fabric-tools/config
FN=$HOME/fabric-network
CH=${1:-amchannel}

export CORE_PEER_TLS_ENABLED=true

peer_info() {
  local n=$1 addr=$2
  export CORE_PEER_LOCALMSPID=Org${n}MSP
  export CORE_PEER_MSPCONFIGPATH=$FN/peerOrganizations/org${n}.example.com/users/Admin@org${n}.example.com/msp
  export CORE_PEER_TLS_ROOTCERT_FILE=$FN/peerOrganizations/org${n}.example.com/peers/peer0.org${n}.example.com/tls/ca.crt
  export CORE_PEER_ADDRESS=$addr
  peer channel getinfo -c "$CH" 2>/dev/null | grep -o '{"height".*'
}

orderer_info() {
  local o=$1
  local T=$FN/ordererOrganizations/example.com/orderers/$o/tls
  osnadmin channel list --channelID "$CH" -o ${o}:7053 \
    --ca-file $T/ca.crt --client-cert $T/server.crt --client-key $T/server.key 2>/dev/null \
    | tr -d '\n' | grep -oP '\{.*\}'
}

echo -n '{"captured_at":"'"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"'","peers":{'
first=1
for spec in "1 peer0.org1.example.com:7051" "2 peer0.org2.example.com:7051" \
            "3 peer0.org3.example.com:7051" "4 peer0.org4.example.com:8051"; do
  set -- $spec
  info=$(peer_info "$1" "$2")
  [ -z "$info" ] && info='null'
  [ $first -eq 0 ] && echo -n ','
  first=0
  echo -n "\"org$1\":$info"
done
echo -n '},"orderers":{'
first=1
for o in orderer.example.com orderer2.example.com orderer3.example.com; do
  info=$(orderer_info "$o")
  [ -z "$info" ] && info='null'
  [ $first -eq 0 ] && echo -n ','
  first=0
  echo -n "\"$o\":$info"
done
echo '}}'
