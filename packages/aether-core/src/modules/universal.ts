import { AetherModule } from 'aether-shared';
import { Idl, BorshInstructionCoder } from '@coral-xyz/anchor';
import { IdlParser } from '../worker/idl_parser';
import fs from 'fs';
import path from 'path';

/**
 * UniversalModule: The Shape-Shifter
 * 
 * Dynamically indexes any program based on its Anchor IDL.
 * Facilitates "Universal Indexing" and "Dynamic Schema" capabilities.
 */
export class UniversalModule implements AetherModule {
    public id: string;
    public name: string;
    public description: string;
    private programId: string;
    private idl: Idl;
    private coder: BorshInstructionCoder;
    private tableMap: { [ixName: string]: string } = {};
    private columnWhitelist: { [tableName: string]: Set<string> } = {};

    constructor(programId: string, idlPath: string) {
        this.programId = programId;
        const idlRaw = fs.readFileSync(idlPath, 'utf8');
        this.idl = JSON.parse(idlRaw);
        const idlName = (this.idl as any).name || 'Unknown';
        
        this.id = `universal-${programId.slice(0, 8)}`;
        this.name = `Universal Indexer [${idlName}]`;
        this.description = `Dynamic indexer for program ${programId}`;
        
        this.coder = new BorshInstructionCoder(this.idl);
    }

    async initialize(db: any): Promise<void> {
        const idlName = (this.idl as any).name || 'Unknown';
        console.log(`[Universal] Initializing indexer for ${idlName}...`);
        
        const schemas = IdlParser.generateSchema(this.idl);
        for (const [tableName, columns] of Object.entries(schemas)) {
            await db.ensureDynamicTable(tableName, columns);
            
            // Build column whitelist for SQL injection prevention
            const colNames = columns.map(c => c.split(' ')[0]);
            this.columnWhitelist[tableName] = new Set(colNames);
            
            // Map instruction names to table names for faster lookup during processing
            if (tableName.startsWith('ix_')) {
                const ixName = tableName.replace('ix_', '');
                this.tableMap[ixName] = tableName;
            }
        }
        
        console.log(`[Universal] ${Object.keys(schemas).length} dynamic tables registered.`);
    }

    async processTransaction(tx: any, db: any): Promise<void> {
        const instructions = tx.instructions || [];
        
        for (const ix of instructions) {
            // Only process instructions for our targeted program
            if (ix.programId !== this.programId) continue;

            try {
                // Anchor decoding: The secret sauce
                // Assuming tx.instructions have base58 data strings in standard Solana SDK / Helius format
                const decoded = this.coder.decode(ix.data, 'base58');
                if (!decoded) continue;

                const tableName = this.tableMap[decoded.name.toLowerCase()];
                if (!tableName) continue;

                const data: any = {
                    signature: tx.signature,
                    slot: tx.slot,
                    signer: tx.feePayer || 'Unknown'
                };

                // Extract arguments from decoded data
                for (const [key, value] of Object.entries(decoded.data)) {
                    // Primitive conversion for storage
                    data[key] = typeof value === 'object' ? JSON.stringify(value) : value;
                }

                const columns = Object.keys(data);
                const values = Object.values(data);
                const placeholders = columns.map(() => '?').join(', ');
                
                const sql = `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                
                // Write to both Registry (SQLite) and Analytics (DuckDB)
                await db.runSqlite(sql, values);
                await db.runDuckDB(sql, values);

                const idlName = (this.idl as any).name || 'Unknown';
                console.log(`[Universal] Indexed ${decoded.name} for ${idlName}`);
            } catch (err) {
                // Silently skip if decoding fails (might be a different instruction version or malformed data)
                // In production, we'd log this specifically for debugging
            }
        }
    }

    extendServer(app: any): void {
        const programId = this.programId;
        const idlName = (this.idl as any).name || 'Unknown';

        console.log(`[Universal] Registering Generic API: /api/v1/indexed/${idlName}/:instruction`);

        app.get(`/api/v1/indexed/${idlName}/:instruction`, async (req: any, res: any) => {
            const { db } = require('../db/client');
            const ixName = req.params.instruction.toLowerCase();
            const tableName = `ix_${ixName}`;
            const allowedCols = this.columnWhitelist[tableName];
            
            if (!allowedCols) {
                return res.status(404).json({ error: `Instruction '${ixName}' not found in IDL` });
            }
            
            try {
                // Extract pagination params safely
                const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
                const offset = parseInt(req.query.offset) || 0;
                const { limit: _l, offset: _o, ...filters } = req.query;
                
                // SQL Injection Guard: Only allow columns that exist in the schema
                let sql = `SELECT * FROM ${tableName}`;
                const params: any[] = [];
                const validFilters = Object.entries(filters).filter(([key]) => allowedCols.has(key));
                
                if (validFilters.length > 0) {
                    sql += " WHERE " + validFilters
                        .map(([key, _]) => `${key} = ?`)
                        .join(" AND ");
                    params.push(...validFilters.map(([_, v]) => v));
                }
                
                sql += ` ORDER BY slot DESC LIMIT ? OFFSET ?`;
                params.push(limit, offset);
                
                const rows = await db.querySqlite(sql, params);
                res.json({
                    programId,
                    instruction: ixName,
                    count: rows.length,
                    limit,
                    offset,
                    data: rows
                });
            } catch (err) {
                res.status(500).json({ error: `Failed to query dynamic table ${tableName}` });
            }
        });

        // 2. Aggregation Endpoint (Support for: "call counts for specific instructions over a period")
        app.get(`/api/v1/stats/${idlName}/summary`, async (req: any, res: any) => {
            const { db } = require('../db/client');
            try {
                const since = req.query.since; // ISO timestamp e.g. 2026-03-01T00:00:00Z
                const summary: any = { programId, program: idlName, instructions: {} };
                
                for (const [ixName, tableName] of Object.entries(this.tableMap)) {
                    let countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
                    const params: any[] = [];
                    if (since) {
                        countSql += ` WHERE timestamp >= ?`;
                        params.push(since);
                    }
                    const countRow = await db.querySqlite(countSql, params);
                    summary.instructions[ixName] = countRow[0]?.count || 0;
                }
                
                summary.totalInstructions = Object.values(summary.instructions).reduce((a: any, b: any) => a + b, 0);
                res.json(summary);
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch program statistics" });
            }
        });

        // 3. Health / Discovery Endpoint
        app.get(`/api/v1/programs/${idlName}`, async (_req: any, res: any) => {
            res.json({
                programId,
                name: idlName,
                indexedInstructions: Object.keys(this.tableMap),
                tables: Object.values(this.tableMap),
            });
        });
    }
}
