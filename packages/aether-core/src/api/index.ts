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
// @ts-ignore
import { AgenticModule } from '../../aether-agentic/src/index';
// @ts-ignore
import { ZkModule } from '../../aether-zk/src/index';
// @ts-ignore
import { LendingModule } from '../../aether-lending/src/index';
// @ts-ignore
import { NftModule } from '../../aether-nft/src/index';
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

async function startServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Serve Frontend Statically (Deployment Ready for Railway)
    // __dirname in production is /app/packages/aether-core/dist/api
    const frontendPath = path.resolve(__dirname, '../../../../frontend');
    app.use(express.static(frontendPath));

    // API Healthcheck
    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'ONLINE',
            service: 'Aether Librarian',
            uptime: Math.round(process.uptime()),
            timestamp: new Date().toISOString()
        });
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
