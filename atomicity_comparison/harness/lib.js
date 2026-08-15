'use strict';
// Shared connection + contract helpers for the atomicity experiment.
const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const channelName   = 'mychannel';
const chaincodeName = 'unified';
const mspId         = 'Org1MSP';
const cryptoPath    = process.env.FABRIC_CRYPTO_PATH || (() => { throw new Error('set FABRIC_CRYPTO_PATH to the org1.example.com peerOrganizations directory') })();
const peerEndpoint  = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';
const tlsCertPath   = path.join(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');

function newGrpcConnection() {
  const tlsRootCert = fs.readFileSync(tlsCertPath);
  const creds = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(peerEndpoint, creds, { 'grpc.ssl_target_name_override': peerHostAlias });
}

function newIdentity(user) {
  const certPath = path.join(cryptoPath, 'users', `${user}@org1.example.com`, 'msp', 'signcerts', 'cert.pem');
  return { mspId, credentials: fs.readFileSync(certPath) };
}

/*
 * DEFECT FIX (2026-08-10, Phase 10D). This took keystore file [0] and assumed it
 * paired with signcerts/cert.pem. A keystore can hold more than one key --
 * re-enrolling an identity against a Fabric CA adds a second key beside the
 * original -- and when [0] is the stale key every transaction fails peer-side
 * with "access denied: channel [X] creator org [Y]", which reads like an MSP or
 * policy problem rather than a client key-selection bug. Select the key that
 * actually matches the signing certificate.
 *
 * The identical defect was found and fixed in am-unified/client-tests/bench.js
 * earlier in this session. It is latent wherever an identity has been
 * re-enrolled, and it did NOT affect the June 2026 study, whose runs predate the
 * re-enrollment that created the second key.
 */
function newSigner(user) {
  const keyDir = path.join(cryptoPath, 'users', `${user}@org1.example.com`, 'msp', 'keystore');
  const certPem = newIdentity(user).credentials;
  const certPub = new crypto.X509Certificate(certPem).publicKey
    .export({ type: 'spki', format: 'der' });
  const files = fs.readdirSync(keyDir).sort();
  for (const f of files) {
    try {
      const key = crypto.createPrivateKey(fs.readFileSync(path.join(keyDir, f)));
      const pub = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
      if (pub.equals(certPub)) return signers.newPrivateKeySigner(key);
    } catch { /* not a usable key; try the next */ }
  }
  throw new Error(`no key in ${keyDir} matches the signcert for ${user} (tried ${files.length})`);
}

function gatewayFor(client, user) {
  return connect({
    client,
    identity: newIdentity(user),
    signer: newSigner(user),
    evaluateOptions:     () => ({ deadline: Date.now() + 15000 }),
    endorseOptions:      () => ({ deadline: Date.now() + 20000 }),
    submitOptions:       () => ({ deadline: Date.now() + 30000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });
}

module.exports = { newGrpcConnection, gatewayFor, channelName, chaincodeName, mspId };
