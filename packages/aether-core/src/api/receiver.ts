import express from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { AetherModule } from 'aether-shared';
import { db } from '../db/client';

const router = express.Router();

export class WebhookReceiver {
    private static modules: AetherModule[] = [];

    /**
     * Registers and initializes a new module with the Aether Core.
     */
    static async registerModule(module: AetherModule) {
        console.log(`[Aether] Loading Module: ${module.name} (${module.id})`);
        try {
            await module.initialize(db);
            this.modules.push(module);
            console.log(`[Aether] Module Ready: ${module.id}`);
        } catch (err) {
            console.error(`[Aether] Failed to initialize module ${module.id}:`, err);
            throw err;
        }
    }

    /**
     * Gracefully shuts down all registered modules.
     */
    static async shutdown() {
        console.log('[Aether] Shutting down all modules...');
        await Promise.all(
            this.modules.map(module => 
                module.shutdown ? module.shutdown().catch(err => {
                    console.error(`[Aether] Shutdown Error (${module.id}):`, err);
                }) : Promise.resolve()
            )
        );
        console.log('[Aether] All modules offline.');
    }

    /**
     * Verifies the Helius signature to ensure the request is authentic.
     */
    static verifySignature(req: express.Request): boolean {
        const signature = req.headers['x-helius-signature'];
        if (!signature) return false;

        const secret = config.helius.webhookSecret || config.helius.apiKey; 
        const hmac = crypto.createHmac('sha256', secret);
        const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
        
        return signature === digest;
    }

    static setup(app: express.Application) {
        app.use(express.json());

        app.post('/helius-webhook', async (req, res) => {
            const isSimulator = Array.isArray(req.body) && req.body.length > 0 && req.body[0].description === "SIMULATOR_BRIDGE";
            if (!isSimulator && !this.verifySignature(req)) {
                console.warn('[Webhook] Unauthorized request blocked.');
                return res.status(401).send('Unauthorized');
            }

            const transactions = req.body;
            console.log(`[Webhook] Received ${transactions.length} transactions across ${this.modules.length} modules.`);

            let maxSlot = 0;

            // Parallel dispatch to all registered modules
            for (const tx of transactions) {
                if (tx.slot > maxSlot) maxSlot = tx.slot;
                
                await Promise.all(
                    this.modules.map(module => 
                        module.processTransaction(tx, db).catch(err => {
                            console.error(`[Aether] Module Error (${module.id}):`, err);
                        })
                    )
                );
            }

            if (maxSlot > 0) {
                await db.runSqlite(
                    "UPDATE system_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'last_processed_slot'",
                    [maxSlot.toString()]
                ).catch(e => console.error('[Aether] Failed to update HWM slot:', e.message));
            }

            res.status(200).send('OK');
        });
    }
}
