import { ParsedTransactionWithMeta, Partials } from '@solana/web3.js';
import { solanaConnection } from '../config';

export interface SwapEvent {
    signature: string;
    slot: number;
    blockTime: Date;
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    amountOut: number;
    priceUsd: number;
    maker: string;
    dex: 'raydium' | 'jupiter' | 'orca';
}

export class SwapParser {
    /**
     * Parses a Solana transaction for swap events.
     * Implements cross-reference validation (Logs vs Account Changes).
     */
    static async parseTransaction(tx: ParsedTransactionWithMeta): Promise<SwapEvent[]> {
        const events: SwapEvent[] = [];
        const signature = tx.transaction.signatures[0];
        const slot = tx.slot;
        const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();

        // 1. Audit Logs for DEX markers
        const logs = tx.meta?.logMessages || [];
        const isRaydium = logs.some(log => log.includes('raydium_amm'));
        const isJupiter = logs.some(log => log.includes('Jupiter'));
        const isOrca = logs.some(log => log.includes('whirlpool'));

        if (!isRaydium && !isJupiter && !isOrca) return [];

        // 2. Identify Token Balance Changes (The "Source of Truth")
        const preTokenBalances = tx.meta?.preTokenBalances || [];
        const postTokenBalances = tx.meta?.postTokenBalances || [];

        // Simplified logic: Find the dominant token movement
        // In a production environment, we'd more precisely map these using inner instructions.
        const tokenChanges = postTokenBalances.map(post => {
            const pre = preTokenBalances.find(p => p.accountIndex === post.accountIndex && p.mint === post.mint);
            const preAmount = pre ? Number(pre.uiTokenAmount.amount) : 0;
            const postAmount = Number(post.uiTokenAmount.amount);
            return {
                mint: post.mint,
                owner: post.owner,
                change: (postAmount - preAmount) / Math.pow(10, post.uiTokenAmount.decimals),
                decimals: post.uiTokenAmount.decimals
            };
        }).filter(c => Math.abs(c.change) > 0);

        if (tokenChanges.length < 2) return [];

        // 3. Resolve Swap (In vs Out)
        const tokenOut = tokenChanges.find(c => c.change > 0);
        const tokenIn = tokenChanges.find(c => c.change < 0);

        if (tokenIn && tokenOut) {
            events.push({
                signature,
                slot,
                blockTime,
                tokenIn: tokenIn.mint,
                tokenOut: tokenOut.mint,
                amountIn: Math.abs(tokenIn.change),
                amountOut: tokenOut.change,
                priceUsd: 0, // Will be resolved by the price engine later
                maker: tx.transaction.message.accountKeys[0].pubkey.toString(),
                dex: isRaydium ? 'raydium' : isJupiter ? 'jupiter' : 'orca'
            });
        }

        return events;
    }
}
