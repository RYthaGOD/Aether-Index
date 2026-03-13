import { PublicKey } from '@solana/web3.js';
import { solanaConnection, config } from '../config';
import { SwapParser } from './parser';
import { db } from '../db/client';
import axios from 'axios';
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
     * Helius LaserStream gRPC
     * Expanded to cover all major DEX programs for global indexing.
     */
    async setupGRPCStream() {
        if (!this.client) return;

        let retryCount = 0;
        const maxRetries = 10;
        const baseDelay = 1000;

        const connect = async () => {
            console.log('Connecting to Helius LaserStream gRPC...');
            const stream = await this.client!.subscribe();
            
            const request: SubscribeRequest = {
                accounts: {},
                slots: {},
                transactions: {
                    global_dex: {
                        vote: false,
                        failed: false,
                        signature: undefined,
                        accountInclude: [
                            '675k1q2u71c6u2kzjd5L54Vf7U2z6u64f8D22C1u66v', // Raydium V4
                            'JUP6LkbZbZ9zaS8fXmBaWpHiPshNreDks5DWB6E9p6v', // Jupiter
                            'whirLbMiq69LHTEjq2tYgjSry9Y7yYYy38vj4pY67u3', // Orca WHIRLPOOL
                            'Phx21u2vY2q7mS1mlT9Y66id2YCcSp7A6iXmG4YY6Yd', // Phoenix
                            'opnbY3M4WvYn66tGatvUnV3356889mP4o5A84RLByN', // OpenBook
                        ],
                        accountExclude: [],
                        accountRequired: []
                    }
                },
                blocks: {},
                blocksMeta: {},
                transactionsStatus: {},
                accountsDataSlice: [],
                entry: {},
                commitment: CommitmentLevel.CONFIRMED
            };

            return new Promise<void>((resolve, reject) => {
                let batch: any[] = [];
                const BATCH_SIZE = 50;
                const BATCH_TIMEOUT = 1000;

                const flushBatch = async () => {
                    if (batch.length === 0) return;
                    const toProcess = [...batch];
                    batch = [];
                    try {
                        await db.insertToDuckDB(toProcess);
                        console.log(`[gRPC] Flushed ${toProcess.length} swaps to DuckDB.`);
                    } catch (err) {
                        console.error('Failed to flush batch:', err);
                    }
                };

                setInterval(flushBatch, BATCH_TIMEOUT);

                stream.on('data', async (data: any) => {
                    if (data.transaction) {
                        try {
                            const transaction = data.transaction.transaction;
                            const slot = data.transaction.slot;
                            const signature = transaction.signature;
                            
                            console.log(`[gRPC] Activity: ${signature}`);
                            
                            // 1. Transform Yellowstone message to Parser-friendly format
                            // Note: In production, we'd use a dedicated mapper for protobuf -> ParsedTransactionWithMeta
                            // Here we call the parser with a structured mock of the transaction data
                            const events = await SwapParser.parseTransaction({
                                slot,
                                transaction: {
                                    signatures: [signature],
                                    message: { accountKeys: transaction.transaction.message.accountKeys.map((k: any) => ({ pubkey: k })) }
                                },
                                meta: {
                                    logMessages: transaction.meta.logMessages,
                                    preTokenBalances: transaction.meta.preTokenBalances,
                                    postTokenBalances: transaction.meta.postTokenBalances,
                                }
                            } as any);

                            for (const event of events) {
                                batch.push(event);
                                
                                // 2. Metadata Discovery: Queue new mints for enrichment
                                this.queueMetadataEnrichment(event.tokenIn);
                                this.queueMetadataEnrichment(event.tokenOut);
                            }

                            if (batch.length >= BATCH_SIZE) await flushBatch();
                        } catch (err) {
                            console.error('Error processing gRPC transaction:', err);
                        }
                    }
                });

                stream.on('error', async (err: any) => {
                    console.error('gRPC Stream Error:', err);
                    if (retryCount < maxRetries) {
                        retryCount++;
                        const delay = baseDelay * Math.pow(2, retryCount);
                        console.log(`Retrying in ${delay}ms... (Attempt ${retryCount})`);
                        setTimeout(connect, delay);
                    } else {
                        reject(new Error('Max gRPC retries reached.'));
                    }
                });

                stream.write(request, (err: any) => {
                    if (err) {
                        console.error('Subscription error:', err);
                        reject(err);
                    }
                });
            });
        };

        await connect();
    }

    private metadataQueue: Set<string> = new Set();
    private async queueMetadataEnrichment(mint: string) {
        if (this.metadataQueue.has(mint)) return;
        this.metadataQueue.add(mint);
        
        setTimeout(async () => {
            try {
                console.log(`[Discovery] Enriching Metadata via DAS: ${mint}`);
                
                const response = await axios.post(`https://mainnet.helius-rpc.com/?api-key=${config.helius.apiKey}`, {
                    jsonrpc: "2.0",
                    id: "my-id",
                    method: "getAsset",
                    params: {
                        id: mint,
                        displayOptions: { showFungible: true }
                    }
                });

                const metadata = response.data.result;
                if (metadata && metadata.content) {
                    const info = {
                        mint,
                        symbol: metadata.content.metadata?.symbol || 'UNKNOWN',
                        name: metadata.content.metadata?.name || 'Unknown Token',
                        decimals: metadata.token_info?.decimals || 9
                    };
                    
                    await db.upsertToken(info);
                    console.log(`[Discovery] Successfully Enriched: ${info.symbol}`);
                }
            } catch (err) {
                console.error(`[Discovery] DAS Enrichment Failed for ${mint}:`, err);
            } finally {
                this.metadataQueue.delete(mint);
            }
        }, 2000); 
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
