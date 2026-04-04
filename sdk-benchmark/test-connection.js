'use strict';

/**
 * test-connection.js — Verifies gateway connectivity and runs ONE transaction
 * of each contract type before the full benchmark.
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

const TARGET_ACTOR = 'target-supplier-test-001';

async function main() {
    console.log('=== AM-Unified Connection Test ===');
    console.log(`Peer:      ${PEER_ENDPOINT}`);
    console.log(`Channel:   ${CHANNEL_NAME}`);
    console.log(`Chaincode: ${CHAINCODE_NAME}\n`);

    // Load TLS cert
    let tlsRootCert;
    try {
        tlsRootCert = await fs.readFile(TLS_CERT);
        console.log(`[OK] TLS cert loaded: ${TLS_CERT}`);
    } catch (e) {
        console.error(`[FAIL] Cannot read TLS cert at ${TLS_CERT}: ${e.message}`);
        console.error('       Make sure the network is up and crypto material is at ~/am-unified/network/');
        process.exit(1);
    }

    // Load identity
    let certPem;
    try {
        const files = await fs.readdir(CERT_DIR);
        certPem = await fs.readFile(path.join(CERT_DIR, files[0]));
        console.log(`[OK] Identity cert loaded: ${files[0]}`);
    } catch (e) {
        console.error(`[FAIL] Cannot read cert from ${CERT_DIR}: ${e.message}`);
        process.exit(1);
    }

    // Load signer key
    let signer;
    try {
        const files = await fs.readdir(KEY_DIR);
        const keyPem = await fs.readFile(path.join(KEY_DIR, files[0]));
        signer = signers.newPrivateKeySigner(crypto.createPrivateKey(keyPem));
        console.log(`[OK] Private key loaded: ${files[0]}`);
    } catch (e) {
        console.error(`[FAIL] Cannot read key from ${KEY_DIR}: ${e.message}`);
        process.exit(1);
    }

    const tlsCreds = grpc.credentials.createSsl(tlsRootCert);
    const client = new grpc.Client(PEER_ENDPOINT, tlsCreds, {
        'grpc.ssl_target_name_override': PEER_HOST_ALIAS,
    });

    const gateway = connect({ client, identity: { mspId: MSP_ID, credentials: certPem }, signer });

    try {
        const network    = gateway.getNetwork(CHANNEL_NAME);
        const provCon    = network.getContract(CHAINCODE_NAME, 'ProvenanceContract');
        const repCon     = network.getContract(CHAINCODE_NAME, 'ReputationContract');
        const intCon     = network.getContract(CHAINCODE_NAME, 'IntegrationContract');

        // 1. InitConfig
        try {
            await repCon.submitTransaction('InitConfig');
            console.log('[OK] ReputationContract:InitConfig');
        } catch (e) {
            const msg = e.message || '';
            if (msg.includes('already initialized')) {
                console.log('[OK] ReputationContract:InitConfig — already initialized');
            } else {
                console.error(`[FAIL] InitConfig: ${e.message}`);
                throw e;
            }
        }

        // 2. AddStake
        try {
            await repCon.submitTransaction('AddStake', '50000');
            console.log('[OK] ReputationContract:AddStake(50000)');
        } catch (e) {
            console.log(`[WARN] AddStake: ${e.message}`);
        }

        // 3. ProvenanceContract:CreateMaterialCertification
        const testAssetID = `test-conn-${Date.now()}`;
        const hash = crypto.createHash('sha256').update('test-data').digest('hex');
        try {
            await provCon.submitTransaction(
                'CreateMaterialCertification',
                testAssetID, 'titanium', 'batch-test-001', TARGET_ACTOR, hash
            );
            console.log(`[OK] ProvenanceContract:CreateMaterialCertification → assetID=${testAssetID}`);
        } catch (e) {
            console.error(`[FAIL] CreateMaterialCertification: ${e.message}`);
            throw e;
        }

        // 4. ProvenanceContract:ReadAsset
        try {
            const resultBytes = await provCon.evaluateTransaction('ReadAsset', testAssetID);
            const asset = JSON.parse(Buffer.from(resultBytes).toString());
            console.log(`[OK] ProvenanceContract:ReadAsset → stage=${asset.currentLifecycleStage || asset.CurrentLifecycleStage}`);
        } catch (e) {
            console.error(`[FAIL] ReadAsset: ${e.message}`);
            throw e;
        }

        // 5. ReputationContract:SubmitRating
        try {
            const ts = String(Math.floor(Date.now() / 1000));
            const ratingID = await repCon.submitTransaction(
                'SubmitRating',
                TARGET_ACTOR, 'quality', '0.8', hash, ts
            );
            console.log(`[OK] ReputationContract:SubmitRating → ratingID=${Buffer.from(ratingID).toString()}`);
        } catch (e) {
            console.error(`[FAIL] SubmitRating: ${e.message}`);
            throw e;
        }

        // 6. ReputationContract:GetReputation
        try {
            const resultBytes = await repCon.evaluateTransaction('GetReputation', TARGET_ACTOR, 'quality');
            const rep = JSON.parse(Buffer.from(resultBytes).toString());
            console.log(`[OK] ReputationContract:GetReputation → score=${rep.score?.toFixed(3)}`);
        } catch (e) {
            console.error(`[FAIL] GetReputation: ${e.message}`);
            throw e;
        }

        // 7. IntegrationContract:RecordProvenanceWithReputation
        const bridgeAssetID = `test-bridge-${Date.now()}`;
        try {
            const ratingIDBytes = await intCon.submitTransaction(
                'RecordProvenanceWithReputation',
                bridgeAssetID, 'MATERIAL_CERTIFICATION', hash,
                TARGET_ACTOR, '0.8', 'quality', hash
            );
            console.log(`[OK] IntegrationContract:RecordProvenanceWithReputation → ratingID=${Buffer.from(ratingIDBytes).toString()}`);
        } catch (e) {
            console.error(`[FAIL] RecordProvenanceWithReputation: ${e.message}`);
            throw e;
        }

        console.log('\n=== ALL CHECKS PASSED — Ready to run benchmark ===\n');

    } finally {
        gateway.close();
        client.close();
    }
}

main().catch(err => {
    console.error('\n[FATAL]', err.message || err);
    process.exit(1);
});
