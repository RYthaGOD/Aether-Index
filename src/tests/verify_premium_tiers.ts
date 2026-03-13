import { db } from '../db/client';
import axios from 'axios';

async function verifyPremiumTiers() {
    console.log('🛡️ Starting Sovereignty Guard Verification...');

    // 1. Setup Test Subscriptions
    const premiumKey = 'RYKIRI_TEST_PREMIUM_KEY';
    const proKey = 'RYKIRI_TEST_PRO_KEY';
    const freeKey = 'RYKIRI_TEST_FREE_KEY';

    // Bypass full db.init() to avoid DuckDB file locks from the running server
    await (db as any).initSqliteOnly(); 
    
    // Clear existing test keys if any
    try {
        await db.createSubscription(premiumKey, 'PREMIUM', 1000);
        await db.createSubscription(proKey, 'PRO', 500);
        await db.createSubscription(freeKey, 'FREE', 60);
        console.log('✅ Test keys provisioned (SQLite).');
    } catch (e) {
        console.log('ℹ️ Test keys might already exist or insert failed (continuing).');
    }

    const graphqlUrl = 'http://localhost:4000/graphql';

    // Helper to test a query
    const testQuery = async (name: string, query: string, key?: string) => {
        const headers: any = { 'Content-Type': 'application/json' };
        if (key) headers['x-aether-key'] = key;

        try {
            const res = await axios.post(graphqlUrl, { query }, { headers });
            if (res.data.errors) {
                return { success: false, error: res.data.errors[0].message };
            }
            return { success: true, data: res.data.data };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    };

    const historyQuery = `{ getHistory(tokenAddress: "So11111111111111111111111111111111111111112", interval: "1m") { close } }`;
    const moversQuery = `{ getTopMovers { tokenAddress } }`;

    console.log('\n--- TEST: ANONYMOUS ACCESS ---');
    const anonHistory = await testQuery('Anon History', historyQuery);
    console.log('Anon History (Allowed):', anonHistory.success);
    const anonMovers = await testQuery('Anon Movers', moversQuery);
    console.log('Anon Movers (Should Fail):', anonMovers.success, anonMovers.error);

    console.log('\n--- TEST: FREE KEY ACCESS ---');
    const freeHistory = await testQuery('Free History', historyQuery, freeKey);
    console.log('Free History (Allowed):', freeHistory.success);
    const freeMovers = await testQuery('Free Movers', moversQuery, freeKey);
    console.log('Free Movers (Should Fail):', freeMovers.success, freeMovers.error);

    console.log('\n--- TEST: PRO KEY ACCESS ---');
    const proHistory = await testQuery('Pro History', historyQuery, proKey);
    console.log('Pro History (Allowed):', proHistory.success);
    const proMovers = await testQuery('Pro Movers', moversQuery, proKey);
    console.log('Pro Movers (Allowed):', proMovers.success);

    console.log('\n--- TEST: PREMIUM KEY ACCESS ---');
    const premiumHistory = await testQuery('Premium History', historyQuery, premiumKey);
    console.log('Premium History (Allowed):', premiumHistory.success);
    const premiumMovers = await testQuery('Premium Movers', moversQuery, premiumKey);
    console.log('Premium Movers (Allowed):', premiumMovers.success);

    console.log('\n🛡️ Verification Complete.');
}

verifyPremiumTiers().catch(console.error);
