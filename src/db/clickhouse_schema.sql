-- ClickHouse Schema: High-Speed OHLCV Aggregation
-- Optimized for 1s, 1m, 5m, 15m, 1h intervals.

CREATE TABLE IF NOT EXISTS raw_swaps (
    timestamp DateTime64(3, 'UTC'),
    token_address String,
    price_usd Float64,
    volume_usd Float64,
    side Enum8('buy' = 1, 'sell' = 2),
    signature String,
    slot UInt64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (token_address, timestamp);

-- 1 Minute Candles Continuous Aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS ohlcv_1m
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (token_address, window_start)
AS SELECT
    token_address,
    toStartOfMinute(timestamp) AS window_start,
    argMin(price_usd, timestamp) AS open,
    max(price_usd) AS high,
    min(price_usd) AS low,
    argMax(price_usd, timestamp) AS close,
    sum(volume_usd) AS volume
FROM raw_swaps
GROUP BY token_address, window_start;

-- 1 Hour Candles (derived from 1m for efficiency)
CREATE MATERIALIZED VIEW IF NOT EXISTS ohlcv_1h
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (token_address, window_start)
AS SELECT
    token_address,
    toStartOfHour(window_start) AS window_start,
    argMin(open, window_start) AS open,
    max(high) AS high,
    min(low) AS low,
    argMax(close, window_start) AS close,
    sum(volume) AS volume
FROM ohlcv_1m
GROUP BY token_address, window_start;
