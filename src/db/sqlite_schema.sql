-- SQLite Schema: Sovereign Transaction Log & Sync State
-- Used for reconciliation and metadata with zero hosting cost.

CREATE TABLE IF NOT EXISTS tokens (
    address TEXT PRIMARY KEY,
    symbol TEXT,
    name TEXT,
    decimals INTEGER NOT NULL,
    logo_url TEXT,
    rank INTEGER,
    is_top_100 INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_pools (
    mint TEXT NOT NULL,
    dex TEXT NOT NULL, -- 'raydium', 'orca', 'meteora'
    pool_address TEXT PRIMARY KEY,
    liquidity_usd REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_pools_mint ON token_pools(mint);

CREATE TABLE IF NOT EXISTS swaps (
    signature TEXT PRIMARY KEY,
    slot INTEGER NOT NULL,
    block_time DATETIME NOT NULL,
    token_in_address TEXT NOT NULL,
    token_out_address TEXT NOT NULL,
    amount_in REAL NOT NULL,
    amount_out REAL NOT NULL,
    price_usd REAL,
    maker TEXT,
    dex TEXT, -- 'raydium', 'jupiter', 'orca'
    is_reconciled INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    last_processed_slot INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swaps_slot ON swaps(slot);
CREATE INDEX IF NOT EXISTS idx_swaps_token_in ON swaps(token_in_address);
CREATE INDEX IF NOT EXISTS idx_swaps_token_out ON swaps(token_out_address);
CREATE INDEX IF NOT EXISTS idx_swaps_block_time ON swaps(block_time);

CREATE TABLE IF NOT EXISTS creators (
    address TEXT PRIMARY KEY,
    reputation TEXT, -- 'CLEAN', 'SUSPICIOUS', 'RUGGER'
    funded_by TEXT,
    launch_count INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    api_key TEXT PRIMARY KEY,
    tier TEXT NOT NULL, -- 'FREE', 'PREMIUM', 'INSTITUTIONAL'
    owner_address TEXT,
    rate_limit_rpm INTEGER DEFAULT 60,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
