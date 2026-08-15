#!/bin/bash
# fabinfo_singlehost.sh — ledger + orderer state for the SINGLE-HOST two-org
# network, emitted as one JSON object in the same shape as the lab's fabinfo.sh.
#
# Phase 8 (2026-08-09). Differences from the lab version, all structural:
#   - two peer orgs, not four
#   - one orderer, not three, so there is no Raft leader/follower distinction
#     and no consenter set to poll
#   - crypto lives under AM/fabric-samples/test-network/organizations
#   - channel is mychannel, not amchannel
#
# The orderer entry is still emitted, so bench.js's manifest shape is unchanged
# and Phase 8 manifests stay directly comparable to the lab phases.
export PATH=AM/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=AM/fabric-samples/config
TN=AM/fabric-samples/test-network
ORG=$TN/organizations
CH=${1:-mychannel}

export CORE_PEER_TLS_ENABLED=true

peer_info() {
  local n=$1 addr=$2
  export CORE_PEER_LOCALMSPID=Org${n}MSP
  export CORE_PEER_MSPCONFIGPATH=$ORG/peerOrganizations/org${n}.example.com/users/Admin@org${n}.example.com/msp
  export CORE_PEER_TLS_ROOTCERT_FILE=$ORG/peerOrganizations/org${n}.example.com/peers/peer0.org${n}.example.com/tls/ca.crt
  export CORE_PEER_ADDRESS=$addr
  peer channel getinfo -c "$CH" 2>/dev/null | grep -o '{"height".*'
}

orderer_info() {
  local T=$ORG/ordererOrganizations/example.com/orderers/orderer.example.com/tls
  osnadmin channel list --channelID "$CH" -o localhost:7053 \
    --ca-file $T/ca.crt --client-cert $T/server.crt --client-key $T/server.key 2>/dev/null \
    | tr -d '\n' | grep -oP '\{.*\}'
}

echo -n '{"captured_at":"'"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"'","peers":{'
first=1
for spec in "1 localhost:7051" "2 localhost:9051"; do
  set -- $spec
  info=$(peer_info "$1" "$2")
  [ -z "$info" ] && info='null'
  [ $first -eq 0 ] && echo -n ','
  first=0
  echo -n "\"org$1\":$info"
done
echo -n '},"orderers":{'
info=$(orderer_info)
[ -z "$info" ] && info='null'
echo -n "\"orderer.example.com\":$info"
echo '}}'
