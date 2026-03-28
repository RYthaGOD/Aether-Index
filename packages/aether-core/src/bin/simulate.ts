import axios from 'axios';
import chalk from 'chalk';

/**
 * Local Transaction Simulator
 * 
 * Pushes mock Helius Enhanced Transactions to the local Aether receiver
 * to verify module logic without needing a real webhook.
 */
async function simulate() {
  const PORT = process.env.PORT || 4000;
  const URL = `http://localhost:${PORT}/helius-webhook`;

  const mockTransactions = [
    {
      signature: "SIM_SIG_" + Math.random().toString(36).substring(7),
      description: "SIMULATOR_BRIDGE: Verification Payload for Aether Upgrades",
      slot: Math.floor(Date.now() / 1000),
      timestamp: Date.now(),
      instructions: [
        {
          programId: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD", // Kamino
          name: "LiquidateObligationAndRedeemReserve"
        }
      ]
    }
  ];

  console.log(chalk.yellow(`\n📡 Pushing simulated transaction to ${URL}...`));

  try {
    const response = await axios.post(URL, mockTransactions, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200) {
      console.log(chalk.green('✅ Simulator: Transaction accepted by Core Dispatcher.'));
    }
  } catch (err: any) {
    console.error(chalk.red(`❌ Simulator Failed: ${err.message}`));
    console.log(chalk.gray('Ensure the Aether server is running (npm run dev)'));
  }
}

simulate();
