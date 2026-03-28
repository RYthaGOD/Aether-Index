import { EnhancedTransaction } from "helius-sdk";
import { AetherModule } from "aether-shared";
import { ShardParser } from "../worker/shard_parser";

/**
 * Shard-Lock (Librarian) Module
 * 
 * Legacy module refactored for the new Aether modular engine.
 * Indexes shard-lock heartbeats for the Seeker Swarm decentralized network.
 */
export class ShardLockModule implements AetherModule {
  public id = "aether-shard-lock";
  public name = "Aether Shard-Lock Librarian";
  public description = "Indexes decentralized storage shard heartbeats.";

  async initialize(db: any): Promise<void> {
    // Shard-lock tables are already in the core schema for now, 
    // but we could move them here in a future iteration.
    console.log("[ShardLock] Initialized.");
  }

  extendServer(app: any): void {
    console.log("[ShardLock] Registering API: /api/shard-lock/locations/:merkleRoot");

    app.get('/api/shard-lock/locations/:merkleRoot', async (req: any, res: any) => {
        const { db } = require('../../aether-core/src/db/client');
        try {
          const rows = await db.querySqlite("SELECT * FROM shard_locks WHERE merkle_root = ? AND status = 'ONLINE'", [req.params.merkleRoot]);
          res.json(rows);
        } catch (err) {
          res.status(500).json({ error: "Failed to fetch shard locations" });
        }
      });
  }

  async processTransaction(tx: EnhancedTransaction, db: any): Promise<void> {
    const instructions = tx.instructions || [];
    for (const ix of instructions) {
      if (ix.programId === 'GtmN6x2aPYq6LkbJTj1qxm5Jn6zGQNWsgG9NFnx1QaEu') {
        const accounts = ix.accounts || []; 
        const shardEvent = ShardParser.parseInstruction(ix.data, accounts);
        
        if (shardEvent) {
          console.log(`[Librarian] Shard Heartbeat Indexed: Node ${shardEvent.nodePubkey.slice(0,8)}`);
          await db.insertShardLock(shardEvent);
        }
      }
    }
  }
}
