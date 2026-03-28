-- DuckDB Schema: Aether Librarian — Shard Analytics
-- Vectorized shard availability analytics for the Seeker Swarm node grid.

CREATE TABLE IF NOT EXISTS shard_locks (
    timestamp      TIMESTAMP DEFAULT (CAST(current_timestamp AS TIMESTAMP)),
    merkle_root    VARCHAR NOT NULL,
    node_pubkey    VARCHAR NOT NULL,
    shard_count    INTEGER NOT NULL,
    status         VARCHAR DEFAULT 'ONLINE'
);

-- Node availability summary view
CREATE VIEW IF NOT EXISTS node_availability AS
SELECT
    node_pubkey,
    COUNT(DISTINCT merkle_root) AS files_locked,
    SUM(shard_count)            AS total_shards,
    MAX(timestamp)              AS last_seen,
    MAX(status)                 AS current_status
FROM shard_locks
GROUP BY node_pubkey
ORDER BY last_seen DESC;

-- Active shard map per file
CREATE VIEW IF NOT EXISTS active_shard_map AS
SELECT
    merkle_root,
    COUNT(DISTINCT node_pubkey) AS replication_factor,
    SUM(shard_count)            AS total_shards_distributed,
    MAX(timestamp)              AS last_heartbeat
FROM shard_locks
WHERE status = 'ONLINE'
GROUP BY merkle_root
ORDER BY last_heartbeat DESC;
