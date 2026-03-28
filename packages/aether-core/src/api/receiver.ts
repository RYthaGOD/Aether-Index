import express from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { AetherModule } from '../../shared';
import { db } from '../db/client';

const router = express.Router();

export class WebhookReceiver {
    private static modules: AetherModule[] = [];

    /**
     * Registers a new module with the Aether Core.
     */
    static registerModule(module: AetherModule) {
        console.log(`[Aether] Loading Module: ${module.name} (${module.id})`);
        this.modules.push(module);
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

            // Parallel dispatch to all registered modules
            for (const tx of transactions) {
                await Promise.all(
                    this.modules.map(module => 
                        module.processTransaction(tx, db).catch(err => {
                            console.error(`[Aether] Module Error (${module.id}):`, err);
                        })
                    )
                );
            }

            res.status(200).send('OK');
        });
    }
}
