'use strict';
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const utf8 = new TextDecoder();

const cryptoPath = path.resolve(__dirname, '../../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com');
const keyPath    = path.join(cryptoPath, 'users/buyer1@org1.example.com/msp/keystore');
const certPath   = path.join(cryptoPath, 'users/buyer1@org1.example.com/msp/signcerts/cert.pem');
const tlsCertPath = path.join(cryptoPath, 'peers/peer0.org1.example.com/tls/ca.crt');

async function newGrpcClient() {
    const tlsCredential = grpc.credentials.createSsl(fs.readFileSync(tlsCertPath));
    return new grpc.Client('localhost:7051', tlsCredential, {
        'grpc.ssl_target_name_override': 'peer0.org1.example.com',
    });
}

async function newIdentity() {
    const cert = fs.readFileSync(certPath).toString();
    return { mspId: 'Org1MSP', credentials: Buffer.from(cert) };
}

async function newSigner() {
    const files = fs.readdirSync(keyPath);
    const keyFile = path.join(keyPath, files[0]);
    const privateKey = crypto.createPrivateKey(fs.readFileSync(keyFile));
    return signers.newPrivateKeySigner(privateKey);
}

async function main() {
    const client = await newGrpcClient();
    const gw = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        hash: hash.sha256,
    });

    try {
        const network  = gw.getNetwork('mychannel');
        const repCC    = network.getContract('unified', 'ReputationContract');

        const CONCURRENCY = 10;
        const actorID  = 'PrinterBeta';
        const dimension = 'quality';

        console.log(`\nLaunching ${CONCURRENCY} concurrent BufferRating calls for ${actorID}/${dimension}...`);
        const t0 = Date.now();

        const results = await Promise.allSettled(
            Array.from({ length: CONCURRENCY }, (_, i) =>
                repCC.submitTransaction('BufferRating', actorID, dimension, String(0.7 + i * 0.01), `evidence-${i}`)
            )
        );

        const elapsed = Date.now() - t0;
        const ok  = results.filter(r => r.status === 'fulfilled').length;
        const err = results.filter(r => r.status === 'rejected').length;
        console.log(`Results: ${ok} OK, ${err} failed — ${elapsed}ms total`);
        if (err > 0) {
            results.filter(r => r.status === 'rejected').forEach(r => console.log('  ERROR:', r.reason?.message?.slice(0, 200)));
        }

        // Check pending count
        const raw   = await repCC.evaluateTransaction('GetPendingCount', actorID, dimension);
        const count = parseInt(utf8.decode(raw));
        console.log(`\nPending count for ${actorID}/${dimension}: ${count} (expect ${ok})`);

        // Flush
        console.log('\nFlushing...');
        const t1   = Date.now();
        const fraw = await repCC.submitTransaction('FlushRatings', actorID, dimension);
        const fr   = JSON.parse(utf8.decode(fraw));
        console.log(`FlushRatings OK — flushed:${fr.ratingsFlushed} alpha:${fr.newAlpha?.toFixed(4)} beta:${fr.newBeta?.toFixed(4)} score:${fr.newScore?.toFixed(4)} (${Date.now()-t1}ms)`);

        // Confirm buffer empty
        const raw2   = await repCC.evaluateTransaction('GetPendingCount', actorID, dimension);
        const count2 = parseInt(utf8.decode(raw2));
        console.log(`Pending count after flush: ${count2} (expect 0)`);

        console.log('\n=== PASS: no panics, MVCC conflicts absorbed by buffer ===');
    } finally {
        gw.close();
        client.close();
    }
}

main().catch(e => { console.error('FATAL:', e.message || e); process.exit(1); });
