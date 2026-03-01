'use strict';
/**
 * enrollUsers.js — Enrolls all test identities needed for the unified AM system tests.
 *
 * Uses the Hyperledger Fabric CA client to register and enrol:
 *   - buyer1     (primary rater / attacker in some tests)
 *   - tps_user_1 … tps_user_30 (concurrent throughput users)
 *   - victim_supplier (target actor in security tests)
 *
 * Identities are stored using the fabric-network FileSystemWallet so that
 * performance_test.js and security_test.js can load them by username.
 */

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs   = require('fs');
const path = require('path');

const ccpPath = path.resolve(
    __dirname, '..', '..', 'fabric-samples', 'test-network',
    'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json'
);
const walletPath = path.join(process.cwd(), 'wallet');

const TEST_USERS = [
    { id: 'buyer1',           secret: 'buyer1pw' },
    ...Array.from({ length: 30 }, (_, i) => ({
        id: `tps_user_${i + 1}`, secret: `tps_user_pw_${i + 1}`,
    })),
    { id: 'victim_supplier',  secret: 'victim1pw' },
    { id: 'attacker_1',       secret: 'attacker1pw' },
];

async function main() {
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
    const ca     = new FabricCAServices(
        caInfo.url,
        { trustedRoots: caInfo.tlsCACerts.pem, verify: false },
        caInfo.caName
    );

    const wallet   = await Wallets.newFileSystemWallet(walletPath);
    const adminId  = await wallet.get('admin1');
    if (!adminId) {
        console.error('ERROR: admin1 not in wallet — run enrollAdmin.js first');
        process.exit(1);
    }

    // Build an admin provider for registering users
    const provider = wallet.getProviderRegistry().getProvider(adminId.type);
    const adminUser = await provider.getUserContext(adminId, 'admin1');

    let enrolled = 0;
    let skipped  = 0;

    for (const user of TEST_USERS) {
        const existing = await wallet.get(user.id);
        if (existing) {
            console.log(`  ✓ ${user.id} already in wallet — skipping`);
            skipped++;
            continue;
        }

        try {
            // Register
            const secret = await ca.register(
                { enrollmentID: user.id, enrollmentSecret: user.secret, role: 'client' },
                adminUser
            );

            // Enrol
            const enrollment = await ca.enroll({
                enrollmentID: user.id,
                enrollmentSecret: secret,
            });

            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey:  enrollment.key.toBytes(),
                },
                mspId: 'Org1MSP',
                type:  'X.509',
            };

            await wallet.put(user.id, x509Identity);
            console.log(`  ✓ Enrolled ${user.id}`);
            enrolled++;
        } catch (err) {
            if (err.message.includes('already registered')) {
                // Already registered in CA — just enrol
                try {
                    const enrollment = await ca.enroll({
                        enrollmentID: user.id,
                        enrollmentSecret: user.secret,
                    });
                    const x509Identity = {
                        credentials: {
                            certificate: enrollment.certificate,
                            privateKey:  enrollment.key.toBytes(),
                        },
                        mspId: 'Org1MSP',
                        type:  'X.509',
                    };
                    await wallet.put(user.id, x509Identity);
                    console.log(`  ✓ Re-enrolled ${user.id}`);
                    enrolled++;
                } catch (e2) {
                    console.error(`  ✗ Failed to enrol ${user.id}: ${e2.message}`);
                }
            } else {
                console.error(`  ✗ Failed ${user.id}: ${err.message}`);
            }
        }
    }

    console.log(`\nDone. Enrolled: ${enrolled}, Skipped (already present): ${skipped}`);
}

main().catch(err => {
    console.error('Enrolment failed:', err);
    process.exit(1);
});
