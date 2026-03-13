import { SwapParser, PriceOracle } from '../worker/parser';
import { db } from '../db/client';
import { PublicKey } from '@solana/web3.js';

async function verifyAll() {
    console.log('🛡️ Starting AetherIndex Claims Verification...\n');

    // 1. Verify Price Oracle Triangulation
    console.log('[1/4] Verifying Price Oracle...');
    const mockEvent = {
        tokenIn: 'So11111111111111111111111111111111111111112', // SOL
        tokenOut: 'NewTokenMint1111111111111111111111111111', 
        amountIn: 10,   // 10 SOL
        amountOut: 1000 // 1000 NewToken
    };
    const price = PriceOracle.resolvePrice(mockEvent as any);
    console.log(`Resolved Price: $${price} (Expected: $0.20 if SOL=$20)`);
    if (price === 0.2) {
        console.log('✅ Price Oracle Claim Verified.');
    } else {
        console.log('❌ Price Oracle Claim Failed.');
    }

    // 2. Verify Swap Parser (DEX & Token-2022 Awareness)
    console.log('\n[2/4] Verifying Swap Parser...');
    const mockTx: any = {
        slot: 123456789,
        transaction: {
            signatures: ['MockSignature111111111111111111111111111111111'],
            message: { accountKeys: [{ pubkey: 'MakerPubkey111111111111111111111111111111' }] }
        },
        meta: {
            logMessages: ['Program JUP6LkbZbZ9zaS8fXmBaWpHiPshNreDks5DWB6E9p6v invoke [1]', 'Jupiter swap success'],
            preTokenBalances: [
                { accountIndex: 1, mint: 'So11111111111111111111111111111111111111112', uiTokenAmount: { amount: '100', decimals: 9 } },
                { accountIndex: 2, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { amount: '0', decimals: 6 } }
            ],
            postTokenBalances: [
                { accountIndex: 1, mint: 'So11111111111111111111111111111111111111112', uiTokenAmount: { amount: '90', decimals: 9 } },
                { accountIndex: 2, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { amount: '200000000', decimals: 6 } }
            ]
        }
    };

    const events = await SwapParser.parseTransaction(mockTx);
    console.log(`Parsed ${events.length} events from Jupiter log.`);
    if (events.length > 0 && events[0].dex === 'jupiter') {
        console.log('✅ Swap Parser Claim Verified (Jupiter detected).');
    } else {
        console.log('❌ Swap Parser Claim Failed.');
    }

    // 3. Verify Database Persistence & Search
    console.log('\n[3/4] Verifying DB Persistence & Search...');
    await db.init();
    const tokenMetadata = {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6
    };
    await db.upsertToken(tokenMetadata);
    const results: any = await db.searchTokens('USDC');
    if (results.length > 0 && results[0].symbol === 'USDC') {
        console.log('✅ Database Registry & Search Claim Verified.');
    } else {
        console.log('❌ Database Claim Failed.');
    }

    // 4. Verify Batch Persistence (DuckDB)
    console.log('\n[4/4] Verifying DuckDB Batching...');
    try {
        await db.insertToDuckDB(events);
        console.log('✅ DuckDB Batch Insert Claim Verified.');
    } catch (err) {
        console.log('❌ DuckDB Batch Insert Failed:', err);
    }

    console.log('\n-------------------------------------------');
    console.log('🏁 Verification Complete. Rykiri Out. ⚡');
    process.exit(0);
}

verifyAll().catch(err => {
    console.error('Fatal Verification Error:', err);
    process.exit(1);
});
