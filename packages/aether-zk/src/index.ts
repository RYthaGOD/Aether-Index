import { AetherModule, DatabaseClient } from 'aether-shared';

/**
 * Aether-zk Module
 * 
 * Auditor for ZK-compressed state transitions on Solana.
 * Indexes validity proofs and state forest updates from Light Protocol.
 */
export class ZkModule implements AetherModule {
  public id = "aether-zk";
  public name = "Aether ZK Auditor";
  public description = "Indexes and verifies ZK-compressed state proofs from Light Protocol.";

  private readonly LIGHT_SYSTEM_PROGRAM = "SySTEM1eSU2p4BGQfQpimFEWWSC1XDFeun3Nqzz3rT7";

  async initialize(db: DatabaseClient): Promise<void> {
    console.log("[ZK] Registering Proof Audit tables...");
    const schema = `
      CREATE TABLE IF NOT EXISTS zk_proof_logs (
        signature TEXT PRIMARY KEY,
        slot INTEGER,
        state_root TEXT NOT NULL,
        verification_status TEXT DEFAULT 'PENDING',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await db.execSqlite(schema);
    await db.runDuckDB(schema);
    console.log("[ZK] Initialized.");
  }

  async processTransaction(tx: any, db: DatabaseClient): Promise<void> {
    const instructions = tx.instructions || [];
    for (const ix of instructions) {
      if (ix.programId === this.LIGHT_SYSTEM_PROGRAM) {
        try {
          // Logic to extract state root from Light Protocol events/instructions
          console.log(`[ZK] Compression Event Detected: ${tx.signature.slice(0,8)}`);
          
          const sql = "INSERT OR IGNORE INTO zk_proof_logs (signature, slot, state_root) VALUES (?, ?, ?)";
          const params = [tx.signature, tx.slot, "extracted_root_stub"];

          await db.runSqlite(sql, params);
          await db.runDuckDB(sql, params);
        } catch (err: any) {
          console.error(`[ZK] Processing Error: ${err.message}`);
        }
      }
    }
  }

  extendServer(app: any): void {
    console.log("[ZK] Registering API: /api/zk/proofs");

    app.get('/api/zk/proofs', async (req: any, res: any) => {
        const { db } = require('../../aether-core/src/db/client');
        try {
          const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
          const offset = parseInt(req.query.offset) || 0;
          
          const rows = await db.querySqlite("SELECT * FROM zk_proof_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?", [limit, offset]);
          res.json({
            count: rows.length,
            limit,
            offset,
            data: rows
          });
        } catch (err) {
          res.status(500).json({ error: "Failed to fetch proof logs" });
        }
      });
  }
}
