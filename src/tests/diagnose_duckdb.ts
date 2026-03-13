import { db } from '../db/client';

async function diagnoseDuckDB() {
    console.log('--- DuckDB Diagnostic Tool ---');
    await db.init();
    
    // Using JUP (Mercury) - Top 100 token
    const testMint = 'JUPyiK9yUQCvHksmQGpxp99DqPLtcHkL9LNiY1tSY6t'; 
    console.log(`Attempting to upsert Top 100 token: ${testMint}`);
    
    await db.upsertToken({
        mint: testMint,
        symbol: 'JUP',
        name: 'Jupiter',
        decimals: 6,
        is_top_100: true,
        rank: 1
    });
    
    console.log('Checking DuckDB tokens table content...');
    return new Promise<void>((resolve) => {
        (db as any).duckdbCon.all('SELECT * FROM tokens', (err: any, rows: any) => {
            if (err) {
                console.error('❌ SELECT Error:', err.message);
                process.exit(1);
            } else {
                console.log(`Total tokens in DuckDB: ${rows.length}`);
                rows.forEach((r: any) => console.log(` - ${r.mint}: ${r.name} (${r.symbol})`));
                const foundEntry = rows.find((r: any) => r.mint === testMint);
                if (foundEntry) {
                    console.log('✅ Diagnostic token found!');
                    process.exit(0);
                } else {
                    console.error('❌ Diagnostic token NOT found.');
                    process.exit(1);
                }
            }
        });
    });
}

diagnoseDuckDB().catch(e => {
    console.error('Fatal Diagnostic Error:', e);
    process.exit(1);
});
