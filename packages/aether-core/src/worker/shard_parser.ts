import { Buffer } from 'buffer';

export interface ShardLockEvent {
    merkleRoot: string;
    shardCount: number;
    nodePubkey: string;
}

export class ShardParser {
    // Anchor discriminator for SubmitHeartbeat (Calculated: [156, 17, 23, 219, 237, 102, 17, 27])
    private static HEARTBEAT_DISCRIMINATOR = Buffer.from([156, 17, 23, 219, 237, 102, 17, 27]);

    /**
     * Decodes manual binary layout instructions from Seeker Swarm on-chain ops.
     * Anchor Instruction Layout: [8b Discriminator] + [32b merkle_root] + [4b shard_count]
     */
    static parseInstruction(dataBase58: string, accountKeys: string[]): ShardLockEvent | null {
        try {
            const buffer = Buffer.from(dataBase58, 'base64'); // Helius provides data in base64/base58 based on setup
            if (buffer.length < 44) return null;

            const disc = buffer.slice(0, 8);
            if (!disc.equals(this.HELIUS_DISCRIMINATOR_MATCH(disc))) return null;

            // 1. Extract Shard Merkle Root
            const merkleRootBuffer = buffer.slice(8, 40);
            const merkleRootHex = merkleRootBuffer.toString('hex');

            // 2. Extract Shard Count (u32 LE)
            const shardCount = buffer.readUInt32LE(40);

            // 3. Extract Node Pubkey (The `owner` or `feePayer` submitting it)
            // By standard Anchor index setups for SubmitHeartbeat:
            // Accounts generally are: [config, storage_state, owner/signer, system_program]
            // Safe fallback is fetching the signer from accountKeys.
            const nodePubkey = accountKeys[2] || 'Unknown'; 

            return {
                merkleRoot: merkleRootHex,
                shardCount,
                nodePubkey
            };
        } catch (err) {
            console.warn('[ShardParser] Parse failed:', err);
            return null;
        }
    }

    private static HELIUS_DISCRIMINATOR_MATCH(d: Buffer): Buffer {
        return this.HELIUS_DISCRIMINATOR_MATCH_INLINE();
    }

    private static HELIUS_DISCRIMINATOR_MATCH_INLINE(): Buffer {
        return Buffer.from([156, 17, 23, 219, 237, 102, 17, 27]);
    }
}
