import { PublicKey } from '@solana/web3.js';
import { solanaConnection, config } from '../config';
import { SwapParser } from './parser';
import { db } from '../db/client';
import Client, { CommitmentLevel, SubscribeRequest } from '@triton-one/yellowstone-grpc';

export class Streamer {
    private isRunning: boolean = false;
    private client: Client | null = null;

    constructor() {
        // Helius gRPC URL usually requires hostname and API key separately for this client
        // Format: grpc.helius-rpc.com
        const grpcHost = 'grpc.helius-rpc.com';
        this.client = new Client(`https://${grpcHost}`, config.helius.apiKey, undefined);
    }

    /**
     * Helius LaserStream gRPC (Devnet $0 Tier)
     * High-speed typed data ingestion for sub-second precision.
     */
    async setupGRPCStream() {
        if (!this.client) return;

        console.log('Connecting to Helius LaserStream gRPC (Devnet)...');

        const stream = await this.client.subscribe();

        const request: SubscribeRequest = {
            accounts: {},
            slots: {},
            transactions: {
                raydium: {
                    vote: false,
                    failed: false,
                    signature: undefined,
                    accountInclude: ['675k1q2u71c6u2kzjd5L54Vf7U2z6u64f8D22C1u66v'], // Raydium V4
                    accountExclude: [],
                    accountRequired: []
                }
            },
            blocks: {},
            blocksMeta: {},
            accountsDataSlice: [],
            entry: {},
            commitment: CommitmentLevel.CONFIRMED
        };

        return new Promise<void>((resolve, reject) => {
            stream.on('data', async (data: any) => {
                if (data.transaction) {
                    try {
                        // In a real scenario, Yellowstone provides a different format than standard RPC.
                        // We would adapt the SwapParser to handle Yellowstone's message format.
                        console.log(`[gRPC] New Transaction: ${data.transaction.transaction.signature}`);

                        // Placeholder for actual parsing of gRPC messages
                        // const events = await SwapParser.parseYellowstone(data.transaction);
                    } catch (err) {
                        console.error('Error processing gRPC transaction:', err);
                    }
                }
            });

            stream.on('error', (err: any) => {
                console.error('gRPC Stream Error:', err);
                // Attempt reconnection in production
            });

            stream.write(request, (err: any) => {
                if (err) {
                    console.error('Subscription error:', err);
                    reject(err);
                }
            });
        });
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('Initializing Database...');
        await db.init();

        console.log('Streamer Started (Devnet gRPC Mode).');

        try {
            await this.setupGRPCStream();
        } catch (err) {
            console.error('Failed to start gRPC stream, falling back to WebSockets...', err);
            this.startWebsocketFallback();
        }
    }

    private startWebsocketFallback() {
        const RAYDIUM_PROGRAM_ID = '675k1q2u71c6u2kzjd5L54Vf7U2z6u64f8D22C1u66v';
        solanaConnection.onLogs(
            new PublicKey(RAYDIUM_PROGRAM_ID),
            async (logs) => {
                try {
                    const tx = await solanaConnection.getParsedTransaction(logs.signature, {
                        maxSupportedTransactionVersion: 0,
                        commitment: 'confirmed'
                    });
                    if (!tx) return;
                    const events = await SwapParser.parseTransaction(tx);
                    for (const event of events) {
                        await db.insertSwapToSQLite(event);
                        await db.insertToDuckDB([event]);
                    }
                    await db.updateSyncState(tx.slot);
                } catch (err) {
                    console.error('WS Fallback parsing error:', err);
                }
            },
            'confirmed'
        );
    }
}

if (require.main === module) {
    const streamer = new Streamer();
    streamer.start().catch(console.error);
}
