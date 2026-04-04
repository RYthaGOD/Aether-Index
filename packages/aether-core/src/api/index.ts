import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ApolloServer, gql } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { db } from '../db/client';
import { WebhookReceiver } from './receiver';
import { WebhookManager } from '../worker/webhook_manager';
import { GuardWorker } from '../worker/guardian';
import { config } from '../config';
import { ShardLockModule } from '../modules/shard_lock';
import { UniversalModule } from '../modules/universal';
import { AgenticModule } from '@aether/agentic';
import { ZkModule } from '@aether/zk';
import { LendingModule } from '@aether/lending';
import { NftModule } from '@aether/nft';
import fs from 'fs';
import path from 'path';

const typeDefs = gql`
    type ShardLocation {
        node_pubkey: String
        shard_count: Int
        status: String
        last_heartbeat: String
    }

    type Query {
        getShardLocations(merkleRoot: String!): [ShardLocation]
    }
`;

const resolvers = {
    Query: {
        getShardLocations: async (_: any, { merkleRoot }: { merkleRoot: string }) => {
            try {
                return await db.getShardLocations(merkleRoot);
            } catch (err) {
                console.error('[Librarian] Error fetching shard locations:', err);
                return [];
            }
        }
    }
};

import { IdlFetcher } from '../worker/idl_fetcher';

async function startServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // 1. Static Asset Anchoring (Neon-Pulp Front Door)
    let frontendPath = path.resolve(process.cwd(), 'frontend');
    if (!fs.existsSync(frontendPath)) {
        // Workspace climbing: Check one level up (Monorepo Root)
        frontendPath = path.resolve(process.cwd(), '..', '..', 'frontend');
        if (!fs.existsSync(frontendPath)) {
            // Last resort: Absolute check from current file location to dist
            frontendPath = path.resolve(__dirname, '..', '..', '..', '..', 'frontend');
        }
    }

    if (fs.existsSync(frontendPath)) {
        const files = fs.readdirSync(frontendPath);
        console.log(`[Librarian] Static Assets anchored at: ${frontendPath}`);
        console.log(`[Librarian] Contents: ${files.join(', ')}`);
    } else {
        console.warn(`[Librarian] ⚠️ Landing page portal not found at expected paths.`);
    }

    // High-priority static server
    app.use(express.static(frontendPath));

    // Explicit catch-all for SPA landing (Restores Neon-Pulp Interface)
    app.get('/', (_req, res) => {
        const indexPath = path.join(frontendPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send('Librarian: Entry portal (index.html) missing.');
        }
    });

    // 2. The Discovery Engine: Configuration & Portal
    const idlPath = path.resolve(process.cwd(), 'data', 'idls');
    const idlFetcher = new IdlFetcher(config.solana.rpcUrl, idlPath);
    const activeModules: { [programId: string]: UniversalModule } = {};

    // API Healthcheck: Proof of Speed Manifest
    app.get('/api/health', async (_req, res) => {
        let networkSlot = 0;
        try {
            // Fetching the current high-water-mark slot from RPC
            const rpcRes = await fetch(config.solana.rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" })
            });
            const rpcData : any = await rpcRes.json();
            networkSlot = rpcData.result || 0;
        } catch (e) {
            console.warn('[Librarian] Health RPC failure:', (e as any).message);
        }

        const lastSlot = await db.getLastIndexedSlot().catch(() => 0);

        res.json({
            status: 'ONLINE',
            service: 'Aether Librarian',
            uptime: Math.round(process.uptime()),
            redis: db['redis']?.isOpen ? 'CONNECTED' : 'DISCONNECTED',
            lastSlot,
            networkSlot,
            timestamp: new Date().toISOString()
        });
    });

    // Discovery Engine: On-Demand Indexing Pipeline
    app.post('/api/v1/universal/index', async (req: any, res: any) => {
        const { programId } = req.body;
        if (!programId) return res.status(400).json({ error: 'Program ID required' });

        try {
            if (activeModules[programId]) {
                return res.json({ message: 'Librarian is already indexing this program.', programId });
            }

            const idl = await idlFetcher.fetchIdl(programId);
            if (!idl) return res.status(404).json({ error: 'No on-chain IDL discovered for this program.' });

            const idlFilePath = path.join(idlPath, `${programId}.json`);
            const module = new UniversalModule(programId, idlFilePath);
            
            await module.initialize(db);
            module.extendServer(app, db);
            activeModules[programId] = module;

            res.json({
                message: '⚡ Discovery Complete. Librarian is now indexing.',
                programId,
                name: (idl as any).name || 'Unknown'
            });
        } catch (err: any) {
            res.status(500).json({ error: `Discovery failure: ${err.message}` });
        }
    });

    const httpServer = createServer(app);
    const schema = makeExecutableSchema({ typeDefs, resolvers });

    const server = new ApolloServer({
        schema,
        introspection: true,
        context: async () => {
            return {};
        }
    });

    await server.start();
    server.applyMiddleware({ app: app as any });

    const PORT = config.server.port;
    httpServer.listen(PORT, '0.0.0.0', async () => {
        console.log(`\n================================\n🚀 AETHER LIBRARIAN ONLINE\n📡 Gateway: http://127.0.0.1:${PORT}${server.graphqlPath}\n================================`);

        try {
            await db.init();

            // ================================================
            await WebhookReceiver.registerModule(new ShardLockModule(), app);
            await WebhookReceiver.registerModule(new AgenticModule(), app);
            await WebhookReceiver.registerModule(new ZkModule(), app);
            await WebhookReceiver.registerModule(new LendingModule(), app);
            await WebhookReceiver.registerModule(new NftModule(), app);

            // ================================================
            const idlDir = path.resolve(process.cwd(), 'data/idls');
            const syncUniversalModules = async () => {
                if (!fs.existsSync(idlDir)) return;
                const idlFiles = fs.readdirSync(idlDir).filter(f => f.endsWith('.json'));
                for (const file of idlFiles) {
                    try {
                        const idlPath = path.join(idlDir, file);
                        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
                        const programId = file.replace('.json', '');
                        if (programId.length >= 32) {
                            await WebhookReceiver.registerModule(new UniversalModule(programId, idlPath), app);
                        }
                    } catch (e) {
                        console.error(`[Librarian] Failed to load IDL ${file}:`, e);
                    }
                }
            };

            await syncUniversalModules();

            // Hot-Hook Watcher: Re-syncing IDLs and Webhooks on the fly
            if (!fs.existsSync(idlDir)) {
                fs.mkdirSync(idlDir, { recursive: true });
            }

            fs.watch(idlDir, async (event, filename) => {
                if (filename && filename.endsWith('.json')) {
                    console.log(`[Librarian] Hot-Hook Change Detected: ${filename}`);
                    await syncUniversalModules();
                    await WebhookManager.orchestrate().catch(e => console.error('[Librarian] Hot-Hook Webhook Sync Warning:', e.message));
                }
            });
            // ================================================

            WebhookReceiver.setup(app as any);
            await WebhookManager.orchestrate().catch(e => console.error('[Librarian] Helius Orchestration Warning:', e.message));
            await GuardWorker.start();

            // Graceful Shutdown Logic
            const shutdown = async () => {
                console.log('\n[Librarian] Termination signal received.');
                await WebhookReceiver.shutdown();
                process.exit(0);
            };

            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);

        } catch (err) {
            console.error('⚠️ Librarian initialization failed:', err);
        }

        setInterval(async () => {
            await db.runShardMaintenance().catch((e: any) => console.error('[Librarian] Maintenance Error:', e.message));
            console.log('[Librarian] Shard maintenance sweep complete.');
        }, 5 * 60 * 1000);
    });
}

startServer().catch(err => {
    console.error('❌ Critical Startup Error:', err);
    process.exit(1);
});
