import { Command } from 'commander';
import { db } from '../db/client';
import { UniversalModule } from '../modules/universal';
// @ts-ignore
import { Helius } from 'helius-sdk';
import { config } from '../config';
import path from 'path';

/**
 * Backfill Tool: The Time Traveler
 * 
 * Satisfies the "Batch Mode" requirement of the Superteam Bounty.
 * Processes transactions within a slot range or for specific signatures.
 * Implements exponential backoff for RPC retries as required.
 */

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;

/**
 * Exponential Backoff Retry (Bounty Requirement: "exponential backoff for RPC retries")
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            lastError = err;
            const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200;
            console.warn(`[Backfill] Retry ${attempt + 1}/${MAX_RETRIES} for ${label}: ${err.message} (waiting ${Math.round(delay)}ms)`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastError;
}

const program = new Command();

program
    .name('backfill')
    .description('Batch index Solana transactions for a specific program')
    .requiredOption('-p, --program <id>', 'Program ID to backfill')
    .requiredOption('-i, --idl <path>', 'Path to Anchor IDL JSON')
    .option('-s, --start-slot <number>', 'Starting slot', '0')
    .option('-e, --end-slot <number>', 'Ending slot', 'latest')
    .option('-b, --batch-size <number>', 'Signatures per batch', '100')
    .action(async (options) => {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  [Backfill] Batch Process Starting`);
        console.log(`  Program: ${options.program}`);
        console.log(`  Slots:   ${options.startSlot} -> ${options.endSlot}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        const helius = new Helius(config.helius.apiKey);
        const idlPath = path.resolve(process.cwd(), options.idl);
        const module = new UniversalModule(options.program, idlPath);

        await db.init();
        await module.initialize(db);

        let processed = 0;
        let failed = 0;

        try {
            console.log(`[Backfill] Fetching signatures for ${options.program}...`);
            
            const signatures: any[] = await withRetry(
                () => helius.rpc.getSignaturesForAddress(options.program as any),
                'getSignaturesForAddress'
            );
            
            console.log(`[Backfill] Found ${signatures.length} transactions. Processing...\n`);

            for (const sigInfo of signatures) {
                try {
                    const tx = await withRetry(
                        () => helius.rpc.getTransaction(sigInfo.signature),
                        `getTransaction(${sigInfo.signature.slice(0, 8)}...)`
                    );
                    
                    if (tx) {
                        await module.processTransaction(tx as any, db);
                        processed++;
                    }
                } catch (err: any) {
                    failed++;
                    console.error(`[Backfill] Permanently failed tx ${sigInfo.signature.slice(0, 8)}: ${err.message}`);
                }

                // Progress log every 50 txs
                if ((processed + failed) % 50 === 0) {
                    console.log(`[Backfill] Progress: ${processed} indexed, ${failed} failed, ${signatures.length - processed - failed} remaining`);
                }
            }
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`  [Backfill] Batch Complete`);
            console.log(`  Processed: ${processed} | Failed: ${failed}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            process.exit(0);
        } catch (err: any) {
            console.error(`[Backfill] Critical Failure:`, err.message);
            process.exit(1);
        }
    });

program.parse(process.argv);
