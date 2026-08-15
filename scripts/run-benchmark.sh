#!/bin/bash
set -e
echo "=== Installing SDK dependencies ==="
cd ~/am-unified/sdk-benchmark
npm install

echo ""
echo "=== Running connection test ==="
node test-connection.js

echo ""
echo "=== Running full benchmark ==="
node benchmark.js

echo ""
echo "=== Collecting peer logs ==="
RESULTS_DIR=~/am-unified/results/geo-distributed
mkdir -p $RESULTS_DIR
# Host addresses and SSH login for the four nodes; set these for your deployment.
FABRIC_SSH_USER="${FABRIC_SSH_USER:?set FABRIC_SSH_USER to the SSH login on the four nodes}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_fabric}"
for ip in "${D1_HOST:?set D1_HOST}" "${D2_HOST:?set D2_HOST}" "${D3_HOST:?set D3_HOST}" "${D4_HOST:?set D4_HOST}"; do
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$FABRIC_SSH_USER@$ip" \
        "sudo docker logs \$(sudo docker ps --format '{{.Names}}' | head -1) 2>&1 | tail -30" \
        > $RESULTS_DIR/logs_${ip}.txt 2>/dev/null || echo "  (could not collect logs from $ip)"
done

echo ""
echo "=== Results ==="
cat ~/am-unified/results/geo-distributed/sdk_benchmark_*.csv 2>/dev/null | tail -20

echo ""
echo "DONE. Results in ~/am-unified/results/geo-distributed/"
