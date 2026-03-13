import express from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import { config } from '../config';
import { db } from '../db/client';

const typeDefs = gql`
    type Token {
        mint: String
        symbol: String
        name: String
        decimals: Int
    }

    type Ohlcv {
        window_start: String
        open: Float
        high: Float
        low: Float
        close: Float
        volume: Float
    }

    type Query {
        getHistory(tokenAddress: String!, interval: String!): [Ohlcv]
        searchTokens(query: String!): [Token]
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
