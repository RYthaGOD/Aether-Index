import sqlite3 from 'sqlite3';
import { Database } from 'duckdb';
import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

class DBClient {
    private sqlite: sqlite3.Database;
    private duckdb: Database;

    constructor() {
        // Ensure directories exist
        const sqliteDir = path.dirname(config.sqlite.filename);
        const duckdbDir = path.dirname(config.duckdb.filename);
        if (!fs.existsSync(sqliteDir)) fs.mkdirSync(sqliteDir, { recursive: true });
        if (!fs.existsSync(duckdbDir)) fs.mkdirSync(duckdbDir, { recursive: true });

        this.sqlite = new sqlite3.Database(config.sqlite.filename);
        this.duckdb = new Database(config.duckdb.filename);
        
        // Performance & Durability: Enable Write-Ahead Logging
        this.sqlite.run('PRAGMA journal_mode=WAL');
        this.duckdb.run('SET journal_mode=WAL'); 
    }

    async init() {
        return new Promise<void>((resolve, reject) => {
            const schema = fs.readFileSync(path.join(__dirname, 'sqlite_schema.sql'), 'utf-8');
            this.sqlite.exec(schema, (err: Error | null) => {
                if (err) reject(err);
                else {
                    console.log('SQLite Initialized.');
                    resolve();
                }
            });
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

    async upsertToken(token: { mint: string, symbol: string, name: string, decimals: number }) {
        // Upsert in both SQLite (metadata) and DuckDB (for joins if needed)
        return new Promise<void>((resolve, reject) => {
            this.sqlite.run(`
                INSERT INTO tokens (address, symbol, name, decimals)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(address) DO UPDATE SET
                    symbol = excluded.symbol,
                    name = excluded.name,
                    decimals = excluded.decimals
            `, [token.mint, token.symbol, token.name, token.decimals], (err: Error | null) => {
                if (err) return reject(err);
                
                const con = this.duckdb.connect();
                con.run(`
                    INSERT OR REPLACE INTO tokens (mint, symbol, name, decimals)
                    VALUES ('${token.mint}', '${token.symbol}', '${token.name}', ${token.decimals})
                `, (err2: Error | null) => {
                    if (err2) reject(err2);
                    else resolve();
                });
            });
        });
    }

    async insertToDuckDB(swaps: any[]) {
        if (swaps.length === 0) return;
        const con = this.duckdb.connect();
        
        // Use a transaction/batch insert for DuckDB
        con.run('BEGIN TRANSACTION');
        try {
            for (const s of swaps) {
                con.run(`
                    INSERT INTO raw_swaps VALUES (
                        ${s.blockTime.getTime()}, '${s.tokenOut}', ${s.priceUsd}, ${s.amountOut * s.priceUsd}, 'buy', '${s.signature}', ${s.slot}, '${s.dex}', '${s.maker}'
                    )
                `);
            }
            con.run('COMMIT');
        } catch (err: any) {
            con.run('ROLLBACK');
            throw err;
        }
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
        // DuckDB vectorized SQL for sub-100ms OHLCV
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
}

export const db = new DBClient();
