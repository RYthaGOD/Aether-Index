import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { execute, subscribe } from 'graphql';
import { ApolloServer, gql } from 'apollo-server-express';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { config, solanaConnection } from '../config';
import { db } from '../db/client';
import { pubsub } from '../worker/pubsub';
import { WebhookReceiver } from './receiver';
import { rateLimiter } from './rate_limiter';
import { WebhookManager } from '../worker/webhook_manager';
import { PriceOracle } from '../worker/parser';
import { IndexManager } from '../worker/index_manager';

// PRO Features (Isolated)
let AlphaDiscovery: any;
try {
    AlphaDiscovery = require('../../pro/worker/alpha_discovery').AlphaDiscovery;
} catch (e) {
    console.log('[Sovereign] PRO features not detected in core environment.');
}

// Debug PubSub Initialization
console.log('[Sovereign] PubSub Engine Status:', typeof (pubsub as any).asyncIterableIterator === 'function' ? 'READY' : 'FAULT');

const typeDefs = gql`
    type Token {
        mint: String
        symbol: String
        name: String
        decimals: Int
        rank: Int
        isTop100: Boolean
    }

    type Ohlcv {
        window_start: String
        open: Float
        high: Float
        low: Float
        close: Float
        volume: Float
    }

    type PriceDrift {
        raydium: Float
        orca: Float
        meteora: Float
        slot: Int
        timestamp: String
    }

    type Subscription {
        priceUpdated(tokenAddress: String!): Ohlcv
        priceDrift: PriceDrift
        newSwap: Swap
    }

    type Swap {
        signature: String
        tokenIn: String
        tokenOut: String
        amountIn: Float
        amountOut: Float
        priceUsd: Float
        dex: String
    }

    type TopMover {
        tokenAddress: String
        current_price: Float
        pct_change: Float
    }

    type VolumeCluster {
        tokenAddress: String
        total_volume: Float
        trade_count: Int
    }
    type Query {
        getHistory(tokenAddress: String!, interval: String!): [Ohlcv]
        searchTokens(query: String!): [Token]
        getTop100Tokens: [Token]
        getTopMovers: [TopMover]
        getVolumeClusters: [VolumeCluster]
    }

    type Mutation {
        triggerIndexing(tokenAddress: String!): Boolean
    }
`;

const resolvers = {
    Query: {
        getHistory: async (_: any, { tokenAddress, interval }: { tokenAddress: string, interval: string }) => {
            try {
                const history = await db.getHistory(tokenAddress, interval);
                return history;
            } catch (err) {
                console.error('Error fetching history:', err);
                return [];
            }
        },
        searchTokens: async (_: any, { query }: { query: string }) => {
            try {
                return await db.searchTokens(query);
            } catch (err) {
                console.error('Error searching tokens:', err);
                return [];
            }
        },
        getTop100Tokens: async () => {
            try {
                const tokens: any = await db.getTop100Tokens();
                return tokens.map((t: any) => ({ ...t, isTop100: true }));
            } catch (err) {
                console.error('Error fetching top 100 tokens:', err);
                return [];
            }
        },
        getTopMovers: async (_: any, __: any, context: any) => {
            if (context.tier === 'FREE') {
                throw new Error('PRO_REQUIRED: getTopMovers requires a SHINOBI (PRO) tier or higher.');
            }
            try {
                return await db.getTopMovers();
            } catch (err) {
                console.error('Error fetching top movers:', err);
                return [];
            }
        },
        getVolumeClusters: async (_: any, __: any, context: any) => {
            if (context.tier === 'FREE') {
                throw new Error('PRO_REQUIRED: getVolumeClusters requires a SHINOBI (PRO) tier or higher.');
            }
            try {
                return await db.getVolumeClusters();
            } catch (err) {
                console.error('Error fetching volume clusters:', err);
                return [];
            }
        }
    },
    Mutation: {
        triggerIndexing: async (_: any, { tokenAddress }: { tokenAddress: string }, context: any) => {
            if (context.tier === 'FREE') {
                throw new Error('PRO_REQUIRED: triggerIndexing requires a SHINOBI (PRO) tier or higher.');
            }
            if (config.isReadOnly) {
                throw new Error('Sovereignty Guard: Engine is in READ_ONLY mode. Write operations are forbidden.');
            }
            try {
                console.log(`[Mutation] Triggering indexing for: ${tokenAddress}`);
                // 1. Initial Metadata Resolve
                await PriceOracle.resolveTokenMetadata(tokenAddress);
                
                return true;
            } catch (err) {
                console.error(`[Mutation] Indexing trigger failed for ${tokenAddress}:`, err);
                return false;
            }
        }
    },
    Subscription: {
        priceUpdated: {
            subscribe: (_: any, { tokenAddress }: { tokenAddress: string }) => {
                return (pubsub as any).asyncIterableIterator([`PRICE_UPDATED_${tokenAddress}`]);
            }
        },
        newSwap: {
            subscribe: () => (pubsub as any).asyncIterableIterator(['SWAP_UPDATED'])
        },
        priceDrift: {
            subscribe: () => (pubsub as any).asyncIterableIterator(['PRICE_DRIFT_UPDATED'])
        }
    }
};


// Schema and Resolvers are defined above

async function startServer() {
    const app = express();
    app.use(cors()); // Enable CORS for Sovereign access
    
    // Serve PRO Dashboard directly from the isolated local-only directory
    app.use('/dashboard', express.static(path.join(__dirname, '../../pro/dashboard')));
    
    const httpServer = createServer(app);
    
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    
    interface AuthContext {
        tier: 'FREE' | 'PRO' | 'PREMIUM' | 'INSTITUTIONAL';
        rateLimitRpm: number;
    }

    const server = new ApolloServer({ 
        schema,
        introspection: true, 
        context: async ({ req }): Promise<AuthContext> => {
            const apiKey = (req.headers['x-aether-key'] as string) || 'anonymous';
            
            let tier: any = 'FREE';
            let limitRpm = 10; // Aggressive anonymous limit

            if (apiKey !== 'anonymous') {
                const subscription = await db.validateApiKey(apiKey);
                if (subscription) {
                    tier = subscription.tier;
                    limitRpm = subscription.rateLimitRpm;
                }
            }
            
            // Enforce Rate Limit
            if (!rateLimiter.isAllowed(apiKey, limitRpm)) {
                throw new Error(`RATE_LIMIT_EXCEEDED: Maximum of ${limitRpm} RPM for your tier (${tier}). Upgrade for higher limits.`);
            }

            return { tier, rateLimitRpm: limitRpm };
        },
        plugins: [{
            async serverWillStart() {
                return {
                    async drainServer() {
                        subscriptionServer.close();
                    }
                };
            }
        }],
    });

    const subscriptionServer = SubscriptionServer.create(
        { 
            schema, 
            execute, 
            subscribe,
            onConnect: () => console.log('📡 Dashboard Linked (Sovereign Connection)')
        },
        { server: httpServer, path: server.graphqlPath }
    );

    await server.start();
    server.applyMiddleware({ app: app as any });

    // --- STATIC ROUTES (Sovereign Flash Aesthetic) ---
    // Serve Landing Page & Dev Portal
    const staticPath = path.join(__dirname, 'static');
    app.use(express.static(staticPath));
    
    // Root serves Landing Page
    app.get('/', (req, res) => {
        res.sendFile(path.join(staticPath, 'index.html'));
    });

    // /dev serves Developer Portal
    app.get('/dev', (req, res) => {
        res.sendFile(path.join(staticPath, 'dev.html'));
    });

    // PRO Dashboard Route (Isolated from public repo)
    app.use('/dashboard', express.static(path.join(__dirname, '../../pro/dashboard')));
    
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, async () => {
        console.log(`🚀 Gateway ready at http://localhost:${PORT}${server.graphqlPath}`);
        console.log(`📡 Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);

        // Initialize Sovereign Components asynchronously after startup
        try {
            WebhookReceiver.setup(app as any);
            await WebhookManager.orchestrate();
            // Market Guard Ignition
            await IndexManager.orchestrate();

            // PRO Alpha Engine Ignition
            if (AlphaDiscovery) {
                console.log('[Sovereign] Igniting PRO Alpha Discovery Engine...');
                await AlphaDiscovery.orchestrate();
            }
        } catch (err) {
            console.warn('⚠️ Sovereign background orchestration bypassed or failed:', err);
        }
    });

    // Start High-Fidelity Price Broadcasting
    setInterval(async () => {
        try {
            await PriceOracle.refreshSolPrice();
            const drift = PriceOracle.getDrift();
            if (drift.raydium > 0) {
                const currentSlot = await solanaConnection.getSlot();
                await pubsub.publish('PRICE_DRIFT_UPDATED', { priceDrift: {
                    ...drift,
                    slot: currentSlot,
                    timestamp: drift.timestamp.toISOString()
                }});
            }
        } catch (err) {
            console.error('[Interval] Price drift broadcast failed:', err);
        }
    }, 500); // 500ms High-Fidelity Pulse
}

startServer().catch(err => {
    console.error('❌ Critical Server Startup Error:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
