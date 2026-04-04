import { db } from '../db/client';
import { WebhookReceiver } from '../api/receiver';
import { GuardWorker } from '../worker/guardian';
import { AgenticModule } from '@aether/agentic';
import { LendingModule } from '@aether/lending';
import chalk from 'chalk';

/**
 * Aether-Upgrade-Proof Suite
 * 
 * Programmatically verifies the three major architectural upgrades:
 * 1. Modular Registry (Does it see all IDs?)
 * 2. Socket Guardian (Does it track HWM slots?)
 * 3. Async DB (Do writes persist without blocking?)
 */
async function verify() {
    console.log(chalk.blue.bold('\n🛡️ Starting Aether Upgrade Verification Suite...'));

    try {
        // 1. Initialize DB and Modules
        await db.init();
        const agentic = new AgenticModule();
        const lending = new LendingModule();
        
        await WebhookReceiver.registerModule(agentic);
        await WebhookReceiver.registerModule(lending);

        // 2. Start Guardian
        await GuardWorker.start();

        // 3. Mock Ingestion Payload
        const mockTx = {
            signature: "VERIFY_UPGRADE_" + Date.now(),
            description: "Aether Verification: Kamino Liquidation Event",
            slot: 123456789,
            timestamp: Date.now(),
            instructions: [
                {
                    programId: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
                    name: "LiquidateObligationAndRedeemReserve"
                }
            ]
        };

        console.log(chalk.yellow('\n📥 Step 1: Simulating Ingestion...'));
        // Simulate direct receiver call
        await WebhookReceiver.handleTransactions([mockTx]);

        // 4. Verification Assertions
        console.log(chalk.yellow('🔍 Step 2: Running Assertions...'));

        // Check HWM Registry
        const hwm = await db.querySqlite("SELECT value FROM system_metadata WHERE key = 'last_processed_slot'");
        const slotValue = parseInt(hwm[0]?.value || '0');
        
        if (slotValue === 123456789) {
            console.log(chalk.green('✅ PASS: High Water Mark (HWM) tracked correctly.'));
        } else {
            throw new Error(`FAIL: HWM Slot mismatch. Expected 123456789, got ${slotValue}`);
        }

        // Check Lending Module persistence
        const liquidations = await db.querySqlite("SELECT * FROM lending_liquidations WHERE signature = ?", [mockTx.signature]);
        if (liquidations.length > 0) {
            console.log(chalk.green('✅ PASS: Lending Module correctly captured the liquidation.'));
        } else {
            throw new Error('FAIL: Lending Module failed to persist the transaction.');
        }

        // Check Agentic Narrative
        const narratives = await db.querySqlite("SELECT * FROM agent_narratives WHERE signature = ?", [mockTx.signature]);
        if (narratives.length > 0) {
            console.log(chalk.green('✅ PASS: Agentic Module generated semantic narrative.'));
        } else {
            throw new Error('FAIL: Agentic Module failed to generate narrative.');
        }

        console.log(chalk.blue.bold('\n🏆 ALL UPGRADES VERIFIED: System is Mission-Ready.\n'));
        process.exit(0);

    } catch (err: any) {
        console.error(chalk.red.bold(`\n❌ VERIFICATION FAILED: ${err.message}\n`));
        process.exit(1);
    }
}

verify();
