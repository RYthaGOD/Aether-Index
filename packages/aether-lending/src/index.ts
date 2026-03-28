import { AetherModule } from 'aether-shared';

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

  async initialize(db: any): Promise<void> {
    console.log("[Lending] Registering Liquidation Audit tables...");
    await db.execSqlite(`
      CREATE TABLE IF NOT EXISTS lending_liquidations (
        signature TEXT PRIMARY KEY,
        protocol TEXT NOT NULL,
        liquidator TEXT,
        repaid_amount REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[Lending] Initialized.");
  }

  async processTransaction(tx: any, db: any): Promise<void> {
    const instructions = tx.instructions || [];
    for (const ix of instructions) {
      if (ix.programId === this.PROTOCOLS.KAMINOV2 || ix.programId === this.PROTOCOLS.SAVE) {
        // Simple filter for common liquidation instruction names in 2026
        const isLiquidation = ix.name?.toLowerCase().includes("liquidate") || false;
        
        if (isLiquidation) {
          console.log(`[Lending] Liquidation Detected [${ix.programId === this.PROTOCOLS.SAVE ? 'SAVE' : 'KAMINO'}]: ${tx.signature.slice(0,8)}`);
          await db.runSqlite(
            "INSERT OR IGNORE INTO lending_liquidations (signature, protocol) VALUES (?, ?)",
            [tx.signature, ix.programId]
          );
        }
      }
    }
  }
}
