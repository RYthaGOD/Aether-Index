-- DuckDB Schema: Analytical OHLCV Storage
-- Optimized for high-speed candlestick math on Parquet files.

-- Raw Swaps for analytical processing
CREATE TABLE IF NOT EXISTS raw_swaps (
    timestamp TIMESTAMP_MS,
    token_address VARCHAR,
    price_usd DOUBLE,
    volume_usd DOUBLE,
    side ENUM('buy', 'sell'),
    signature VARCHAR,
    slot UINTEGER,
    dex_id VARCHAR,
    maker VARCHAR
);

-- Global Token Registry
CREATE TABLE IF NOT EXISTS tokens (
    mint VARCHAR PRIMARY KEY,
    symbol VARCHAR,
    name VARCHAR,
    decimals INTEGER,
    created_at TIMESTAMP_MS DEFAULT CURRENT_TIMESTAMP
);

-- Automated 1m OHLCV Materialized View (Simulation via View for DuckDB)
CREATE VIEW IF NOT EXISTS prices_1m AS
SELECT 
    time_bucket(INTERVAL '1 minute', timestamp) as bucket,
    token_address,
    first(price_usd ORDER BY timestamp) as open,
    max(price_usd) as high,
    min(price_usd) as low,
    last(price_usd ORDER BY timestamp) as close,
    sum(volume_usd) as volume
FROM raw_swaps
GROUP BY 1, 2;

-- Note: In DuckDB, we often use 'COPY TO' for Parquet persistence.
-- We'll implement the 1s, 1m, 1h aggregations using DuckDB's vectorized SQL
-- at query time or as periodically flushed Parquet files.
