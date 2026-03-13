import { solanaConnection } from '../config';
import { SwapParser } from '../worker/parser';
import { DataProcessor } from '../worker/processor';
import { PublicKey } from '@solana/web3.js';

/**
 * Sovereign Re-Sync CLI.
 * Allows force-re-synching specific slot ranges if the indexer was offline.
 * Makes the system a source of truth that can reconstruct state.
 */
async function backfill(startSlot: number, endSlot: number) {
    console.log(`--- Sovereign Re-Sync Started: Slot ${startSlot} to ${endSlot} ---`);
    
    const PARALLEL_BATCH_SIZE = 5;

    for (let slot = startSlot; slot <= endSlot; slot += PARALLEL_BATCH_SIZE) {
        const batchEnd = Math.min(slot + PARALLEL_BATCH_SIZE - 1, endSlot);
        console.log(`[Backfill] Syncing Slots: ${slot} -> ${batchEnd}...`);

        const promises = [];
        for (let s = slot; s <= batchEnd; s++) {
            promises.push((async (targetSlot: number) => {
                try {
                    const block = await solanaConnection.getParsedBlock(targetSlot, {
                        maxSupportedTransactionVersion: 0,
                        commitment: 'confirmed'
                    });

                    if (block && block.transactions) {
                        let swapCount = 0;
                        for (const tx of block.transactions) {
                            const swaps = await SwapParser.parseTransaction(tx as any);
                            for (const swap of swaps) {
                                await DataProcessor.processSwap(swap);
                                swapCount++;
                            }
                        }
                        console.log(`[Backfill] Slot ${targetSlot}: Processed ${swapCount} swaps.`);
                    }
                } catch (err: any) {
                    if (err.message.includes('not found') || err.message.includes('skipped')) {
                        // Expected for skipped slots
                    } else {
                        console.warn(`[Backfill] Slot ${targetSlot} Error:`, err.message);
                    }
                }
            })(s));
        }

        await Promise.all(promises);
    }

    console.log('✅ Sovereign Re-Sync Complete.');
    process.exit(0);
}

const args = process.argv.slice(2);
const start = parseInt(args[0]);
const end = parseInt(args[1]);

if (isNaN(start) || isNaN(end)) {
    console.log('Usage: npx ts-node src/cli/backfill.ts <startSlot> <endSlot>');
    process.exit(1);
}

backfill(start, end).catch(err => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
});
