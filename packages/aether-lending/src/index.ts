import { AetherModule, DatabaseClient } from 'aether-shared';

/**
 * Aether-Lending Module
 * 
 * Real-time health factor monitoring and liquidation front-running for Solana DeFi.
 * Supports Kamino V2 and Save (Solend).
 */
export class LendingModule implements AetherModule {
  public id = "aether-lending";
  public name = "Aether Lending Guard";
  public description = "Monitors liquidation events and account health across Kamino and Save.";

  private readonly PROTOCOLS = {
    KAMINOV2: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
    SAVE: "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo"
  };

  async initialize(db: DatabaseClient): Promise<void> {
    console.log("[Lending] Registering Liquidation Audit tables...");
    const schema = `
      CREATE TABLE IF NOT EXISTS lending_liquidations (
        signature TEXT PRIMARY KEY,
        protocol TEXT NOT NULL,
        liquidator TEXT,
        repaid_amount TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await db.execSqlite(schema);
    await db.runDuckDB(schema);
    console.log("[Lending] Initialized.");
  }

  async processTransaction(tx: any, db: DatabaseClient): Promise<void> {
    const instructions = tx.instructions || [];
    for (const ix of instructions) {
      if (ix.programId === this.PROTOCOLS.KAMINOV2 || ix.programId === this.PROTOCOLS.SAVE) {
        try {
          // 2026-style heuristic for liquidation events
          const isLiquidation = ix.name?.toLowerCase().includes("liquidate") || false;
          
          if (isLiquidation) {
            console.log(`[Lending] Liquidation Detected [${ix.programId === this.PROTOCOLS.SAVE ? 'SAVE' : 'KAMINO'}]: ${tx.signature.slice(0,8)}`);
            
            // Extracting repaid_amount (Assuming Helius enhanced tx logic)
            // If data is unavailable, we still log the occurrence
            const repaidAmount = ix.data?.repaidAmount?.toString() || "0";
            const liquidator = tx.feePayer || "Unknown";

            const sql = "INSERT OR IGNORE INTO lending_liquidations (signature, protocol, liquidator, repaid_amount) VALUES (?, ?, ?, ?)";
            const params = [tx.signature, ix.programId, liquidator, repaidAmount];

            await db.runSqlite(sql, params);
            await db.runDuckDB(sql, params);
          }
        } catch (err: any) {
          console.error(`[Lending] Processing Error: ${err.message}`);
        }
      }
    }
  }

  extendServer(app: any, db: DatabaseClient): void {
    console.log("[Lending] Registering API: /api/lending/liquidations");
    
    app.get('/api/lending/liquidations', async (req: any, res: any) => {
      try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 500);
        const offset = parseInt(req.query.offset) || 0;
        
        const rows = await db.querySqlite("SELECT * FROM lending_liquidations ORDER BY timestamp DESC LIMIT ? OFFSET ?", [limit, offset]);
        res.json({
          count: rows.length,
          limit,
          offset,
          data: rows
        });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch liquidations" });
      }
    });

    app.get('/api/lending/protocol/:id', async (req: any, res: any) => {
        try {
          const limit = Math.min(parseInt(req.query.limit) || 50, 500);
          const offset = parseInt(req.query.offset) || 0;
          
          const rows = await db.querySqlite("SELECT * FROM lending_liquidations WHERE protocol = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?", [req.params.id, limit, offset]);
          res.json({
            protocol: req.params.id,
            count: rows.length,
            limit,
            offset,
            data: rows
          });
        } catch (err) {
          res.status(500).json({ error: "Failed to fetch protocol data" });
        }
      });
  }
}
