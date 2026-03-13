const axios = require('axios');
require('dotenv').config();

async function verify() {
    console.log('--- Manual Price Discovery Test ---');
    try {
        console.log('Fetching from Jupiter Price API...');
        const response = await axios.get('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
        const price = response.data.data['So11111111111111111111111111111111111111112']?.price;
        if (price) {
            console.log(`\n✅ LIVE SOL PRICE: $${parseFloat(price).toFixed(2)}`);
        } else {
            console.log('❌ Price data not found in response.');
        }
    } catch (err) {
        console.error('❌ API Error:', err.message);
    }
}

verify();
