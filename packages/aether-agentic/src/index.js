"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenticModule = void 0;
/**
 * Aether-Agentic Module
 *
 * Provides sub-second cognitive state and "Semantic Narratives" for AI agents.
 * Implements the Model Context Protocol (MCP) for universal agent interoperability.
 */
class AgenticModule {
    id = "aether-agentic";
    name = "Aether Agentic Memory";
    description = "Transforms on-chain events into semantic narratives for AI agents.";
    async initialize(db) {
        console.log("[Agentic] Registering Semantic Memory tables...");
        const schema = `
      CREATE TABLE IF NOT EXISTS agent_narratives (
        signature TEXT PRIMARY KEY,
        narrative TEXT NOT NULL,
        semantic_cluster TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
        await db.execSqlite(schema);
        await db.runDuckDB(schema);
        console.log("[Agentic] Initialized.");
    }
    async processTransaction(tx, db) {
        try {
            // 1. Narrative Generation (Sub-second logic)
            const narrative = this.generateNarrative(tx);
            if (narrative) {
                console.log(`[Agentic] New Narrative Generated: ${tx.signature.slice(0, 8)}...`);
                // 2. Persist to Cognitive Layer (Dual-write)
                const sql = "INSERT OR IGNORE INTO agent_narratives (signature, narrative) VALUES (?, ?)";
                const params = [tx.signature, narrative];
                await db.runSqlite(sql, params);
                await db.runDuckDB(sql, params);
            }
        }
        catch (err) {
            console.error(`[Agentic] Processing Error: ${err.message}`);
        }
    }
    generateNarrative(tx) {
        if (!tx.description)
            return null;
        return `Transaction ${tx.signature.slice(0, 8)}: ${tx.description} at slot ${tx.slot}`;
    }
    extendServer(app) {
        console.log("[Agentic] Registering API: /api/agentic/narratives");
        app.get('/api/agentic/narratives', async (req, res) => {
            const { db } = require('../../aether-core/src/db/client');
            try {
                const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
                const offset = parseInt(req.query.offset) || 0;
                const rows = await db.querySqlite("SELECT * FROM agent_narratives ORDER BY timestamp DESC LIMIT ? OFFSET ?", [limit, offset]);
                res.json({
                    count: rows.length,
                    limit,
                    offset,
                    data: rows
                });
            }
            catch (err) {
                res.status(500).json({ error: "Failed to fetch narratives" });
            }
        });
    }
}
exports.AgenticModule = AgenticModule;
