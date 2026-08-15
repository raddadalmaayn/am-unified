#!/bin/bash
# collect_env_singlehost.sh — environment snapshot for the SINGLE-HOST two-org
# network (Phase 8, 2026-08-09).
#
# Same output shape as the lab's collect_env.sh so bench.js consumes it
# unchanged and Phase 8 manifests stay comparable to the lab phases. Everything
# is local here, so there is no SSH and no cross-node collection.
#
# The topology is expressed as a single logical node "L1" (the laptop), which is
# what BENCH_NODES must be set to. Records image DIGESTS, not tags, because
# :latest is not pinned (amendment D1), and the chaincode binary sha256
# (amendment P3), which under CCAAS is the only integrity binding for the
# deployed code.
#
# Usage: collect_env_singlehost.sh <out.json>

set -u
OUT=${1:?usage: collect_env_singlehost.sh <out.json>}
TN=AM/fabric-samples/test-network
CH=mychannel
CC=unified
export PATH=AM/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=AM/fabric-samples/config

exec > "$OUT"

echo -n '{"captured_at":"'"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"'"'

SRC_COMMIT=$(cd "$HOME/am-unified" 2>/dev/null && git rev-parse HEAD 2>/dev/null || echo UNKNOWN)
SRC_DIRTY=$(cd "$HOME/am-unified" 2>/dev/null && { [ -n "$(git status --porcelain -- chaincode/ 2>/dev/null)" ] && echo true || echo false; } || echo unknown)
echo -n ",\"source_git_commit\":\"$SRC_COMMIT\",\"source_chaincode_tree_dirty\":$SRC_DIRTY"
echo -n ',"testbed":"single-host-2org"'

# ── container inventory with digests ───────────────────────────────────────
echo -n ',"container_inventory":{"L1":['
f=1
for c in $(docker ps --format '{{.Names}}'); do
  [ $f -eq 0 ] && echo -n ','
  f=0
  tag=$(docker inspect "$c" --format '{{.Config.Image}}')
  dig=$(docker inspect "$c" --format '{{.Image}}')
  st=$(docker inspect "$c" --format '{{.State.StartedAt}}')
  echo -n "{\"name\":\"$c\",\"image_tag\":\"$tag\",\"image_digest\":\"$dig\",\"started_at\":\"$st\"}"
done
echo -n ']}'

# ── chaincode binary sha256 (P3) ───────────────────────────────────────────
d=$(docker exec peer0org1_unified_ccaas sha256sum /chaincode/unified_ccaas 2>/dev/null | cut -d' ' -f1)
echo -n ",\"chaincode_sha256\":{\"L1\":\"${d:-MISSING}\"}"

# ── approved package IDs per org ───────────────────────────────────────────
export CORE_PEER_TLS_ENABLED=true
pkg_for() {
  local n=$1 addr=$2
  export CORE_PEER_LOCALMSPID=Org${n}MSP
  export CORE_PEER_MSPCONFIGPATH=$TN/organizations/peerOrganizations/org${n}.example.com/users/Admin@org${n}.example.com/msp
  export CORE_PEER_TLS_ROOTCERT_FILE=$TN/organizations/peerOrganizations/org${n}.example.com/peers/peer0.org${n}.example.com/tls/ca.crt
  export CORE_PEER_ADDRESS=$addr
  peer lifecycle chaincode queryapproved -C $CH -n $CC --output json 2>/dev/null \
    | jq -r '.source.Type.LocalPackage.package_id' 2>/dev/null
}
p1=$(pkg_for 1 localhost:7051); p2=$(pkg_for 2 localhost:9051)
echo -n ",\"chaincode_package_ids\":{\"org1\":\"${p1:-UNKNOWN}\",\"org2\":\"${p2:-UNKNOWN}\"}"

# ── qdisc: single host, loopback only; netem is never applied here ─────────
q=$(tc qdisc show dev lo 2>/dev/null | tr '\n' ' ' | sed 's/"/\\"/g')
echo -n ",\"qdisc_state\":{\"L1\":{\"iface\":\"lo\",\"qdisc\":\"$q\"}}"

# ── versions ───────────────────────────────────────────────────────────────
pv=$(docker exec peer0.org1.example.com peer version 2>/dev/null | grep -oP 'Version: \K\S+' | head -1)
ov=$(docker exec orderer.example.com orderer version 2>/dev/null | grep -oP 'Version: \K\S+' | head -1)
cv=$(peer version 2>/dev/null | grep -oP 'Version: \K\S+' | head -1)
echo -n ",\"fabric_versions\":{\"L1\":{\"peer\":\"${pv:-UNKNOWN}\",\"orderer\":\"${ov:-UNKNOWN}\",\"cli\":\"${cv:-UNKNOWN}\"}}"

echo '}'
