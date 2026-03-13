import { ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
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
    dex: string;
}

export class PriceOracle {
    private static solPriceUsd: number = 150; // Initial fallback, will be updated by refreshSolPrice
    private static SOL_MINT = 'So11111111111111111111111111111111111111112';
    private static USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    /**
     * Updates SOL price from a reliable source (Raydium SOL/USDC pool).
     * Uses the pool's token balance ratio for a trustless on-chain price.
     */
    static async refreshSolPrice() {
        try {
            // SOL/USDC Raydium Pool (OpenBook)
            const SOL_USDC_POOL = new PublicKey('58oQChx4yWmvKtnvZisPghYmoD6pYat8BfH6HEnToAtW');
            const accountInfo = await solanaConnection.getAccountInfo(SOL_USDC_POOL);
            
            if (accountInfo) {
                // Raydium V4 Layout decoding
                // Layout: baseReserve (offset 432, 8 bytes), quoteReserve (offset 440, 8 bytes)
                // Decimals: SOL (9), USDC (6)
                const baseReserve = accountInfo.data.readBigUInt64LE(432);
                const quoteReserve = accountInfo.data.readBigUInt64LE(440);
                
                const solAmount = Number(baseReserve) / 1e9;
                const usdcAmount = Number(quoteReserve) / 1e6;
                
                this.solPriceUsd = usdcAmount / solAmount;
                console.log(`[Oracle] Trustless SOL Price: $${this.solPriceUsd.toFixed(2)}`);
            }
        } catch (err) {
            console.error('[Oracle] Price refresh failed:', err);
        }
    }

    /**
     * Calculates the USD price of a swap event dynamically.
     * Uses SOL or USDC as the base for triangulation.
     */
    static resolvePrice(event: Partial<SwapEvent>): number {
        if (!event.amountIn || !event.amountOut) return 0;
        
        if (event.tokenIn === this.USDC_MINT) {
            return event.amountIn / event.amountOut;
        }
        if (event.tokenOut === this.USDC_MINT) {
            return event.amountIn / event.amountOut;
        }
        if (event.tokenIn === this.SOL_MINT) {
            const priceInSol = event.amountIn / event.amountOut;
            return priceInSol * this.solPriceUsd;
        }
        if (event.tokenOut === this.SOL_MINT) {
            const priceInSol = event.amountIn / event.amountOut;
            return priceInSol * this.solPriceUsd;
        }
        return 0;
    }
}

export class SwapParser {
    /**
     * Parses a Solana transaction for swap events.
     * Enhanced to support Token-2022 and major DEX programs.
     */
    static async parseTransaction(tx: ParsedTransactionWithMeta): Promise<SwapEvent[]> {
        const events: SwapEvent[] = [];
        const signature = tx.transaction.signatures[0];
        const slot = tx.slot;
        const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();

        // 1. Audit Logs for DEX markers
        const logs = tx.meta?.logMessages || [];
        const isRaydium = logs.some(log => log.includes('raydium_amm'));
        const isJupiter = logs.some(log => log.includes('Jupiter') || log.includes('JUP6LkbZbZ9zaS8fXmBaWpHiPshNreDks5DWB6E9p6v'));
        const isOrca = logs.some(log => log.includes('whirlpool'));
        const isPhoenix = logs.some(log => log.includes('Phx21u2vY2q7mS1mlT9Y66id2YCcSp7A6iXmG4YY6Yd'));
        const isMeteora = logs.some(log => log.includes('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo') || log.includes('meteora'));

        if (!isRaydium && !isJupiter && !isOrca && !isPhoenix && !isMeteora) return [];

        // 2. Identify Token Balance Changes (Source of Truth)
        // Works for both SPL and Token-2022 since RPC parses both into postTokenBalances.
        const preTokenBalances = tx.meta?.preTokenBalances || [];
        const postTokenBalances = tx.meta?.postTokenBalances || [];

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
            const event: SwapEvent = {
                signature,
                slot,
                blockTime,
                tokenIn: tokenIn.mint,
                tokenOut: tokenOut.mint,
                amountIn: Math.abs(tokenIn.change),
                amountOut: tokenOut.change,
                priceUsd: 0,
                maker: tx.transaction.message.accountKeys[0].pubkey.toString(),
                dex: isRaydium ? 'raydium' : isJupiter ? 'jupiter' : isOrca ? 'orca' : isMeteora ? 'meteora' : 'jupiter'
            };
            
            event.priceUsd = PriceOracle.resolvePrice(event);
            events.push(event);
        }

        return events;
    }
}
