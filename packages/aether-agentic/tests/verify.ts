import { AgenticModule } from "../src/index";

/**
 * Verification Script: Aether-Agentic
 * 
 * Simulates a Helius Enhanced Transaction to verify narrative generation
 * and SQLite persistence.
 */
async function verifyAgentic() {
  console.log("--- [Verify] Aether-Agentic ---");
  
  const module = new AgenticModule();
  const mockDb = {
    execSqlite: async (sql: string) => console.log(`[Mock DB] Exec: ${sql.slice(0, 50)}...`),
    runSqlite: async (sql: string, params: any[]) => {
      console.log(`[Mock DB] Run: ${sql}`);
      console.log(`[Mock DB] Params: ${JSON.stringify(params)}`);
    }
  };

  await module.initialize(mockDb);

  const mockTx = {
    signature: "TEST_SIG_AGENTIC_001",
    description: "User swapped 1 SOL for 200 USDC on Jupiter",
    slot: 12345678,
    timestamp: Date.now()
  };

  console.log("[Test] Processing Mock Transaction...");
  await module.processTransaction(mockTx, mockDb);
  
  console.log("--- [Verify] Agentic Complete ---\n");
}

verifyAgentic().catch(console.error);
