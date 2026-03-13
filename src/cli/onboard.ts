import { db } from '../db/client';
import crypto from 'crypto';
import chalk from 'chalk';

async function onboard() {
    console.log(chalk.yellow('\n--- 🌌 AetherIndex: Developer Onboarding Tool ---'));
    
    const args = process.argv.slice(2);
    const command = args[0];

    await db.initSqliteOnly();

    if (command === 'create') {
        const tier = (args[1] || 'FREE').toUpperCase();
        const customKey = args[2];
        const apiKey = customKey || `aether_${crypto.randomBytes(16).toString('hex')}`;
        
        let rateLimit = 10;
        if (tier === 'PRO') rateLimit = 100;
        if (tier === 'INSTITUTIONAL') rateLimit = 1000;

        try {
            await db.createSubscription(apiKey, tier, rateLimit);
            console.log(chalk.green(`\n✅ Subscription Created!`));
            console.log(`${chalk.bold('Tier:')} ${tier}`);
            console.log(`${chalk.bold('RPM:')} ${rateLimit}`);
            console.log(`${chalk.bold('API Key:')} ${chalk.cyan(apiKey)}`);
            console.log(chalk.gray('\nSave this key. It cannot be recovered.'));
        } catch (err: any) {
            console.error(chalk.red('\n❌ Failed to create subscription:'), err.message);
        }
    } else if (command === 'list') {
        console.log(chalk.blue('\n--- Active Subscriptions ---'));
        // We'd need a list helper in DBClient, but for now we'll just query sqlite directly
        (db as any).sqlite.all('SELECT api_key, tier, rate_limit_rpm FROM subscriptions', (err: any, rows: any[]) => {
            if (err) return console.error(err);
            rows.forEach(r => {
                console.log(`[${chalk.bold(r.tier)}] ${r.api_key} (${r.rate_limit_rpm} RPM)`);
            });
            process.exit(0);
        });
    } else {
        console.log('\nUsage:');
        console.log('  npx ts-node src/cli/onboard.ts create [FREE|PRO|INSTITUTIONAL] [optional_custom_key]');
        console.log('  npx ts-node src/cli/onboard.ts list');
        process.exit(0);
    }
}

onboard().catch(err => {
    console.error(err);
    process.exit(1);
});
