#!/usr/bin/env node
const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const program = new Command();

const BANNER = `
${chalk.yellow('⚡🌩️ AETHERINDEX: THE SOVEREIGN ENGINE ⚡🌩️')}
${chalk.gray('--- Built by Rykiri: The Yellow Flash ---')}
`;

console.log(BANNER);

program
  .name('aetherindex')
  .description('Sovereign Solana Indexer CLI')
  .version('1.0.0');

program.command('init')
  .description('Interactive setup for AetherIndex')
  .action(async () => {
    console.log(chalk.blue('Starting Sovereign Setup...\n'));
    
    const responses = await inquirer.prompt([
      {
        type: 'input',
        name: 'heliusKey',
        message: 'Enter your Helius API Key:',
        validate: input => input.length > 10 || 'Invalid API Key'
      },
      {
        type: 'input',
        name: 'webhookUrl',
        message: 'Enter your Public Webhook URL (e.g., https://yourdomain.com/hooks):',
        default: 'http://localhost:4000/helius-webhook'
      },
      {
        type: 'input',
        name: 'rpcUrl',
        message: 'Enter your Solana RPC URL:',
        default: 'https://api.mainnet-beta.solana.com'
      }
    ]);

    const envContent = `
HELIUS_API_KEY=${responses.heliusKey}
HELIUS_WEBHOOK_URL=${responses.webhookUrl}
RPC_URL=${responses.rpcUrl}
WSS_URL=${responses.rpcUrl.replace('https', 'wss')}
PORT=4000
DUCKDB_PATH=./data/indexer.duckdb
SQLITE_PATH=./data/registry.db
`;

    fs.writeFileSync(path.join(process.cwd(), '.env'), envContent.trim());
    
    if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
      fs.mkdirSync(path.join(process.cwd(), 'data'));
    }

    console.log(chalk.green('\n✅ Sovereign Configuration Saved.'));
    console.log(chalk.yellow('Next: Run `aetherindex up` to start the engine.\n'));
  });

program.command('up')
  .description('Start the AetherIndex engine')
  .action(() => {
    const spinner = ora('Igniting the Sovereign Engine...').start();
    
    // Spawn the ts-node process
    const child = spawn('npx', ['ts-node', 'src/api/index.ts'], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.log(chalk.red(`\n❌ Engine failed with code ${code}`));
      }
    });
  });

program.command('backfill')
  .description('Backfill historical Solana data')
  .argument('<start>', 'Start Slot')
  .argument('<end>', 'End Slot')
  .action((start, end) => {
    console.log(chalk.cyan(`🚀 Starting historical re-sync from ${start} to ${end}...`));
    execSync(`npx ts-node src/cli/backfill.ts ${start} ${end}`, { stdio: 'inherit' });
  });

program.command('keys')
  .description('Manage AetherIndex API keys (Subscriptions)')
  .option('-a, --add', 'Add a new key')
  .option('-l, --list', 'List all keys')
  .action(async (options) => {
    // Dynamically import db to avoid requiring build during setup
    const { db } = require('../dist/db/client');
    await db.initSqliteOnly();

    if (options.add) {
      const { key, tier, limit } = await inquirer.prompt([
        { type: 'input', name: 'key', message: 'Enter new API Key (or leave blank for random):', default: () => Math.random().toString(36).substring(2, 15) },
        { type: 'list', name: 'tier', message: 'Select Tier:', choices: ['FREE', 'PRO', 'INSTITUTIONAL'] },
        { type: 'number', name: 'limit', message: 'RPM Limit:', default: (answers) => answers.tier === 'PRO' ? 100 : answers.tier === 'INSTITUTIONAL' ? 1000 : 10 }
      ]);

      await db.createSubscription(key, tier, limit);
      console.log(chalk.green(`\n✅ Subscription Created: ${key} [${tier}] (${limit} RPM)`));
    } else {
      // Logic for listing if required, but adding is the priority for launch
      console.log(chalk.gray('Use --add to create a new subscription key.'));
    }
    process.exit(0);
  });

program.parse();
