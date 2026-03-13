import { PriceOracle } from '../worker/parser';
require('dotenv').config();

async function test() {
    console.log('--- Price Oracle Real-World Test ---');
    await PriceOracle.refreshSolPrice();
    // @ts-ignore
    const price = PriceOracle.solPriceUsd;
    console.log(`\nVerified SOL Price: $${price.toFixed(2)}`);
    console.log('--- Verification Complete ---');
}

test();
