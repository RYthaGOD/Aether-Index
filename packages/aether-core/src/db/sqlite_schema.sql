-- SQLite Schema: Aether Librarian — Shard Lock State
-- Tracks which nodes are holding Arweave shard replicas for Seeker Swarm.

CREATE TABLE IF NOT EXISTS shard_locks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    merkle_root   TEXT NOT NULL,
    node_pubkey   TEXT NOT NULL,
    shard_count   INTEGER NOT NULL,
    status        TEXT DEFAULT 'ONLINE', -- 'ONLINE' | 'OFFLINE'
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enforce one row per (node, file) — upsert logic uses this
CREATE UNIQUE INDEX IF NOT EXISTS idx_shard_locks_root_node
    ON shard_locks(merkle_root, node_pubkey);

CREATE INDEX IF NOT EXISTS idx_shard_locks_status
    ON shard_locks(status);

CREATE INDEX IF NOT EXISTS idx_shard_locks_heartbeat
    ON shard_locks(last_heartbeat);
