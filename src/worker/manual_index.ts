import { config } from '../config';
import axios from 'axios';

const BLUE_CHIP_WHITELIST = [
    { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
    { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
    { mint: 'Es9vMFrzaKERzJ4vki4wS77S8ST2gBfKqv78at9AHXBa', symbol: 'USDT' },
    { mint: 'JUPyiK9yUQCvHksmQGpxp99DqPLtcHkL9LNiY1tSY6t', symbol: 'JUP' },
    { mint: 'HZ1J6yEAsV7M3fSg2797A9jUzDPwBeDuRSf5C579Y3o', symbol: 'PYTH' },
    { mint: 'J1t97S6ns77s9Mj8avUMmXmBqAoXAnxbM96gGuk8S9S', symbol: 'JitoSOL' },
    { mint: 'DezXAZ8z7PnrnESnHRjeU96ScH6aiG9G7h6YvEkP8Et7', symbol: 'BONK' },
    { mint: 'EKpQ77Ut7nAa2vn9HneRS69xbd7DeM1FrFc1FoqEDJ8S', symbol: 'WIF' },
    { mint: 'DriFtupTu76MCD66S7qS67TR96bySgXNC48JfZ7699EB', symbol: 'DRIFT' },
    { mint: 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS', symbol: 'KMNO' }
];

const DEXES = ['raydium', 'orca', 'meteora'];

async function run() {
    console.log('🔍 Starting Manual Pool Discovery (Helius DAS + Throttled)...\n');
    const result: any = {};

    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${config.helius.apiKey || process.env.HELIUS_API_KEY}`;

    for (const token of BLUE_CHIP_WHITELIST) {
        console.log(`\n🔍 Fetching Metadata (DAS) for ${token.mint}...`);
        result[token.symbol] = { mint: token.mint, pools: {} };
        await new Promise(r => setTimeout(r, 1000)); 

        let searchSymbol = token.symbol;
        try {
            // Helius DAS Lookup
            const dasRes = await axios.post(heliusUrl, {
                jsonrpc: "2.0", id: "metadata", method: "getAsset",
                params: { id: token.mint, displayOptions: { showFungible: true } }
            });

            const meta = dasRes.data?.result?.content?.metadata;
            if (meta && meta.symbol) {
                console.log(`  [DAS] Resolved Symbol: ${meta.symbol} | Name: ${meta.name}`);
                searchSymbol = meta.symbol;
            } else {
                console.log(`  [DAS] Fallback to whitelist symbol: ${searchSymbol}`);
            }

            // DexScreener Lookup
            const res = await axios.get(`https://api.dexscreener.com/latest/dex/search?q=${searchSymbol}`);
            const pairs = res.data.pairs || [];

            console.log(`  Found ${pairs.length} total pairs for query.`);

            for (const dex of DEXES) {
                // Filter by chain, dex, and MUST match exact mint
                const dexPairs = pairs.filter((p: any) => 
                    p.chainId === 'solana' && 
                    p.dexId.toLowerCase() === dex &&
                    (p.baseToken.address === token.mint || p.quoteToken.address === token.mint)
                );
                if (dexPairs.length === 0) {
                    console.log(`  [${dex.toUpperCase()}] No pairs found.`);
                    continue;
                }

                dexPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
                const bestPair = dexPairs[0];

                console.log(`  [${dex.toUpperCase()}] Best: ${bestPair.pairAddress} | Liq: $${Math.round(bestPair.liquidity?.usd || 0)} | ${bestPair.baseToken.symbol}/${bestPair.quoteToken.symbol}`);
                result[token.symbol].pools[dex] = {
                    address: bestPair.pairAddress,
                    liquidity: Math.round(bestPair.liquidity?.usd || 0),
                    label: `${bestPair.baseToken.symbol}/${bestPair.quoteToken.symbol}`
                };
            }
        } catch (err: any) {
            console.error(`  Error fetching ${token.symbol}:`, err.message);
        }
    }

    console.log('\n=====================================');
    console.log('📋 STATIC_POOL_MAP (JSON STRING):');
    console.log(JSON.stringify(result, null, 2));
    console.log('=====================================');
}

run();
