'use strict';
/**
 * fabric.js — Fabric Gateway singleton for the AM Dashboard
 *
 * Maintains one gRPC client and a per-user gateway cache.
 * Connection parameters mirror client-tests/performance_test.js.
 */

const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc   = require('@grpc/grpc-js');
const crypto = require('crypto');
const fs     = require('fs').promises;
const path   = require('path');

// ── Network config (same as performance_test.js) ──────────────────────────────
const channelName   = 'mychannel';
const chaincodeName = 'unified';
const mspId         = 'Org1MSP';

const cryptoPath    = path.resolve(__dirname, '..', '..', 'fabric-samples', 'test-network',
                        'organizations', 'peerOrganizations', 'org1.example.com');
const peerEndpoint  = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';
const tlsCertPath   = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');

// ── Singleton state ───────────────────────────────────────────────────────────
let grpcClient = null;
const gatewayCache = new Map();   // username → gateway

async function getGrpcClient() {
    if (grpcClient) return grpcClient;
    const tlsRootCert    = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    grpcClient = new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
    return grpcClient;
}

async function newIdentity(username) {
    const certPath = path.resolve(
        cryptoPath, 'users', `${username}@org1.example.com`, 'msp', 'signcerts', 'cert.pem'
    );
    const cert = await fs.readFile(certPath);
    return { mspId, credentials: cert };
}

async function newSigner(username) {
    const keyDir = path.resolve(
        cryptoPath, 'users', `${username}@org1.example.com`, 'msp', 'keystore'
    );
    const files = await fs.readdir(keyDir);
    const pem   = await fs.readFile(path.resolve(keyDir, files[0]));
    return signers.newPrivateKeySigner(crypto.createPrivateKey(pem));
}

async function getGateway(username) {
    if (gatewayCache.has(username)) return gatewayCache.get(username);
    const client   = await getGrpcClient();
    const identity = await newIdentity(username);
    const signer   = await newSigner(username);
    const gw = connect({
        client, identity, signer,
        evaluateOptions:     () => ({ deadline: Date.now() + 5_000 }),
        endorseOptions:      () => ({ deadline: Date.now() + 15_000 }),
        submitOptions:       () => ({ deadline: Date.now() + 20_000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
    });
    gatewayCache.set(username, gw);
    return gw;
}

/**
 * Returns a Fabric Contract handle.
 * @param {string} username     - enrolled identity (e.g. 'Admin', 'buyer1')
 * @param {string} contractName - e.g. 'ReputationContract'
 */
async function getContract(username, contractName) {
    const gw      = await getGateway(username);
    const network = gw.getNetwork(channelName);
    return network.getContract(chaincodeName, contractName);
}

/** Graceful shutdown — close all open gateways and the gRPC client. */
function closeAll() {
    for (const gw of gatewayCache.values()) {
        try { gw.close(); } catch (_) {}
    }
    gatewayCache.clear();
    if (grpcClient) {
        grpcClient.close();
        grpcClient = null;
    }
}

module.exports = { getContract, closeAll };
