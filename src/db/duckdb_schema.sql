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
    slot UINTEGER
);

-- Note: In DuckDB, we often use 'COPY TO' for Parquet persistence.
-- We'll implement the 1s, 1m, 1h aggregations using DuckDB's vectorized SQL
-- at query time or as periodically flushed Parquet files.
