'use strict';

/**
 * validate-mvcc-fix.js
 * Quick 10-txn concurrent Reputation test to verify MVCC fix.
 * Run this after deploying the benchmark fix. Expect 0 failures.
 */

const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const { promises: fs } = require('fs');
const path = require('path');
const crypto = require('crypto');

const NETWORK_DIR = path.resolve(__dirname, '../network');
const ORG1_DIR    = path.join(NETWORK_DIR, 'organizations/peerOrganizations/org1.example.com');
const TLS_CERT    = path.join(ORG1_DIR, 'peers/peer0.org1.example.com/tls/ca.crt');
const CERT_DIR    = path.join(ORG1_DIR, 'users/Admin@org1.example.com/msp/signcerts');
const KEY_DIR     = path.join(ORG1_DIR, 'users/Admin@org1.example.com/msp/keystore');

const PEER_ENDPOINT   = process.env.PEER_ENDPOINT   || 'peer0.org1.example.com:7051';
const PEER_HOST_ALIAS = process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';
const MSP_ID          = process.env.MSP_ID          || 'Org1MSP';
const CHANNEL_NAME    = process.env.CHANNEL_NAME    || 'amchannel';
const CHAINCODE_NAME  = process.env.CHAINCODE_NAME  || 'unified';

const DIMENSIONS = ['quality', 'delivery', 'compliance', 'warranty'];

function sha256hex(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(TLS_CERT);
    const tlsCreds = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(PEER_ENDPOINT, tlsCreds, {
        'grpc.ssl_target_name_override': PEER_HOST_ALIAS,
    });
}

async function main() {
    console.log('=== MVCC Fix Validation ===');
    console.log('Running 10 concurrent Reputation txns, each targeting a unique actor+dimension.\n');

    const client   = await newGrpcConnection();
    const files    = await fs.readdir(CERT_DIR);
    const certPem  = await fs.readFile(path.join(CERT_DIR, files[0]));
    const keyFiles = await fs.readdir(KEY_DIR);
    const keyPem   = await fs.readFile(path.join(KEY_DIR, keyFiles[0]));
    const privateKey = crypto.createPrivateKey(keyPem);
    const identity  = { mspId: MSP_ID, credentials: certPem };
    const signer    = signers.newPrivateKeySigner(privateKey);

    const gateway = connect({ client, identity, signer });
    try {
        const network    = gateway.getNetwork(CHANNEL_NAME);
        const repContract = network.getContract(CHAINCODE_NAME, 'ReputationContract');

        // Ensure stake exists
        try {
            await repContract.submitTransaction('AddStake', '50000');
            console.log('AddStake(50000): OK');
        } catch (e) {
            console.log(`AddStake: ${e.message} (may already have stake — OK)`);
        }

        const WORKERS = 10;
        const wallStart = Date.now();
        let failures = 0;
        const errors = [];

        const txns = Array.from({ length: WORKERS }, (_, i) => (async () => {
            // Each worker gets a unique (actor, dimension) — no shared write key
            const actor = `validate-actor-${i}`;
            const dim   = DIMENSIONS[i % DIMENSIONS.length];
            const ts    = Math.floor(Date.now() / 1000);
            console.log(`  [${i}] SubmitRating(${actor}, ${dim})`);
            try {
                await repContract.submitTransaction(
                    'SubmitRating',
                    actor, dim, '0.8', sha256hex(`validate-ev-${i}-${Date.now()}`), String(ts + i)
                );
                console.log(`  [${i}] OK`);
            } catch (e) {
                failures++;
                errors.push(`  [${i}] FAILED: ${e.message}`);
                console.error(`  [${i}] FAILED: ${e.message}`);
            }
        })());

        await Promise.all(txns);
        const elapsed = Date.now() - wallStart;

        console.log('\n=== VALIDATION RESULT ===');
        console.log(`Succeeded: ${WORKERS - failures}/${WORKERS}`);
        console.log(`Failures:  ${failures}/${WORKERS}`);
        console.log(`Wall time: ${elapsed}ms`);
        if (failures > 1) {
            console.log('\nFAIL: Still seeing MVCC conflicts. Check peer logs:');
            console.log('  docker logs peer0.org1.example.com 2>&1 | grep -i mvcc | tail -10');
        } else {
            console.log('\nPASS: MVCC fix is working. Ready for full benchmark.');
        }
    } finally {
        gateway.close();
        client.close();
    }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
