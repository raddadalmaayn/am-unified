#!/bin/bash
# start.sh — Launch Hyperledger Explorer for the AM Unified network
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYSTORE_DIR="$HOME/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore"

# Copy the admin private key to a fixed filename so the connection profile
# can reference it deterministically (the hash-named file changes on network restart).
echo "Copying admin private key..."
KEY_FILE=$(ls "$KEYSTORE_DIR"/*_sk | head -1)
cp "$KEY_FILE" "$KEYSTORE_DIR/priv_sk"
echo "Key copied to priv_sk"

docker compose -f "$SCRIPT_DIR/docker-compose.yaml" up -d

echo ""
echo "Hyperledger Explorer starting..."
echo "  UI:          http://localhost:8080"
echo "  Credentials: admin / adminpw"
echo ""
echo "Wait ~30s for the database to initialise on first run."
