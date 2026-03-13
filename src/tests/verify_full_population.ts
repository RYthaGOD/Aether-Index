import { DataProcessor } from '../worker/processor';
import { db } from '../db/client';
import { SwapEvent } from '../worker/parser';

async function verifyFullPopulation() {
    console.log('--- Sovereign Full Population Verification ---');

    // 1. Initialize DB
    await db.init();

    // 2. Prepare an Unknown Token Swap (BONK)
    const bonkMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixeb6V3BfYfuifit6DH8';
    
    // Clear it first to ensure we test resolution
    await new Promise(r => (db as any).sqlite.run('DELETE FROM tokens WHERE address = ?', bonkMint, r));
    await new Promise(r => (db as any).duckdbCon.run('DELETE FROM tokens WHERE mint = ?', bonkMint, r));

    const mockSwap: SwapEvent = {
        signature: 'TEST_SIG_FULL_' + Date.now(),
        slot: 12345679,
        blockTime: new Date(),
        tokenIn: 'So11111111111111111111111111111111111111112', // SOL
        tokenOut: bonkMint,
        amountIn: 1,
        amountOut: 1000000,
        priceUsd: 0.000025,
        maker: 'Tester1111111111111111111111111111111111',
        dex: 'Raydium'
    };

    console.log(`Simulating swap for unknown token: ${bonkMint} (BONK)...`);
    await DataProcessor.processSwap(mockSwap);

    console.log('Verifying registries...');

    // 3. Verify SQLite
    console.log('Checking SQLite Token Registry...');
    const sqliteToken: any = await new Promise((resolve) => {
        (db as any).sqlite.get('SELECT * FROM tokens WHERE address = ?', [bonkMint], (err: any, row: any) => resolve(row));
    });

    if (sqliteToken) {
        console.log(`✅ SQLite Populated: ${sqliteToken.name} (${sqliteToken.symbol})`);
    } else {
        console.error('❌ SQLite Population Failed: Token not found.');
    }

    // 4. Verify DuckDB
    console.log('Checking DuckDB Token Registry...');
    const duckdbToken: any = await new Promise((resolve) => {
        (db as any).duckdbCon.all('SELECT * FROM tokens WHERE mint = ?', [bonkMint], (err: any, rows: any) => resolve(rows?.[0]));
    });

    if (duckdbToken) {
        console.log(`✅ DuckDB Populated: ${duckdbToken.name} (${duckdbToken.symbol})`);
    } else {
        console.error('❌ DuckDB Population Failed: Token not found.');
    }

    // 5. Verify swap record in DuckDB
    console.log('Checking DuckDB analytical views...');
    const swapCheck: any = await new Promise((resolve) => {
        (db as any).duckdbCon.all("SELECT * FROM raw_swaps WHERE signature = ?", mockSwap.signature, (err: any, rows: any) => resolve(rows?.[0]));
    });

    if (swapCheck) {
        console.log('✅ DuckDB Analytical Records Verified.');
    } else {
        console.error('❌ DuckDB Analytical Records missing.');
    }

    process.exit(sqliteToken && duckdbToken && swapCheck ? 0 : 1);
}

verifyFullPopulation().catch(err => {
    console.error('❌ Verification Error:', err);
    process.exit(1);
});
