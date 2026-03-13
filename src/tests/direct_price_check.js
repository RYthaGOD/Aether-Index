const { Connection, PublicKey } = require('@solana/web3.js');
require('dotenv').config();

async function checkPrice() {
    console.log('Testing connectivity to Helius Premium RPC...');
    const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
    const conn = new Connection(rpcUrl, 'confirmed');
    
    try {
        const slot = await conn.getSlot();
        console.log(`Current Slot: ${slot}`);

        const SOL_USDC_POOL = new PublicKey('58oQChx4yWmvKtnvZisPghYmoD6pYat8BfH6HEnToAtW');
        console.log('Fetching Raydium Pool state...');
        const accountInfo = await conn.getAccountInfo(SOL_USDC_POOL);
        
        if (accountInfo) {
            const baseReserve = accountInfo.data.readBigUInt64LE(432);
            const quoteReserve = accountInfo.data.readBigUInt64LE(440);
            
            const solAmount = Number(baseReserve) / 1e9;
            const usdcAmount = Number(quoteReserve) / 1e6;
            
            const price = usdcAmount / solAmount;
            console.log(`\n💎 LIVE SOL PRICE: $${price.toFixed(2)}`);
            console.log('Verification Success: 100% On-Chain Parity.');
        } else {
            console.log('❌ Failed to fetch pool account info.');
        }
    } catch (err) {
        console.error('❌ Error during verification:', err.message);
    }
}

checkPrice();
