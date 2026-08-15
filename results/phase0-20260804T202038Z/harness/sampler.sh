#!/bin/bash
# sampler.sh — resource sampler (Phase 1f).
#
# RUNS FROM THE LAPTOP, not from D1, so that collecting samples does not load
# the SDK host. Every 2 s it collects `docker stats --no-stream` from each of
# the four nodes over SSH, plus the harness process (CPU and RSS) on D1, and
# appends to resources.csv.
#
# D1 is the weakest node and hosts peer + chaincode container + SDK client.
# If the harness process saturates a core, the sweep is measuring the client
# rather than the system, and the report must say so. That is why the harness
# process is sampled at the same cadence as the containers.
#
# Usage:
#   sampler.sh <out.csv> <phase-label> [interval_seconds]
#   Send SIGINT/SIGTERM to stop.

OUT=${1:?usage: sampler.sh <out.csv> <phase-label> [interval]}
PHASE=${2:?usage: sampler.sh <out.csv> <phase-label> [interval]}
INTERVAL=${3:-2}

D1=D1; D2=D2; D3=D3; D4=D4
NODES="D1:$D1 D2:$D2 D3:$D3 D4:$D4"

if [ ! -f "$OUT" ]; then
  echo "timestamp,node,container,cpu_pct,mem_used_mb,mem_limit_mb,net_rx,net_tx,block_io,phase" > "$OUT"
fi

RUNNING=1
trap 'RUNNING=0' INT TERM

# tomb: convert docker stats human units to MB
to_mb() {
  awk '{
    v=$0; sub(/[A-Za-z]+$/,"",v); u=$0; sub(/^[0-9.]+/,"",u);
    if (u ~ /^GiB/) printf "%.2f", v*1024;
    else if (u ~ /^MiB/) printf "%.2f", v;
    else if (u ~ /^KiB/) printf "%.4f", v/1024;
    else if (u ~ /^B/)   printf "%.6f", v/1048576;
    else printf "%s", v;
  }'
}

sample_node() {
  local name=$1 ip=$2 ts=$3
  ssh -o BatchMode=yes -o ConnectTimeout=5 @"$ip" \
    'docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"' 2>/dev/null \
  | while IFS=$'\t' read -r cname cpu mem net blk; do
      [ -z "$cname" ] && continue
      cpu=${cpu%\%}
      used=$(echo "$mem"  | awk -F' / ' '{print $1}' | to_mb)
      lim=$(echo  "$mem"  | awk -F' / ' '{print $2}' | to_mb)
      rx=$(echo   "$net"  | awk -F' / ' '{print $1}')
      tx=$(echo   "$net"  | awk -F' / ' '{print $2}')
      blkio=$(echo "$blk" | tr -d ' ')
      echo "$ts,$name,$cname,$cpu,$used,$lim,$rx,$tx,$blkio,$PHASE"
    done
}

# Harness process on D1.
#
# Two corrections over the naive version:
#  1. Select the NODE process, not the ssh/bash wrapper whose command line also
#     contains the string "bench.js". Matching the wrapper reports ~3 MB RSS and
#     0% CPU, which would have silently hidden a client-side bottleneck.
#  2. `ps -o pcpu` reports average CPU over the process LIFETIME, which cannot
#     show instantaneous saturation. Read utime+stime from /proc/<pid>/stat and
#     difference successive samples to get true interval CPU%.
#
# A value approaching 100% means one core is saturated. Node is single-threaded
# for JS execution, so ~100% indicates the client, not Fabric, is the limit.
PREV_JIFF=""; PREV_T=""
CLK_TCK=$(getconf CLK_TCK 2>/dev/null || echo 100)

sample_harness() {
  local ts=$1
  local raw
  raw=$(ssh -o BatchMode=yes -o ConnectTimeout=5 @"$D1" \
    'p=""; for c in $(pgrep -f "bench\.js"); do
       [ "$(cat /proc/$c/comm 2>/dev/null)" = "node" ] && { p=$c; break; }
     done; [ -z "$p" ] && exit 0;
     read -r _ _ _ _ _ _ _ _ _ _ _ _ _ ut st rest < /proc/$p/stat;
     rss=$(awk "/^VmRSS/{print \$2}" /proc/$p/status);
     thr=$(awk "/^Threads/{print \$2}" /proc/$p/status);
     echo "$p $ut $st $rss $thr $(date +%s.%N)"' 2>/dev/null)
  [ -z "$raw" ] && { PREV_JIFF=""; return; }

  set -- $raw
  local pid=$1 ut=$2 st=$3 rsskb=$4 thr=$5 now=$6
  local jiff=$(( ut + st ))
  local cpu="NA"
  if [ -n "$PREV_JIFF" ]; then
    cpu=$(awk -v j="$jiff" -v pj="$PREV_JIFF" -v t="$now" -v pt="$PREV_T" -v hz="$CLK_TCK" \
      'BEGIN{ dt=t-pt; if(dt<=0){print "NA"} else printf "%.1f", ((j-pj)/hz)/dt*100 }')
  fi
  PREV_JIFF=$jiff; PREV_T=$now
  local rssmb
  rssmb=$(awk -v r="$rsskb" 'BEGIN{printf "%.2f", r/1024}')
  echo "$ts,D1,HARNESS_bench.js,$cpu,$rssmb,,,,threads=$thr,$PHASE"
}

echo "sampler: writing to $OUT phase=$PHASE interval=${INTERVAL}s (Ctrl-C to stop)" >&2
while [ $RUNNING -eq 1 ]; do
  TS=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
  {
    for spec in $NODES; do
      sample_node "${spec%%:*}" "${spec##*:}" "$TS" &
    done
    wait
  } >> "$OUT"
  # Not backgrounded: sample_harness carries CPU-delta state across iterations,
  # which a subshell would discard.
  sample_harness "$TS" >> "$OUT"
  sleep "$INTERVAL"
done
echo "sampler: stopped" >&2
