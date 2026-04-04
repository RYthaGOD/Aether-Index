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
            if (tableName.includes('ix_')) {
                const ixName = tableName.replace(/"/g, '').replace('ix_', '').toLowerCase();
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

            const txSig = tx.signature || 'unknown';

            try {
                // Anchor decoding: The secret sauce
                let decoded: any;
                try {
                    decoded = this.coder.decode(ix.data, 'base58');
                } catch (decodeErr: any) {
                    // Precision Error Boundary: Log and continue rather than crashing the stream
                    console.warn(`[Universal:${this.name}] ⚠️ Decoding failed for tx ${txSig}: ${decodeErr.message}`);
                    continue;
                }

                if (!decoded) continue;

                const tableName = this.tableMap[decoded.name.toLowerCase()];
                if (!tableName) {
                    console.log(`[Universal:${this.name}] ℹ️ Skipping unmapped instruction: ${decoded.name}`);
                    continue;
                }

                const data: any = {
                    signature: txSig,
                    slot: tx.slot,
                    signer: tx.feePayer || 'Unknown'
                };

                // Extract arguments from decoded data with recursive sanitization
                try {
                    const sanitizedData = this.sanitizeData(decoded.data);
                    Object.assign(data, sanitizedData);
                } catch (sanitizeErr: any) {
                    console.error(`[Universal:${this.name}] 🚨 Sanitization failure for ${decoded.name} [${txSig}]: ${sanitizeErr.message}`);
                    continue;
                }

                const columns = Object.keys(data).map(c => `"${c}"`);
                const values = Object.values(data).map(val => 
                    (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val
                );
                const placeholders = columns.map(() => '?').join(', ');
                
                const sql = `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                
                // Write to both Registry (SQLite) and Analytics (DuckDB)
                try {
                    await db.runSqlite(sql, values);
                    await db.runDuckDB(sql, values);
                    
                    const idlName = (this.idl as any).name || 'Unknown';
                    console.log(`[Universal] ✅ Indexed ${decoded.name} for ${idlName} [Slot: ${tx.slot}]`);
                } catch (dbErr: any) {
                    // Production Boundary: Log specific DB failures but keep the indexer moving
                    console.error(`[Universal:${this.name}] 🚨 Database write failure for ${decoded.name} [${txSig}]: ${dbErr.message}`);
                }
            } catch (err: any) {
                // Final Catch-All for the instruction loop
                console.error(`[Universal:${this.name}] 💀 Critical processing error in ${this.name} [${txSig}]: ${err.message}`);
            }
        }
    }

    /**
     * Precision Guard: Recursively converts Anchor BN objects or deep objects to strings
     */
    private sanitizeData(obj: any): any {
        if (obj === null || obj === undefined) return obj;
        
        // Handle BN (BigNumber) objects specifically
        if (typeof obj === 'object' && obj.toString && (obj._isBN || obj.constructor.name === 'BN')) {
            return obj.toString();
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeData(item));
        }

        if (typeof obj === 'object' && !(obj instanceof Date)) {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = this.sanitizeData(value);
            }
            // For root level or depth 1, we might keep it as object for the column mapping
            // But if it's being returned to ix data, we stringify if it's still an object
            return sanitized;
        }

        return obj;
    }

    extendServer(app: any, db: any): void {
        const programId = this.programId;
        const idlName = (this.idl as any).name || 'Unknown';

        console.log(`[Universal] Registering Generic API for ${idlName}: /api/v1/indexed/${idlName}/:instruction`);
        console.log(`[Universal] Registering Pubkey API for ${idlName}: /api/v1/indexed/${programId}/:instruction`);

        const handleIndexedRequest = async (req: any, res: any) => {
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
                        .map(([key, _]) => `"${key}" = ?`)
                        .join(" AND ");
                    params.push(...validFilters.map(([_, v]) => v));
                }
                
                sql += ` ORDER BY "slot" DESC LIMIT ? OFFSET ?`;
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
        };

        app.get(`/api/v1/indexed/${idlName}/:instruction`, handleIndexedRequest);
        app.get(`/api/v1/indexed/${programId}/:instruction`, handleIndexedRequest);

        // 2. Aggregation Endpoint (Support for: "call counts for specific instructions over a period")
        const handleStatsRequest = async (req: any, res: any) => {
            try {
                const since = req.query.since; // ISO timestamp e.g. 2026-03-01T00:00:00Z
                const summary: any = { programId, program: idlName, instructions: {} };
                
                for (const [ixName, tableName] of Object.entries(this.tableMap)) {
                    let countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
                    const params: any[] = [];
                    if (since) {
                        countSql += ` WHERE "timestamp" >= ?`;
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
        };

        app.get(`/api/v1/stats/${idlName}/summary`, handleStatsRequest);
        app.get(`/api/v1/stats/${programId}/summary`, handleStatsRequest);

        // 3. Health / Discovery Endpoint
        const handleDiscoveryRequest = async (_req: any, res: any) => {
            res.json({
                programId,
                name: idlName,
                indexedInstructions: Object.keys(this.tableMap),
                tables: Object.values(this.tableMap),
            });
        };

        app.get(`/api/v1/programs/${idlName}`, handleDiscoveryRequest);
        app.get(`/api/v1/programs/${programId}`, handleDiscoveryRequest);
    }
}
