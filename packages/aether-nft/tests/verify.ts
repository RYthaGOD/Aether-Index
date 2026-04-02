import { NftModule } from "../src/index";

/**
 * Verification Script: Aether-NFT
 * 
 * Simulates a Metaplex Core operation.
 */
async function verifyNft() {
  console.log("--- [Verify] Aether-NFT ---");
  
  const module = new NftModule();
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
    signature: "TEST_SIG_NFT_001",
    instructions: [
      {
        programId: "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d", // Metaplex Core
        name: "CreateAndMint"
      }
    ]
  };

  console.log("[Test] Processing Mock NFT Transaction...");
  await module.processTransaction(mockTx, mockDb);
  
  console.log("--- [Verify] NFT Complete ---\n");
}

verifyNft().catch(console.error);
