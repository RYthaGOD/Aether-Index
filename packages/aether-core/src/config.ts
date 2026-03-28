import dotenv from 'dotenv';
dotenv.config();

// ══════════════════════════════════════════════════
//  Aether Librarian — Configuration
//  Purpose: Shard-lock metadata service for Seeker Swarm
// ══════════════════════════════════════════════════

export const config = {
    solana: {
        rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
        wsUrl:  process.env.WSS_URL || 'wss://api.mainnet-beta.solana.com',
    },
    helius: {
        apiKey:         process.env.HELIUS_API_KEY || '',
        webhookUrl:     process.env.HELIUS_WEBHOOK_URL || '',
        webhookSecret:  process.env.HELIUS_WEBHOOK_SECRET || '',
    },
    db: {
        sqlitePath: process.env.SQLITE_PATH || './data/sqlite/librarian.db',
        duckdbPath: process.env.DUCKDB_PATH || './data/parquet/librarian.duckdb',
    },
    seeker: {
        programId: 'GtmN6x2aPYq6LkbJTj1qxm5Jn6zGQNWsgG9NFnx1QaEu',
    },
    server: {
        port: Number(process.env.PORT || 4000),
    }
};
