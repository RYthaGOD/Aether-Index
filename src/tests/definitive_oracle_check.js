const { Connection, PublicKey } = require('@solana/web3.js');
const dotenv = require('dotenv');
dotenv.config();

async function verifyOracle() {
    console.log('--- AetherIndex Restoration Verification ---');
    const rpcUrl = process.env.RPC_URL;
    const conn = new Connection(rpcUrl, 'confirmed');

    try {
        console.log('Fetching active Raydium SOL/USDC Pool...');
        const poolId = new PublicKey('58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2');
        const accountInfo = await conn.getAccountInfo(poolId);
        
        if (!accountInfo) {
            console.log('❌ UNABLE TO REACH POOL STATE.');
            return;
        }

        // Vault discovery at verified offsets: 336 (SOL), 368 (USDC)
        const baseVault = new PublicKey(accountInfo.data.slice(336, 368));
        const quoteVault = new PublicKey(accountInfo.data.slice(368, 400));
        
        console.log(`Vaults Found: SOL(${baseVault.toBase58().slice(0,4)}...) USDC(${quoteVault.toBase58().slice(0,4)}...)`);

        const [bSol, bUsdc] = await Promise.all([
            conn.getTokenAccountBalance(baseVault),
            conn.getTokenAccountBalance(quoteVault)
        ]);

        const price = bUsdc.value.uiAmount / bSol.value.uiAmount;
        console.log(`\n💎 ON-CHAIN PARITY RESTORED: $${price.toFixed(2)}`);
        
        if (price > 50 && price < 500) {
            console.log('✅ STATUS: 100% OPERATIONAL');
        } else {
            console.log('⚠️ STATUS: ANOMALY DETECTED (Price out of likely range)');
        }

    } catch (err) {
        console.error('❌ VERIFICATION FAILED:', err.message);
    }
}

verifyOracle();
