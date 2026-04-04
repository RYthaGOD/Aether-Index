import { BorshInstructionCoder } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

// ══════════════════════════════════════════════════
//  Aether Indexer — Isolation Error Auditor
//  Purpose: Pinpointing the exact instruction causing IDL collisions
// ══════════════════════════════════════════════════

const idlPath = path.resolve(__dirname, '../../data/idls/dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH.json');

async function isolate() {
    console.log(`⚡ Isolating Drift IDL Collision: ${idlPath}...`);
    
    if (!fs.existsSync(idlPath)) {
        process.exit(1);
    }

    const fullIdl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    
    for (const ix of fullIdl.instructions || []) {
        try {
            // Test each instruction individually to find the culprit
            const subIdl = { ...fullIdl, instructions: [ix] };
            new BorshInstructionCoder(subIdl);
        } catch (err: any) {
            console.error(`❌ Collision detected in instruction: ${ix.name}`);
            console.error(`Field manifest: ${JSON.stringify(ix.args, null, 2)}`);
            console.error(`Error: ${err.message}`);
            // We found our target
            process.exit(1);
        }
    }

    console.log('✅ All instructions bit-perfectly compatible with coder.');
}

isolate();
