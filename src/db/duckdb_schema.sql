-- DuckDB Schema: Analytical OHLCV Storage
-- Optimized for high-speed candlestick math on Parquet files.

-- Raw Swaps for analytical processing
CREATE TABLE IF NOT EXISTS raw_swaps (
    timestamp TIMESTAMP, 
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
    logo_url VARCHAR,
    rank INTEGER,
    is_top_100 BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT (CAST(current_timestamp AS TIMESTAMP))
);

-- Automated 1m OHLCV Materialized View
CREATE VIEW IF NOT EXISTS prices_1m AS
SELECT 
    time_bucket(INTERVAL '1 minute', CAST(timestamp AS TIMESTAMP)) as bucket,
    token_address,
    first(price_usd ORDER BY timestamp) as open,
    max(price_usd) as high,
    min(price_usd) as low,
    last(price_usd ORDER BY timestamp) as close,
    sum(volume_usd) as volume
FROM raw_swaps
GROUP BY 1, 2;

-- Top Movers (24h)
CREATE VIEW IF NOT EXISTS top_movers_24h AS
WITH hourly_prices AS (
    SELECT 
        token_address,
        last(price_usd ORDER BY timestamp) as current_price,
        first(price_usd ORDER BY timestamp) as old_price
    FROM raw_swaps
    WHERE timestamp > CAST(current_timestamp AS TIMESTAMP) - INTERVAL '24 hours'
    GROUP BY token_address
)
SELECT 
    token_address,
    current_price,
    old_price,
    CASE 
        WHEN old_price > 0 THEN ((current_price - old_price) / old_price) * 100 
        ELSE 0 
    END as pct_change
FROM hourly_prices
ORDER BY pct_change DESC;

-- Volume Clusters (1h)
CREATE VIEW IF NOT EXISTS volume_clusters_1h AS
SELECT 
    token_address,
    sum(volume_usd) as total_volume,
    count(*) as trade_count
FROM raw_swaps
WHERE timestamp > CAST(current_timestamp AS TIMESTAMP) - INTERVAL '1 hour'
GROUP BY token_address
HAVING total_volume > 1000
ORDER BY total_volume DESC;
