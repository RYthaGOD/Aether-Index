import axios from 'axios';
import { config, solanaConnection } from '../config';
import { db } from '../db/client';
import { PublicKey } from '@solana/web3.js';

export class IndexManager {
    private static RAYDIUM_TOP_POOLS_URL = 'https://api-v3.raydium.io/pools/info/list?poolType=all&poolSortField=volume24h&sortType=desc&pageSize=100&page=1';

    /**
     * Refreshes the top 100 tokens.
     * Uses Raydium's top pools by 24h volume as a high-fidelity proxy for Solana's top tokens.
     */
    static async refreshTop100() {
        console.log('[MarketGuard] Refreshing top 100 tokens via Raydium...');
        try {
            const response = await axios.get(this.RAYDIUM_TOP_POOLS_URL);
            if (!response.data.success || !response.data.data || !Array.isArray(response.data.data.data)) {
                throw new Error('Invalid response format from Raydium API');
            }

            const pools = response.data.data.data;
            const uniqueMints = new Set<string>();
            const tokensToIndex: any[] = [];

            for (const pool of pools) {
                if (uniqueMints.size >= 100) break;
                
                // Get both mints from the pool
                const mints = [pool.mintA.address, pool.mintB.address];
                
                for (const mint of mints) {
                    if (uniqueMints.size >= 100) break;
                    if (uniqueMints.has(mint)) continue;
                    
                    // Skip common stablecoins/SOL for ranking if preferred, or just index everything
                    uniqueMints.add(mint);
                    
                    const tokenInfo = mint === pool.mintA.address ? pool.mintA : pool.mintB;
                    tokensToIndex.push({
                        mint,
                        symbol: tokenInfo.symbol || 'IDK',
                        name: tokenInfo.name || 'Unknown Token',
                        decimals: tokenInfo.decimals || 9,
                        rank: uniqueMints.size
                    });
                }
                
                // Also cache this pool immediately as it's clearly a liquid one
                await db.upsertTokenPool({
                    mint: pool.mintA.address,
                    dex: 'Raydium',
                    poolAddress: pool.id,
                    liquidityUsd: pool.tvl || 0
                });
                await db.upsertTokenPool({
                    mint: pool.mintB.address,
                    dex: 'Raydium',
                    poolAddress: pool.id,
                    liquidityUsd: pool.tvl || 0
                });
            }

            for (const token of tokensToIndex) {
                // 1. Initial Metadata discovery for extra fidelity
                const { PriceOracle } = await import('./parser');
                await PriceOracle.resolveTokenMetadata(token.mint);

                // 2. Mark as top 100 and set rank
                await db.upsertToken({ 
                    ...token,
                    is_top_100: true 
                });
            }

            console.log(`✅ [MarketGuard] Successfully indexed top ${tokensToIndex.length} tokens via Raydium.`);
        } catch (err: any) {
            console.error('[MarketGuard] Top 100 refresh failed:', err.message);
            // Fallback to hardcoded list if all APIs fail
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
            { mint: 'JUPyiK9yUQCvHksmQGpxp99DqPLtcHkL9LNiY1tSY6t', symbol: 'JUP', name: 'Jupiter', decimals: 6 }
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
