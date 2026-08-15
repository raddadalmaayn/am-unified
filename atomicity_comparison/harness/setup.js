'use strict';
// Idempotent setup: ensure reputation config initialized and rater (Admin) staked.
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } = require('./lib');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

const RATER = process.env.RATER_USER || 'Admin';

async function main() {
  const client = newGrpcConnection();
  const gw = gatewayFor(client, RATER);
  const net = gw.getNetwork(channelName);
  const rep = net.getContract(chaincodeName, 'ReputationContract');

  // 1. InitConfig (idempotent — tolerate "already initialized")
  try {
    await rep.submitTransaction('InitConfig');
    console.log('InitConfig: OK (newly initialized)');
  } catch (e) {
    if (/already initialized/.test(e.message || String(e))) console.log('InitConfig: already initialized (OK)');
    else console.log('InitConfig: error (continuing):', (e.message || e).slice(0, 200));
  }

  // 2. Stake the rater generously so MinStakeRequired (10000) never blocks.
  try {
    await rep.submitTransaction('AddStake', '100000000');
    console.log('AddStake: +100,000,000 to', RATER);
  } catch (e) {
    console.log('AddStake: error:', (e.message || e).slice(0, 200));
  }

  // 3. Confirm stake
  try {
    const s = await rep.evaluateTransaction('GetStake', RATER);
    console.log('GetStake(', RATER, '):', dec.decode(s));
  } catch (e) {
    console.log('GetStake: error:', (e.message || e).slice(0, 200));
  }

  gw.close();
  client.close();
}
main().catch((e) => { console.error('SETUP_FATAL', e); process.exit(1); });
