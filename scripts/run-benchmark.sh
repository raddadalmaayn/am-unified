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
for ip in 10.12.11.48 10.12.10.136 10.12.10.92 10.12.10.126; do
    ssh -i ~/.ssh/id_fabric -o StrictHostKeyChecking=no iot-lab@$ip \
        "sudo docker logs \$(sudo docker ps --format '{{.Names}}' | head -1) 2>&1 | tail -30" \
        > $RESULTS_DIR/logs_${ip}.txt 2>/dev/null || echo "  (could not collect logs from $ip)"
done

echo ""
echo "=== Results ==="
cat ~/am-unified/results/geo-distributed/sdk_benchmark_*.csv 2>/dev/null | tail -20

echo ""
echo "DONE. Results in ~/am-unified/results/geo-distributed/"
