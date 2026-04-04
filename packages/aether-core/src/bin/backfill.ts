// ══════════════════════════════════════════════════
//  Aether Indexer — Historical Backfill Engine
//  Purpose: Indexing real transactions from the 2026 Drift Exploit
// ══════════════════════════════════════════════════

// ⚡ BOOTSTRAP: Disable non-essential services before imports
process.env.DISABLE_REDIS = 'true';

import { Connection, PublicKey } from '@solana/web3.js';
import { UniversalModule } from '../modules/universal';
import { DBClient } from '../db/client';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const DRIFT_EXPLOIT_SIGNATURES = [
    'wRTDSevNZnGCCXhk6mwaybFTDo2vYXH9EDtzguSL7aduaU3KJ75AhDh5hBUDCZRM341e1tZjBpDNxaU7goRQECY',
    '65owRq37Esd1d1K4Pnr1nx83uuLkd9F2mysL1gDGKK7iNa8LyxDZy845t3mpm6kbmcHNcc8gubXqCSZz9HHAcoRW',
    '39yxuUrUkbHUuV4EaQ3KFQvGxCuD7MdMcYaAmaqUe3Mu1wLEwJzSJiESPpttXRbMQxi9qSUzjtQr4rBnADoN5rXa'
];

async function backfill() {
    console.log('⚡ Initializing Historical Backfill for the Drift Exploit...');
    
    const db = new DBClient();
    await db.init();

    const connection = new Connection(config.solana.rpcUrl);
    
    // Bit-perfect monorepo path resolution
    const idlPath = path.resolve(__dirname, '../../data/idls/dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH.json');
    
    if (!fs.existsSync(idlPath)) {
        console.error(`❌ Drift IDL not found at: ${idlPath}`);
        process.exit(1);
    }

    const universal = new UniversalModule('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', idlPath);
    
    // DEBUG: Identify the 'params' collision in the bit-perfect manifest
    const idlStr = fs.readFileSync(idlPath, 'utf8');
    if (idlStr.includes('"params"') || idlStr.includes(': "params"')) {
        console.log('📡 [DEBUG] "params" manifest detected in raw IDL.');
    }

    await universal.initialize(db);

    for (const signature of DRIFT_EXPLOIT_SIGNATURES) {
        console.log(`📡 Recovering signature: ${signature}...`);
        
        try {
            const tx = await connection.getTransaction(signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'finalized'
            });

            if (tx) {
                await universal.processTransaction(tx, db);
                console.log(`✅ Bit-perfectly indexed Drift historical signature.`);
            } else {
                console.warn(`⚠️ Signature ${signature} not found in historical logs.`);
            }
        } catch (e) {
            console.error(`❌ Failed to recover signature ${signature}:`, e);
        }
    }

    console.log('\n================================\n🏆 REAL-WORLD BACKFILL COMPLETE\n================================');
    process.exit(0);
}

backfill().catch(e => {
    console.error('❌ Critical Backfill Error:', e);
    process.exit(1);
});
