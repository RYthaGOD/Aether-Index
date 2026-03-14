import { config } from '../config';
import fs from 'fs';
import path from 'path';

async function preflight() {
    console.log('--- AetherIndex Railway Pre-Flight ---');

    // 1. Check for persistent volume paths
    const paths = [
        path.dirname(config.sqlite.filename),
        path.dirname(config.duckdb.filename)
    ];
    
    for (const p of paths) {
        if (!fs.existsSync(p)) {
            console.log(`[Pre-Flight] Creating directory: ${p}`);
            fs.mkdirSync(p, { recursive: true });
        }
    }
    console.log('✅ Persistence Paths: READY');

    // 2. Environment Validation
    if (!config.helius.apiKey) {
        console.warn('⚠️  HELIUS_API_KEY is missing. Indexing will fail.');
    } else {
        console.log('✅ Helius Integration: READY');
    }

    if (config.redis.url.includes('localhost') && process.env.RAILWAY_ENVIRONMENT) {
        console.warn('⚠️  Redis is pointing to localhost but running in Railway. Ensure REDIS_URL is set.');
    } else {
        console.log('✅ Redis Config: READY');
    }

    console.log('--- Pre-Flight Complete ---');
}

preflight();
