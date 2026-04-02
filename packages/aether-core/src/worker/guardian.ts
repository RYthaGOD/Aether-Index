import { config } from '../config';
import { db } from '../db/client';
import { Connection } from '@solana/web3.js';

/**
 * Socket Guardian (GuardWorker)
 * 
 * Monitors the progression of slots in the Aether Index versus the Solana Mainnet.
 * If a gap is detected (i.e., a webhook was missed), it triggers an audit log
 * for manual or automatic repair.
 */
export class GuardWorker {
    private static connection = new Connection(config.solana.rpcUrl);
    private static lastIndexedSlot = 0;
    private static isRunning = false;

    static async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('🛡️ Socket Guardian Standing Watch...');

        // Initial baseline: Find the highest slot currently in the DB
        // We check the system_metadata first, then fallback to 0
        const result = await db.querySqlite("SELECT value FROM system_metadata WHERE key = 'last_processed_slot'");
        this.lastIndexedSlot = parseInt(result[0]?.value || '0');

        console.log(`[Guardian] Baseline Sync: Starting from slot ${this.lastIndexedSlot}`);

        // Audit every 30 seconds for tighter oversight
        setInterval(() => this.performAudit(), 30 * 1000);
    }

    private static async performAudit() {
        try {
            const currentSlot = await this.connection.getSlot();
            
            // If we've never indexed, we start from now
            if (this.lastIndexedSlot === 0) {
                this.lastIndexedSlot = currentSlot;
                return;
            }

            const gap = currentSlot - this.lastIndexedSlot;

            if (gap > 100) { // Increased threshold slightly for network jitter
                console.warn(`[AUDIT] ⚠️ Gap Detected: ${gap} slots. (Latest: ${currentSlot}, DB: ${this.lastIndexedSlot})`);
                console.warn(`[AUDIT] Recommendation: Run backfill to recover potential missed transactions.`);
            } else if (gap > 0) {
                // We're slightly behind but likely catching up via webhooks
            }

            // Update baseline periodically if we are moving forward
            // (Webhooks should be updating system_metadata, but we use this as a local cache)
            const result = await db.querySqlite("SELECT value FROM system_metadata WHERE key = 'last_processed_slot'");
            const dbSlot = parseInt(result[0]?.value || '0');
            if (dbSlot > this.lastIndexedSlot) {
                this.lastIndexedSlot = dbSlot;
            }
        } catch (err: any) {
            console.error('[Guardian] Audit Cycle Failed:', err.message);
        }
    }
}
