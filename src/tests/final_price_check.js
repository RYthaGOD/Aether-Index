const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');

async function getSolPrice() {
    console.log('--- AetherIndex Sovereign Price Check ---');
    
    // 1. Try public Coingecko (No key needed)
    try {
        console.log('Fetching from Coingecko...');
        const cgResp = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const price = cgResp.data.solana.usd;
        if (price) {
            console.log(`\n💎 LIVE SOL PRICE (Coingecko): $${price.toFixed(2)}`);
            return;
        }
    } catch (e) {}

    // 2. Try Jupiter (Public v1 API)
    try {
        console.log('Fetching from Jupiter v1...');
        const jupResp = await axios.get('https://price.jup.ag/v4/price?ids=SOL');
        const price = jupResp.data.data.SOL.price;
        if (price) {
            console.log(`\n💎 LIVE SOL PRICE (Jupiter): $${price.toFixed(2)}`);
            return;
        }
    } catch (e) {}

    console.log('❌ All price sources failed. Checking connectivity only...');
    const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const slot = await conn.getSlot();
    console.log(`Solana Connectivity: ✅ (Slot ${slot})`);
}

getSolPrice();
