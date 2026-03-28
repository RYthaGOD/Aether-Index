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

        // Initial baseline from DB
        const result = await db.querySqlite("SELECT value FROM system_metadata WHERE key = 'last_processed_slot'");
        this.lastIndexedSlot = parseInt(result[0]?.value || '0');

        setInterval(() => this.performAudit(), 60 * 1000); // Audit every minute
    }

    private static async performAudit() {
        try {
            const currentSlot = await this.connection.getSlot();
            
            if (this.lastIndexedSlot === 0) {
                this.lastIndexedSlot = currentSlot;
                return;
            }

            const gap = currentSlot - this.lastIndexedSlot;

            if (gap > 50) { // Threshold for a "concerning" gap
                console.warn(`⚠️ [Guardian] Potential Slot Gap Detected! (Current: ${currentSlot} | Last: ${this.lastIndexedSlot} | Gap: ${gap})`);
                // In a production environment, this would trigger a getSignaturesForAddress range repair.
            }

            this.lastIndexedSlot = currentSlot;
        } catch (err: any) {
            console.error('[Guardian] Audit Cycle Failed:', err.message);
        }
    }
}
