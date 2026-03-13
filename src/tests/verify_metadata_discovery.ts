import axios from 'axios';
import { config } from '../config';

async function verifyMetadata() {
    console.log('--- Sovereign Metadata (DAS) Verification ---');
    
    // Test Mint: JUP (Jupiter)
    const mint = 'EN169uR5ozckNHbFcysd68Rit1FM2V2UdWuoRyj1KVoN';
    
    console.log(`Fetching metadata for test mint: ${mint}`);
    
    // Test Jupiter API directly as it's the primary source now
    const jupRes = await axios.get(`https://api.jup.ag/tokens/v1/token/${mint}`).catch(() => null);
    if (jupRes && jupRes.data) {
        const { symbol, name } = jupRes.data;
        console.log(`Successfully resolved (Jupiter): ${name} (${symbol})`);
        if (symbol !== 'TRUMP') throw new Error(`Symbol mismatch! Expected TRUMP, got ${symbol}`);
    } else {
        console.log('Jupiter API failed/skipped, trying Helius DAS...');
        const response = await axios.post(`https://mainnet.helius-rpc.com/?api-key=${config.helius.apiKey}`, {
            jsonrpc: "2.0", id: "test", method: "getAsset",
            params: { id: mint, displayOptions: { showFungible: true } }
        });

        console.log('--- Raw Helius Response ---');
        console.log(JSON.stringify(response.data, null, 2));

        const metadata = response.data.result;
        if (metadata && metadata.content) {
            const symbol = metadata.content.metadata?.symbol;
            const name = metadata.content.metadata?.name;
            console.log(`Successfully resolved (Helius): ${name} (${symbol})`);
        } else {
            throw new Error('No metadata found in both Jupiter and Helius.');
        }
    }

    console.log('✅ Metadata Verification Passed.');
    process.exit(0);
}

verifyMetadata().catch(err => {
    console.error('❌ Metadata Verification Failed:', err);
    process.exit(1);
});
