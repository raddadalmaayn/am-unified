#!/bin/bash
# collect_env.sh — cross-node environment snapshot for the run manifest.
#
# RUNS ON THE LAPTOP. D1 has no outbound SSH to the other lab nodes (verified:
# publickey denied to D2, D3, D4 and to itself), so bench.js cannot gather this
# itself. The laptop collects it, writes env.json, copies it to D1, and bench.js
# embeds it into every manifest via --env-file.
#
# Records image DIGESTS, not tags (amendment D1: :latest is not pinned), and the
# chaincode binary sha256 on every node (amendment P3).
#
# Usage: collect_env.sh <out.json>

set -u
OUT=${1:?usage: collect_env.sh <out.json>}
CH=amchannel
CC=unified

# Everything below is emitted as JSON; send it to the target file.
exec > "$OUT"

declare -A IP=( [D1]=D1 [D2]=D2 [D3]=D3 [D4]=D4 )
declare -A IFACE=( [D1]=enp4s0f0 [D2]=enp0s25 [D3]=eno1 [D4]=eno1 )
declare -A ORGN=( [D1]=1 [D2]=2 [D3]=3 [D4]=4 )
declare -A PPORT=( [D1]=7051 [D2]=7051 [D3]=7051 [D4]=8051 )

S() { timeout 30 ssh -o BatchMode=yes -o ConnectTimeout=8 @"$1" "$2" 2>/dev/null; }

echo -n '{"captured_at":"'"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"'"'

# Source-of-truth commit: the laptop repo is where the deployed chaincode was
# built from. D1 carries a different, older clone (it holds the harness scripts
# only), so its HEAD must never be reported as the chaincode provenance.
SRC_COMMIT=$(cd "$HOME/am-unified" 2>/dev/null && git rev-parse HEAD 2>/dev/null || echo UNKNOWN)
SRC_DIRTY=$(cd "$HOME/am-unified" 2>/dev/null && { [ -n "$(git status --porcelain -- chaincode/ 2>/dev/null)" ] && echo true || echo false; } || echo unknown)
echo -n ",\"source_git_commit\":\"$SRC_COMMIT\",\"source_chaincode_tree_dirty\":$SRC_DIRTY"

# ── container inventory, with digests ──────────────────────────────────────
echo -n ',"container_inventory":{'
first=1
for n in D1 D2 D3 D4; do
  [ $first -eq 0 ] && echo -n ','
  first=0
  echo -n "\"$n\":["
  raw=$(S "${IP[$n]}" 'for c in $(docker ps --format "{{.Names}}"); do echo "$c|$(docker inspect $c --format "{{.Config.Image}}")|$(docker inspect $c --format "{{.Image}}")|$(docker inspect $c --format "{{.State.StartedAt}}")"; done')
  f2=1
  while IFS='|' read -r name tag digest started; do
    [ -z "$name" ] && continue
    [ $f2 -eq 0 ] && echo -n ','
    f2=0
    echo -n "{\"name\":\"$name\",\"image_tag\":\"$tag\",\"image_digest\":\"$digest\",\"started_at\":\"$started\"}"
  done <<< "$raw"
  echo -n ']'
done
echo -n '}'

# ── chaincode binary sha256 per node (P3) ──────────────────────────────────
echo -n ',"chaincode_sha256":{'
first=1
for n in D1 D2 D3 D4; do
  [ $first -eq 0 ] && echo -n ','
  first=0
  d=$(S "${IP[$n]}" 'docker exec cc-unified sha256sum /chaincode/unified_ccaas 2>/dev/null | cut -d" " -f1')
  echo -n "\"$n\":\"${d:-MISSING}\""
done
echo -n '}'

# ── per-org approved chaincode package IDs ─────────────────────────────────
echo -n ',"chaincode_package_ids":{'
first=1
for n in D1 D2 D3 D4; do
  [ $first -eq 0 ] && echo -n ','
  first=0
  o=${ORGN[$n]}
  pid=$(S "${IP[$n]}" "source /tmp/pe.sh $o ${PPORT[$n]}; peer lifecycle chaincode queryapproved -C $CH -n $CC --output json 2>/dev/null | jq -r .source.Type.LocalPackage.package_id")
  echo -n "\"org$o\":\"${pid:-UNKNOWN}\""
done
echo -n '}'

# ── qdisc state per node (Phase 5 evidence) ────────────────────────────────
echo -n ',"qdisc_state":{'
first=1
for n in D1 D2 D3 D4; do
  [ $first -eq 0 ] && echo -n ','
  first=0
  q=$(S "${IP[$n]}" "tc qdisc show dev ${IFACE[$n]}" | tr '\n' ' ' | sed 's/"/\\"/g')
  echo -n "\"$n\":{\"iface\":\"${IFACE[$n]}\",\"qdisc\":\"$q\"}"
done
echo -n '}'

# ── peer / orderer binary versions ─────────────────────────────────────────
echo -n ',"fabric_versions":{'
first=1
for n in D1 D2 D3 D4; do
  [ $first -eq 0 ] && echo -n ','
  first=0
  o=${ORGN[$n]}
  pv=$(S "${IP[$n]}" "docker exec peer0.org$o.example.com peer version 2>/dev/null | grep -oP 'Version: \K\S+' | head -1")
  echo -n "\"$n\":{\"peer\":\"${pv:-UNKNOWN}\"}"
done
echo -n '}'

echo '}'
