-- PostgreSQL Schema: The "Source of Truth" for Transactions
-- Used for reconciliation, metadata, and re-org handling.

CREATE TABLE IF NOT EXISTS tokens (
    address VARCHAR(44) PRIMARY KEY,
    symbol VARCHAR(20),
    name VARCHAR(100),
    decimals INTEGER NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swaps (
    id SERIAL PRIMARY KEY,
    signature VARCHAR(88) UNIQUE NOT NULL,
    slot BIGINT NOT NULL,
    block_time TIMESTAMP WITH TIME ZONE NOT NULL,
    token_in_address VARCHAR(44) NOT NULL,
    token_out_address VARCHAR(44) NOT NULL,
    amount_in DECIMAL NOT NULL,
    amount_out DECIMAL NOT NULL,
    price_usd DECIMAL,
    maker VARCHAR(44),
    dex VARCHAR(20), -- 'raydium', 'jupiter', 'orca'
    is_reconciled BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sync_state (
    key VARCHAR(50) PRIMARY KEY,
    last_processed_slot BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_swaps_slot ON swaps(slot);
CREATE INDEX idx_swaps_token_in ON swaps(token_in_address);
CREATE INDEX idx_swaps_token_out ON swaps(token_out_address);
CREATE INDEX idx_swaps_block_time ON swaps(block_time);
