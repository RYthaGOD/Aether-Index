import axios from 'axios';
import { config } from '../config';

export class WebhookManager {
    private static HELIUS_API_URL = 'https://api.helius.xyz/v0/webhooks';

    /**
     * Automatically registers or updates the Helius webhook on startup.
     * Ensures the "Sovereign" indexer is zero-config.
     */
    static async orchestrate() {
        if (!config.helius.apiKey || !config.helius.webhookUrl) {
            console.log('[WebhookManager] Missing credentials, skipping orchestration.');
            return;
        }

        try {
            const { data: existingWebhooks } = await axios.get(`${this.HELIUS_API_URL}?api-key=${config.helius.apiKey}`);
            
            const existing = existingWebhooks.find((w: any) => w.webhookURL === config.helius.webhookUrl);

            const webhookConfig = {
                webhookURL: config.helius.webhookUrl,
                transactionTypes: ["ANY"],
                accountAddresses: [
                    'GtmN6x2aPYq6LkbJTj1qxm5Jn6zGQNWsgG9NFnx1QaEu', // Seeker Swarm (Librarian)
                    'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', // Kamino KLend V2
                    'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo', // Save (Solend)
                    'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d', // Metaplex Core
                    'SySTEM1eSU2p4BGQfQpimFEWWSC1XDFeun3Nqzz3rT7'  // Light System (ZK)
                ],
                webhookType: "enhanced"
            };

            if (existing) {
                console.log('[WebhookManager] Updating existing webhook...');
                await axios.put(`${this.HELIUS_API_URL}/${existing.webhookID}?api-key=${config.helius.apiKey}`, webhookConfig);
            } else {
                console.log('[WebhookManager] Creating new production webhook...');
                await axios.post(`${this.HELIUS_API_URL}?api-key=${config.helius.apiKey}`, webhookConfig);
            }
            
            console.log('✅ Helius Webhook Orchestrated Successfully.');
        } catch (err: any) {
            console.error('[WebhookManager] Orchestration failed:', err.response?.data || err.message);
        }
    }
}
