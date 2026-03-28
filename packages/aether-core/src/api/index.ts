import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ApolloServer, gql } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { db } from '../db/client';
import { WebhookReceiver } from './receiver';
import { WebhookManager } from '../worker/webhook_manager';
import { config } from '../config';
import { ShardLockModule } from '../modules/shard_lock';
import { AgenticModule } from '../../aether-agentic/src/index';
import { ZkModule } from '../../aether-zk/src/index';
import { LendingModule } from '../../aether-lending/src/index';
import { NftModule } from '../../aether-nft/src/index';

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
            
            // Module Registration Phase
            // ================================================
            await WebhookReceiver.registerModule(new ShardLockModule());
            await WebhookReceiver.registerModule(new AgenticModule());
            await WebhookReceiver.registerModule(new ZkModule());
            await WebhookReceiver.registerModule(new LendingModule());
            await WebhookReceiver.registerModule(new NftModule());
            // ================================================

            WebhookReceiver.setup(app as any);
            await WebhookManager.orchestrate().catch(e => console.error('[Librarian] Helius Orchestration Warning:', e.message));

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
