import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { config, solanaConnection } from '../config';
import { SwapParser } from './parser';
import { db } from '../db/client';

export class SocketGuardian {
    private connections: Connection[] = [];
    private seenSignatures: Set<string> = new Set();
    private lastSlot: number = 0;
    private isRunning: boolean = false;
    private signatureCacheTTL = 60000; // 60 seconds

    constructor() {
        // Initialize main connection
        this.connections.push(solanaConnection);
        
        // Initialize secondary connections for redundancy
        for (const source of config.solana.secondarySources) {
            console.log(`[Guardian] Adding redundant source: ${source.rpc}`);
            this.connections.push(new Connection(source.rpc, {
                wsEndpoint: source.ws,
                commitment: 'confirmed'
            }));
        }
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`[Guardian] Starting with ${this.connections.length} sources...`);

        // 1. Listen for Slots (Gap Detection)
        this.connections[0].onSlotChange(async (slotInfo) => {
            const currentSlot = slotInfo.slot;
            if (this.lastSlot && currentSlot > this.lastSlot + 1) {
                const gap = currentSlot - this.lastSlot - 1;
                console.warn(`[Guardian] GAP DETECTED: ${gap} slots missed (${this.lastSlot} -> ${currentSlot}). Patching...`);
                await this.patchGaps(this.lastSlot + 1, currentSlot - 1);
            }
            this.lastSlot = currentSlot;
        });

        // 2. Multi-Source Log Subscription (Parallel Redundancy)
        const DEX_PROGRAMS = [
            '675k1q2u71c6u2kzjd5L54Vf7U2z6u64f8D22C1u66v', // Raydium
            'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpool
            'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', // Meteora DLMM
            'JUP6LkbZbZ9zaS8fXmBaWpHiPshNreDks5DWB6E9p6v', // Jupiter
        ];

        for (const conn of this.connections) {
            for (const programId of DEX_PROGRAMS) {
                conn.onLogs(new PublicKey(programId), async (logs) => {
                    if (this.seenSignatures.has(logs.signature)) return;
                    
                    this.seenSignatures.add(logs.signature);
                    setTimeout(() => this.seenSignatures.delete(logs.signature), this.signatureCacheTTL);

                    await this.processSignature(logs.signature);
                }, 'confirmed');
            }
        }
    }

    private async fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        try {
            return await fn();
        } catch (err: any) {
            if (retries > 0 && (err.message.includes('429') || err.message.includes('Rate limit'))) {
                console.warn(`[Guardian] Rate limited. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetchWithRetry(fn, retries - 1, delay * 2);
            }
            throw err;
        }
    }

    private async processSignature(signature: string) {
        try {
            const tx = await this.fetchWithRetry(() => solanaConnection.getParsedTransaction(signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            }));

            if (!tx) return;
            const events = await SwapParser.parseTransaction(tx);
            
            for (const event of events) {
                console.log(`[Guardian] NEW SWAP [${event.dex}]: ${event.amountIn} ${event.tokenIn} -> ${event.amountOut} ${event.tokenOut}`);
                await db.insertSwapToSQLite(event);
                await db.insertToDuckDB([event]);
            }
        } catch (err: any) {
            console.error(`[Guardian] Error processing ${signature}:`, err.message);
        }
    }

    private async patchGaps(startSlot: number, endSlot: number) {
        try {
            console.log(`[Guardian] Requesting block range ${startSlot} to ${endSlot} for gap patching...`);
            const programs = [
                new PublicKey('675k1q2u71c6u2kzjd5L54Vf7U2z6u64f8D22C1u66v'), // Raydium
                new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'), // Orca
                new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo')  // Meteora
            ];

            for (const program of programs) {
                // Dynamic Limit calculation: 2x gap size to oversample and ensure coverage
                // Minimum 50, Maximum 1000 (Institutional Safety Guard)
                const dynamicLimit = Math.min(Math.max((endSlot - startSlot) * 2, 50), 1000);
                
                console.log(`[Guardian] Dynamic patch depth for ${program.toBase58().slice(0, 8)}...: ${dynamicLimit}`);
                const sigs = await this.fetchWithRetry(() => solanaConnection.getSignaturesForAddress(program, { limit: dynamicLimit }));
                
                for (const s of sigs) {
                    if (s.slot >= startSlot && s.slot <= endSlot && !this.seenSignatures.has(s.signature)) {
                        console.log(`[Guardian] PATCHING MISSED TX: ${s.signature} (Slot: ${s.slot})`);
                        this.seenSignatures.add(s.signature);
                        setTimeout(() => this.seenSignatures.delete(s.signature), this.signatureCacheTTL);
                        await this.processSignature(s.signature);
                    }
                }
            }
        } catch (err: any) {
            console.error(`[Guardian] Gap patching failed:`, err.message);
        }
    }
}
