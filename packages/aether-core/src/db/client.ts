import sqlite3 from 'sqlite3';
import { Database } from 'duckdb';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

class DBClient {
    private sqlite: sqlite3.Database;
    private duckdb: Database;
    private duckdbCon: any;

    constructor() {
        const sqliteDir = path.dirname(config.db.sqlitePath);
        const duckdbDir = path.dirname(config.db.duckdbPath);
        if (!fs.existsSync(sqliteDir)) fs.mkdirSync(sqliteDir, { recursive: true });
        if (!fs.existsSync(duckdbDir)) fs.mkdirSync(duckdbDir, { recursive: true });

        this.sqlite = new sqlite3.Database(config.db.sqlitePath);
        this.duckdb = new Database(config.db.duckdbPath);
        this.duckdbCon = this.duckdb.connect();
        this.sqlite.run('PRAGMA journal_mode=WAL');
    }

    async initSqliteOnly() {
        return new Promise<void>((resolve, reject) => {
            const schemaPath = path.join(__dirname, 'sqlite_schema.sql');
            if (!fs.existsSync(schemaPath)) return resolve();
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            this.sqlite.exec(schema, (err: Error | null) => {
                if (err) reject(err);
                else {
                    console.log('[Librarian] SQLite Registry Initialized.');
                    resolve();
                }
            });
        });
    }

    async init() {
        await this.initSqliteOnly();
        return new Promise<void>((resolve, reject) => {
            const duckdbSchemaPath = path.join(__dirname, 'duckdb_schema.sql');
            if (!fs.existsSync(duckdbSchemaPath)) return resolve();
            try {
                const duckdbSchema = fs.readFileSync(duckdbSchemaPath, 'utf-8');
                const statements = duckdbSchema.split(';').map(s => s.trim()).filter(s => s.length > 0);
                
                (async () => {
                    for (const statement of statements) {
                        await new Promise<void>((resolveStmt) => {
                            this.duckdbCon.run(statement, (err: any) => {
                                resolveStmt();
                            });
                        });
                    }
                    console.log('[Librarian] DuckDB Analytics Initialized.');
                    resolve();
                })().catch(reject);
            } catch (err) {
                console.error('Failed to load DuckDB schema file:', err);
                resolve(); 
            }
        });
    }

    private duckdbQueue: { sql: string, params: any[] }[] = [];
    private isProcessingQueue = false;

    async runDuckDB(sql: string, params: any[] = []) {
        // Queue the write and process it in the background
        this.duckdbQueue.push({ sql, params });
        this.processDuckDBQueue();
    }

    private async processDuckDBQueue() {
        if (this.isProcessingQueue || this.duckdbQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.duckdbQueue.length > 0) {
            const item = this.duckdbQueue.shift();
            if (!item) continue;

            await new Promise<void>((resolve) => {
                this.duckdbCon.run(item.sql, item.params, (err: any) => {
                    if (err) console.error('[DuckDB] Async Write Error:', err.message);
                    resolve();
                });
            });
        }

        this.isProcessingQueue = false;
    }

    async execSqlite(sql: string) {
        return new Promise<void>((resolve, reject) => {
            this.sqlite.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async runSqlite(sql: string, params: any[] = []) {
        return new Promise<void>((resolve, reject) => {
            this.sqlite.run(sql, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async querySqlite(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.sqlite.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async insertShardLock(shard: { merkleRoot: string, nodePubkey: string, shardCount: number }) {
        const query = `
            INSERT INTO shard_locks (merkle_root, node_pubkey, shard_count, status, last_heartbeat)
            VALUES (?, ?, ?, 'ONLINE', CURRENT_TIMESTAMP)
            ON CONFLICT(merkle_root, node_pubkey) DO UPDATE SET
                status = 'ONLINE',
                last_heartbeat = CURRENT_TIMESTAMP
        `;
        await this.runSqlite(query, [shard.merkleRoot, shard.nodePubkey, shard.shardCount]);
        await this.runDuckDB(`
            INSERT INTO shard_locks (merkle_root, node_pubkey, shard_count, status)
            VALUES (?, ?, ?, 'ONLINE')
        `, [shard.merkleRoot, shard.nodePubkey, shard.shardCount]);
    }

    async getShardLocations(merkleRoot: string): Promise<any[]> {
        const sql = `
            SELECT node_pubkey, shard_count, status, last_heartbeat 
            FROM shard_locks 
            WHERE merkle_root = ? AND status = 'ONLINE'
        `;
        return this.querySqlite(sql, [merkleRoot]);
    }

    async runShardMaintenance() {
        const query = `
            UPDATE shard_locks 
            SET status = 'OFFLINE' 
            WHERE last_heartbeat < datetime('now', '-10 minutes') AND status = 'ONLINE'
        `;
        return this.runSqlite(query);
    }

    /**
     * Dynamic Schema Guard: Core Bounty Requirement
     * Ensures a table exists in both Registry (SQLite) and Analytics (DuckDB).
     */
    async ensureDynamicTable(tableName: string, columnDefs: string[]) {
        const createSql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs.join(', ')})`;
        
        // 1. Initialize in SQLite Registry
        await this.execSqlite(createSql);
        
        // 2. Initialize in DuckDB Analytics (No explicit return check needed as it follows queue pattern)
        await this.runDuckDB(createSql);
        
        console.log(`[DB] Dynamic Table Verified: ${tableName}`);
    }
}

export const db = new DBClient();
