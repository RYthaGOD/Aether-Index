import sqlite3 from 'sqlite3';
import { Database } from 'duckdb';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import { SwapEvent } from '../worker/parser';

class DBClient {
    private sqlite: sqlite3.Database;
    private duckdb: Database;
    private duckdbCon: any;
    private knownTokens: Set<string> = new Set();

    constructor() {
        // Ensure directories exist
        const sqliteDir = path.dirname(config.sqlite.filename);
        const duckdbDir = path.dirname(config.duckdb.filename);
        if (!fs.existsSync(sqliteDir)) fs.mkdirSync(sqliteDir, { recursive: true });
        if (!fs.existsSync(duckdbDir)) fs.mkdirSync(duckdbDir, { recursive: true });

        this.sqlite = new sqlite3.Database(config.sqlite.filename);
        this.duckdb = new Database(config.duckdb.filename);
        this.duckdbCon = this.duckdb.connect();
        
        // Performance & Durability: Enable Write-Ahead Logging for SQLite
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
                    console.log('SQLite Initialized.');
                    resolve();
                }
            });
        });
    }

    async init() {
        await this.initSqliteOnly();
        return new Promise<void>((resolve, reject) => {
            const duckdbSchemaPath = path.join(__dirname, 'duckdb_schema.sql');
            try {
                const duckdbSchema = fs.readFileSync(duckdbSchemaPath, 'utf-8');
                const statements = duckdbSchema.split(';').map(s => s.trim()).filter(s => s.length > 0);
                
                // Execute statements strictly sequentially
                (async () => {
                    for (const statement of statements) {
                        await new Promise<void>((resolveStmt) => {
                            this.duckdbCon.run(statement, (err: any) => {
                                if (err) {
                                    console.warn('DuckDB Init Notice:', err.message, '| Statement:', statement.slice(0, 50));
                                }
                                resolveStmt();
                            });
                        });
                    }
                    console.log('DuckDB Full Schema Initialized (Sequential).');
                    resolve();
                })().catch(reject);
            } catch (err) {
                console.error('Failed to load DuckDB schema file:', err);
                resolve(); 
            }
        });
    }

    async insertSwapToSQLite(swap: any) {
        return new Promise<void>((resolve, reject) => {
            const query = `
                INSERT OR IGNORE INTO swaps (signature, slot, block_time, token_in_address, token_out_address, amount_in, amount_out, price_usd, maker, dex)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            this.sqlite.run(query, [
                swap.signature, swap.slot, swap.blockTime.toISOString(), swap.tokenIn, swap.tokenOut,
                swap.amountIn, swap.amountOut, swap.priceUsd, swap.maker, swap.dex
            ], (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async upsertToken(token: { mint: string, symbol: string, name: string, decimals: number, rank?: number, is_top_100?: boolean }) {
        this.knownTokens.add(token.mint);
        return new Promise<void>((resolve, reject) => {
            this.sqlite.run(`
                INSERT INTO tokens (address, symbol, name, decimals, rank, is_top_100)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(address) DO UPDATE SET
                    symbol = excluded.symbol,
                    name = excluded.name,
                    decimals = excluded.decimals,
                    rank = COALESCE(excluded.rank, tokens.rank),
                    is_top_100 = COALESCE(excluded.is_top_100, tokens.is_top_100)
            `, [token.mint, token.symbol, token.name, token.decimals, token.rank || null, token.is_top_100 ? 1 : 0], (err: Error | null) => {
                if (err) return reject(err);
                
                // DuckDB: DELETE then INSERT for maximum compatibility on Windows/older versions
                this.duckdbCon.run('DELETE FROM tokens WHERE mint = ?', token.mint, (errD: any) => {
                    if (errD) console.error('DuckDB Token Delete Error:', errD.message);
                    
                    this.duckdbCon.run(`
                        INSERT INTO tokens (mint, symbol, name, decimals, rank, is_top_100)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, 
                    token.mint, 
                    token.symbol, 
                    token.name, 
                    token.decimals || 0, 
                    token.rank || null, 
                    token.is_top_100 ? 1 : 0, 
                    (err2: Error | null) => {
                        if (err2) {
                            console.error(`DuckDB Token Insert Error for ${token.mint}:`, err2.message);
                        } else {
                            console.log(`[DB] DuckDB Token Populated: ${token.symbol}`);
                        }
                        resolve(); 
                    });
                });
            });
        });
    }

    async tokenExists(mint: string): Promise<boolean> {
        if (this.knownTokens.has(mint)) return true;
        
        return new Promise((resolve) => {
            this.sqlite.get('SELECT address FROM tokens WHERE address = ?', [mint], (err, row) => {
                if (row) {
                    this.knownTokens.add(mint);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }

    async upsertTokenPool(pool: { mint: string, dex: string, poolAddress: string, liquidityUsd: number }) {
        return new Promise<void>((resolve, reject) => {
            this.sqlite.run(`
                INSERT INTO token_pools (mint, dex, pool_address, liquidity_usd, last_updated)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(pool_address) DO UPDATE SET
                    liquidity_usd = excluded.liquidity_usd,
                    last_updated = CURRENT_TIMESTAMP
            `, [pool.mint, pool.dex, pool.poolAddress, pool.liquidityUsd], (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getTop100Tokens() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT address as mint, symbol, name, decimals, rank 
                FROM tokens 
                WHERE is_top_100 = 1
                ORDER BY rank ASC
                LIMIT 100
            `;
            this.sqlite.all(sql, [], (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    async getBestPool(mint: string): Promise<{ dex: string, pool_address: string } | null> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT dex, pool_address 
                FROM token_pools 
                WHERE mint = ?
                ORDER BY liquidity_usd DESC
                LIMIT 1
            `;
            this.sqlite.get(sql, [mint], (err: Error | null, row: any) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    async insertToDuckDB(swaps: Array<SwapEvent & { side?: 'buy' | 'sell' }>) {
        if (swaps.length === 0) return;
        
        // Use a persistent connection for batch performance
        const con = this.duckdbCon;
        
        return new Promise<void>((resolve, reject) => {
            con.run('BEGIN TRANSACTION', (err: any) => {
                if (err) return reject(err);
                
                let completed = 0;
                let hasError = false;

                const checkDone = (errI?: any) => {
                    if (errI && !hasError) {
                        hasError = true;
                        con.run('ROLLBACK', () => reject(errI));
                        return;
                    }
                    completed++;
                    if (completed === swaps.length && !hasError) {
                        con.run('COMMIT', (errC: any) => {
                            if (errC) reject(errC);
                            else resolve();
                        });
                    }
                };

                for (const s of swaps) {
                    const side = s.side || (s.tokenIn === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || s.tokenIn === 'So11111111111111111111111111111111111111112' ? 'buy' : 'sell');
                    const tokenAddress = side === 'buy' ? s.tokenOut : s.tokenIn;
                    const volumeUsd = (side === 'buy' ? s.amountOut : s.amountIn) * s.priceUsd;

                    con.run(`
                        INSERT INTO raw_swaps (timestamp, token_address, price_usd, volume_usd, side, signature, slot, dex_id, maker)
                        VALUES (to_timestamp(?), ?, ?, ?, ?, ?, ?, ?, ?)
                    `, 
                        s.blockTime.getTime() / 1000, 
                        tokenAddress,
                        s.priceUsd,
                        volumeUsd,
                        side,
                        s.signature,
                        s.slot,
                        s.dex,
                        s.maker,
                        checkDone
                    );
                }
            });
        });
    }

    async updateSyncState(slot: number) {
        return new Promise<void>((resolve, reject) => {
            const query = `
                INSERT INTO sync_state (key, last_processed_slot)
                VALUES ('default', ?)
                ON CONFLICT (key) DO UPDATE SET last_processed_slot = excluded.last_processed_slot
            `;
            this.sqlite.run(query, [slot], (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getHistory(tokenAddress: string, interval: string) {
        const con = this.duckdb.connect();
        const sql = `
            SELECT 
                time_bucket(INTERVAL '1 ${interval}', timestamp) as window_start,
                first(price_usd) as open,
                max(price_usd) as high,
                min(price_usd) as low,
                last(price_usd) as close,
                sum(volume_usd) as volume
            FROM raw_swaps
            WHERE token_address = '${tokenAddress}'
            GROUP BY window_start
            ORDER BY window_start DESC
            LIMIT 1000
        `;
        return new Promise((resolve, reject) => {
            con.all(sql, (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    async searchTokens(query: string) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT address as mint, symbol, name, decimals 
                FROM tokens 
                WHERE symbol LIKE ? OR name LIKE ? OR address = ?
                LIMIT 20
            `;
            const param = `%${query}%`;
            this.sqlite.all(sql, [param, param, query], (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    async getTopMovers() {
        const con = this.duckdb.connect();
        return new Promise((resolve, reject) => {
            con.all('SELECT * FROM top_movers_24h LIMIT 10', (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res.map((r: any) => ({
                    tokenAddress: r.token_address,
                    current_price: r.current_price,
                    pct_change: r.pct_change
                })));
            });
        });
    }

    async getVolumeClusters() {
        const con = this.duckdb.connect();
        return new Promise((resolve, reject) => {
            con.all('SELECT * FROM volume_clusters_1h LIMIT 10', (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res.map((r: any) => ({
                    tokenAddress: r.token_address,
                    total_volume: r.total_volume,
                    trade_count: r.trade_count
                })));
            });
        });
    }

    async updateCreatorReputation(address: string, reputation: string, fundedBy: string, launchCount: number) {
        return new Promise<void>((resolve, reject) => {
            this.sqlite.run(`
                INSERT INTO creators (address, reputation, funded_by, launch_count)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(address) DO UPDATE SET
                    reputation = excluded.reputation,
                    funded_by = excluded.funded_by,
                    launch_count = excluded.launch_count
            `, [address, reputation, fundedBy, launchCount], (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async validateApiKey(apiKey: string): Promise<{ tier: string, rateLimitRpm: number } | null> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT tier, rate_limit_rpm 
                FROM subscriptions 
                WHERE api_key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            `;
            this.sqlite.get(sql, [apiKey], (err: Error | null, row: any) => {
                if (err) reject(err);
                else if (row) resolve({ tier: row.tier, rateLimitRpm: row.rate_limit_rpm });
                else resolve(null);
            });
        });
    }

    async createSubscription(apiKey: string, tier: string, rateLimit: number = 60) {
        return new Promise<void>((resolve, reject) => {
            this.sqlite.run(`
                INSERT INTO subscriptions (api_key, tier, rate_limit_rpm)
                VALUES (?, ?, ?)
            `, [apiKey, tier, rateLimit], (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async queryDuckDB(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.duckdbCon.all(sql, ...params, (err: Error | null, res: any) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }
}

export const db = new DBClient();
