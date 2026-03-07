import express from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import { config } from './config';
import { db } from './db/client';

const typeDefs = gql`
    type Ohlcv {
        timestamp: String
        open: Float
        high: Float
        low: Float
        close: Float
        volume: Float
    }

    type Query {
        getHistory(tokenAddress: String!, interval: String!): [Ohlcv]
    }
`;

const resolvers = {
    Query: {
        getHistory: async (_: any, { tokenAddress, interval }: { tokenAddress: string, interval: string }) => {
            try {
                // Interval mapping (e.g., '1m', '15m', '1h')
                const history = await db.getHistory(tokenAddress, interval);
                return history;
            } catch (err) {
                console.error('Error fetching history:', err);
                return [];
            }
        }
    }
};

async function startServer() {
    const app = express();
    const server = new ApolloServer({ typeDefs, resolvers });

    await server.start();
    server.applyMiddleware({ app });

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`🚀 Gateway ready at http://localhost:${PORT}${server.graphqlPath}`);
    });
}

startServer().catch(console.error);
