import { LendingModule } from "../src/index";

/**
 * Verification Script: Aether-Lending
 * 
 * Simulates a liquidation event on Kamino/Save.
 */
async function verifyLending() {
  console.log("--- [Verify] Aether-Lending ---");
  
  const module = new LendingModule();
  const mockDb = {
    execSqlite: async (sql: string) => console.log(`[Mock DB] Exec: ${sql.slice(0, 50)}...`),
    runSqlite: async (sql: string, params: any[]) => {
      console.log(`[Mock DB] Run: ${sql}`);
      console.log(`[Mock DB] Params: ${JSON.stringify(params)}`);
    },
    runDuckDB: async (sql: string, params: any[]) => {
      console.log(`[Mock DB] Analytics (DuckDB): ${sql.slice(0, 50)}...`);
    }
  } as any;

  await module.initialize(mockDb);

  const mockTx = {
    signature: "TEST_SIG_LENDING_001",
    instructions: [
      {
        programId: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD", // Kamino V2
        name: "LiquidateObligationAndRedeemReserve"
      }
    ]
  };

  console.log("[Test] Processing Mock Liquidation...");
  await module.processTransaction(mockTx, mockDb);
  
  console.log("--- [Verify] Lending Complete ---\n");
}

verifyLending().catch(console.error);
