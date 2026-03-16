import axios from 'axios';
import { config, solanaConnection } from '../config';
import { db } from '../db/client';
import { PublicKey } from '@solana/web3.js';

export class IndexManager {
    private static BLUE_CHIP_WHITELIST = [
        'So11111111111111111111111111111111111111112', // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaKERzJ4vki4wS77S8ST2gBfKqv78at9AHXBa', // USDT
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
        'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
        'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
        'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
        'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7', // DRIFT
        'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS'  // KMNO
    ];

    /**
     * Refreshes the top 100 tokens with Dynamic Auto-Discovery.
     */
    static async refreshTop100() {
        console.log('[MarketGuard] Dynamic Auto-Discovery Active. Scanning trending 3rd-party liquidity...');
        const { db } = await import('../db/client');
        try {
            await db.resetTop100(); 
            // await db.resetTokenPools(); // Keep pools but refresh liquidity incrementally 
            
            const discoveredMints = new Set<string>(this.BLUE_CHIP_WHITELIST);
            
            // 1. Dynamic Discovery: Fetch trending Solana tokens (Last 24h)
            try {
                const trendingRes = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1');
                if (trendingRes.data) {
                    trendingRes.data.forEach((t: any) => {
                        if (t.chainId === 'solana') discoveredMints.add(t.tokenAddress);
                    });
                }
            } catch (err) {
                console.warn('[MarketGuard] Trending Discovery Failed, relying on whitelist/fallback.');
            }

            const tokensToIndex = Array.from(discoveredMints);
            console.log(`[MarketGuard] Evaluating ${tokensToIndex.length} potential surveillance targets...`);

            for (const mint of tokensToIndex) {
                try {
                    // Rate limit buffer
                    await new Promise(r => setTimeout(r, 1000));
                    
                    const dexRes = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
                    if (!dexRes.data || !dexRes.data.pairs) continue;

                    const activeDexes = new Set<string>();
                    const pools: any[] = [];

                    dexRes.data.pairs.forEach((p: any) => {
                        const dexId = p.dexId.toLowerCase();
                        if (p.chainId === 'solana' && (p.liquidity?.usd || 0) >= 50000 && ['raydium', 'orca', 'meteora'].includes(dexId)) {
                            activeDexes.add(dexId);
                            pools.push({
                                mint,
                                dex: dexId,
                                poolAddress: p.pairAddress,
                                liquidityUsd: p.liquidity?.usd || 0
                            });
                        }
                    });

                    // Verification: Must exist on at least 2 of our target DEXs for Arb feasibility
                    if (activeDexes.size < 2) continue;

                    // 2. Initial Metadata discovery
                    const { PriceOracle } = await import('./parser');
                    await PriceOracle.resolveTokenMetadata(mint).catch(() => {});

                    // 3. Index Pools
                    for (const pool of pools) {
                        await db.upsertTokenPool(pool);
                    }

                    // 4. Mark as target
                    await db.upsertToken({ 
                        mint,
                        is_top_100: true 
                    } as any);

                    console.log(`[MarketGuard] ⚡ Surveillance LOCKED: ${mint.slice(0, 8)}... (${activeDexes.size} DEXs)`);

                    if (discoveredMints.size > 100 && tokensToIndex.indexOf(mint) > 100) break; // Limit to top tier
                } catch (err) {
                    continue;
                }
            }

            console.log(`✅ [MarketGuard] Successfully synchronized surveillance grid.`);
        } catch (err: any) {
            console.error('[MarketGuard] Top 100 refresh failed:', err.message);
            await this.seedEmergencyList();
        }
    }

    /**
     * Emergency fallback list to ensure the engine has a baseline.
     */
    static async seedEmergencyList() {
        const fallback = [
            { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', decimals: 9 },
            { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USDC', decimals: 6 },
            { mint: 'Es9vMFrzaKERzJ4vki4wS77S8ST2gBfKqv78at9AHXBa', symbol: 'USDT', name: 'USDT', decimals: 6 },
            { mint: 'JUPyiK9yUQCvHksmQGpxp99DqPLtcHkL9LNiY1tSY6t', symbol: 'JUP', name: 'Jupiter', decimals: 6 },
            { mint: 'HZ1J6yEAsV7M3fSg2797A9jUzDPwBeDuRSf5C579Y3o', symbol: 'PYTH', name: 'Pyth Network', decimals: 6 },
            { mint: 'J1t97S6ns77s9Mj8avUMmXmBqAoXAnxbM96gGuk8S9S', symbol: 'JitoSOL', name: 'Jito Staked SOL', decimals: 9 },
            { mint: 'DezXAZ8z7PnrnESnHRjeU96ScH6aiG9G7h6YvEkP8Et7', symbol: 'BONK', name: 'Bonk', decimals: 5 },
            { mint: 'EKpQ77Ut7nAa2vn9HneRS69xbd7DeM1FrFc1FoqEDJ8S', symbol: 'WIF', name: 'dogwifhat', decimals: 6 },
            { mint: 'DriFtupTu76MCD66S7qS67TR96bySgXNC48JfZ7699EB', symbol: 'DRIFT', name: 'Drift', decimals: 6 },
            { mint: 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS', symbol: 'KMNO', name: 'Kamino', decimals: 6 }
        ];
        for (let i = 0; i < fallback.length; i++) {
            await db.upsertToken({ ...fallback[i], rank: i + 1, is_top_100: true });
        }
    }

    /**
     * Proactively discovers the most liquid pools.
     */
    static async discoverBestPools(mint: string) {
        // Implementation already partially covered in refreshTop100 for Raydium
        // Can be expanded here for other DEXs.
    }

    /**
     * Orchestrates the Market Guard initialization.
     */
    static async orchestrate() {
        await this.refreshTop100();
        setInterval(() => this.refreshTop100(), 24 * 60 * 60 * 1000);
    }
}
