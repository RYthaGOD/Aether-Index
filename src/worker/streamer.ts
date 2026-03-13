import { solanaConnection, config } from '../config';
import { db } from '../db/client';
import { PriceOracle } from './parser';
import { SocketGuardian } from './guardian';
import axios from 'axios';

export class Streamer {
    private isRunning: boolean = false;
    private guardian: SocketGuardian;

    constructor() {
        this.guardian = new SocketGuardian();
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        console.log('Initializing Sovereign Indexer (Flawless Expansion Mode)...');
        
        // 1. Initialize Database
        await db.init();

        // 2. Warming up the Oracle
        console.log('[Streamer] Initializing Price Oracle...');
        await PriceOracle.refreshSolPrice();
        setInterval(() => PriceOracle.refreshSolPrice(), 60000); // Refresh every minute

        // 3. Start the Socket Guardian (Synthetic gRPC)
        console.log('[Streamer] Launching Socket Guardian...');
        await this.guardian.start();

        console.log('[Streamer] AetherIndex is now LIVE and Sovereign.');
    }

    private metadataQueue: Set<string> = new Set();
    private async queueMetadataEnrichment(mint: string) {
        if (this.metadataQueue.has(mint)) return;
        this.metadataQueue.add(mint);
        
        setTimeout(async () => {
            try {
                console.log(`[Discovery] Enriching Metadata: ${mint}`);
                await PriceOracle.resolveTokenMetadata(mint);
                console.log(`[Discovery] Successfully Enriched/Verified: ${mint}`);
            } catch (err) {
                console.error(`[Discovery] Metadata Enrichment Failed for ${mint}:`, err);
            } finally {
                this.metadataQueue.delete(mint);
            }
        }, 2000); 
    }
}

if (require.main === module) {
    const streamer = new Streamer();
    streamer.start().catch(console.error);
}
