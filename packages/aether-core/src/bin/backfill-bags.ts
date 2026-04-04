import { Connection, PublicKey } from '@solana/web3.js';
import { UniversalModule } from '../modules/universal';
import { DBClient } from '../db/client';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

// ⚡ BOOTSTRAP: Disable non-essential services
process.env.DISABLE_REDIS = 'true';

const BAGS_PROGRAMS = [
    {
        id: 'FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK',
        idl: 'bags_fee_share.json',
        name: 'Bags Fee Share V2'
    },
    {
        id: 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN',
        idl: 'bags_launch_dbc.json',
        name: 'Meteora Dynamic Bonding Curve'
    }
];

async function backfillBags() {
    console.log('⚡ Initializing Targeted Backfill for Bags.fm Ecosystem...');
    
    const db = new DBClient();
    await db.init();

    const connection = new Connection(config.solana.rpcUrl);
    const idlDir = path.resolve(process.cwd(), 'data/idls');

    for (const prog of BAGS_PROGRAMS) {
        console.log(`\n📡 [Backfill] Processing ${prog.name} (${prog.id})...`);
        
        const idlPath = path.join(idlDir, prog.idl);
        if (!fs.existsSync(idlPath)) {
            console.error(`❌ IDL not found: ${idlPath}`);
            continue;
        }

        const universal = new UniversalModule(prog.id, idlPath);
        await universal.initialize(db);

        const pubkey = new PublicKey(prog.id);
        
        try {
            console.log(`🔍 Fetching recent signatures for ${prog.id}...`);
            const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 20 });
            
            console.log(`✅ Found ${signatures.length} recent transactions.`);

            for (const sigInfo of signatures) {
                const signature = sigInfo.signature;
                console.log(`   ∟ Indexing: ${signature}...`);

                const tx = await connection.getTransaction(signature, {
                    maxSupportedTransactionVersion: 0,
                    commitment: 'finalized'
                });

                if (tx) {
                    // Enrich tx with slot if missing (UniversalModule uses it)
                    (tx as any).slot = sigInfo.slot;
                    await universal.processTransaction(tx, db);
                }
            }
        } catch (e: any) {
            console.error(`❌ Failed to backfill ${prog.name}:`, e.message);
        }
    }

    console.log('\n================================\n🏆 BAGS BACKFILL COMPLETE\n================================');
    process.exit(0);
}

backfillBags().catch(e => {
    console.error('❌ Critical Backfill Error:', e);
    process.exit(1);
});
