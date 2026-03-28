import { AetherSDK } from '../src/index';
import chalk from 'chalk';

/**
 * Aether SDK Integration Test
 * Verifies that the SDK can consume data from all modular endpoints.
 */
async function testSDK() {
  console.log(chalk.blue.bold('\n🧪 Testing Aether SDK Integration...'));

  const sdk = new AetherSDK({ url: 'http://localhost:4000' });

  try {
    // 1. Check Lending
    console.log(chalk.yellow('📡 Fetching Lending Liquidations...'));
    const liquidations = await sdk.lending.getLiquidations();
    console.log(chalk.green(`✅ Lending: Received ${liquidations.length} records.`));

    // 2. Check Agentic
    console.log(chalk.yellow('📡 Fetching Agentic Narratives...'));
    const narratives = await sdk.agentic.getNarratives();
    console.log(chalk.green(`✅ Agentic: Received ${narratives.length} records.`));

    // 3. Check ZK
    console.log(chalk.yellow('📡 Fetching ZK Proofs...'));
    const proofs = await sdk.zk.getProofs();
    console.log(chalk.green(`✅ ZK: Received ${proofs.length} records.`));

    console.log(chalk.blue.bold('\n🏆 SDK INTEGRATION VERIFIED: Universal Data Layer is LIVE.\n'));
  } catch (err: any) {
    console.warn(chalk.red(`\n❌ SDK TEST FAILED: ${err.message}`));
    console.log(chalk.gray('Ensure the Aether server is running and modules are initialized.\n'));
  }
}

testSDK();
