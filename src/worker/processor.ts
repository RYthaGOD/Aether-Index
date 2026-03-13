import { db } from '../db/client';
import { SwapEvent } from './parser';
import { pubsub } from './pubsub';
import { AlphaDiscovery } from './alpha_discovery';

export { pubsub };

export class DataProcessor {
    private static buffer: SwapEvent[] = [];
    private static MAX_BUFFER_SIZE = 10;
    private static FLUSH_INTERVAL = 5000;
    private static flushTimer: NodeJS.Timeout | null = null;

    /**
     * The heart of AetherIndex. 
     * Processes swaps from any source (gRPC, Webhook, WS Fallback) 
     * ensuring consistency and broadcasting live updates.
     */
    static async processSwap(event: SwapEvent) {
        try {
            console.log(`[Processor] Processing ${event.dex.toUpperCase()} swap: ${event.signature.slice(0, 8)}...`);

            // 1. Reactive Metadata Discovery
            // Check if tokens involved are known; if not, resolve in background
            const { PriceOracle } = await import('./parser');
            for (const mint of [event.tokenIn, event.tokenOut]) {
                const exists = await db.tokenExists(mint);
                if (!exists) {
                    console.log(`[Processor] Unknown token detected: ${mint}. Triggering resolution...`);
                    PriceOracle.resolveTokenMetadata(mint).catch(() => {});
                }
            }

            // 2. Persistence (SQLite is Instant, DuckDB is Batched)
            await db.insertSwapToSQLite(event);
            this.buffer.push(event);

            if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
                await this.flushBuffer();
            } else if (!this.flushTimer) {
                this.flushTimer = setTimeout(() => this.flushBuffer(), this.FLUSH_INTERVAL);
            }

            // 3. Real-time Broadcast
            await pubsub.publish('SWAP_UPDATED', { newSwap: event });
            // ... broadcast logic continues
            return true;
        } catch (err) {
            console.error('[Processor] Failed to process swap:', err);
            return false;
        }
    }

    private static async flushBuffer() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.buffer.length === 0) return;

        const toFlush = [...this.buffer];
        this.buffer = [];

        try {
            console.log(`[Processor] Flushing ${toFlush.length} swaps to DuckDB...`);
            await db.insertToDuckDB(toFlush);
        } catch (err) {
            console.error('[Processor] DuckDB Flush failed:', err);
            // In a real sovereign system, we'd handle retry/recovery here
        }
    }
}
