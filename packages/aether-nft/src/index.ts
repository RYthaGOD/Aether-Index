import { AetherModule, DatabaseClient } from 'aether-shared';

/**
 * Aether-NFT Module
 * 
 * Rarity engine and metadata indexer for Metaplex Core assets.
 * Optimized for the single-account on-chain attribute standard.
 */
export class NftModule implements AetherModule {
  public id = "aether-nft";
  public name = "Aether NFT Rarity";
  public description = "Indexes Metaplex Core attributes and calculates statistical rarity.";

  private readonly METAPLEX_CORE = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";

  async initialize(db: DatabaseClient): Promise<void> {
    console.log("[NFT] Registering Asset Metadata tables...");
    const schema = `
      CREATE TABLE IF NOT EXISTS nft_assets (
        mint TEXT PRIMARY KEY,
        collection TEXT,
        rarity_score REAL,
        attributes TEXT,
        last_update DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await db.execSqlite(schema);
    await db.runDuckDB(schema);
    console.log("[NFT] Initialized.");
  }

  async processTransaction(tx: any, db: DatabaseClient): Promise<void> {
    const instructions = tx.instructions || [];
    for (const ix of instructions) {
      if (ix.programId === this.METAPLEX_CORE) {
        try {
          console.log(`[NFT] Metaplex Core Operation: ${tx.signature.slice(0,8)}`);
          // Logic to extract asset mint and attributes from plugin logs
          // Placeholder for 2026-style attribute extraction
        } catch (err: any) {
          console.error(`[NFT] Processing Error: ${err.message}`);
        }
      }
    }
  }

  extendServer(app: any): void {
    console.log("[NFT] Registering API: /api/nft/rarity/:mint");

    app.get('/api/nft/rarity/:mint', async (req: any, res: any) => {
        const { db } = require('../../aether-core/src/db/client');
        try {
          const rows = await db.querySqlite("SELECT * FROM nft_assets WHERE mint = ?", [req.params.mint]);
          if (rows.length === 0) {
            return res.status(404).json({ error: "Asset not found" });
          }
          res.json(rows[0]);
        } catch (err) {
          res.status(500).json({ error: "Failed to fetch rarity data" });
        }
      });

    app.get('/api/nft/collection/:id', async (req: any, res: any) => {
        const { db } = require('../../aether-core/src/db/client');
        try {
          const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
          const offset = parseInt(req.query.offset) || 0;
          const rows = await db.querySqlite("SELECT * FROM nft_assets WHERE collection = ? ORDER BY rarity_score DESC LIMIT ? OFFSET ?", [req.params.id, limit, offset]);
          res.json({
            collection: req.params.id,
            count: rows.length,
            limit,
            offset,
            data: rows
          });
        } catch (err) {
          res.status(500).json({ error: "Failed to fetch collection data" });
        }
      });
  }
}
