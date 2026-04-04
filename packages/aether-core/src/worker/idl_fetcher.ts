import { PublicKey, Connection } from "@solana/web3.js";
import { decodeIdlAccount } from "@coral-xyz/anchor/dist/cjs/idl";
import { utf8 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { inflate } from "pako";
import fs from "fs";
import path from "path";

/**
 * IdlFetcher: The Seeker of Truth
 * 
 * Responsible for retrieving Anchor IDLs from the blockchain or external registries.
 * Enables the "Discovery" feature of the Aether Index.
 */
export class IdlFetcher {
    private connection: Connection;
    private idlCacheDir: string;

    constructor(rpcUrl: string, cacheDir: string) {
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.idlCacheDir = cacheDir;
        
        if (!fs.existsSync(this.idlCacheDir)) {
            fs.mkdirSync(this.idlCacheDir, { recursive: true });
        }
    }

    /**
     * Resolves a Program ID to an Anchor IDL.
     * Priority: 
     * 1. Local Cache
     * 2. On-Chain PDA (Standard Anchor)
     * 3. External Registry (Future Expansion)
     */
    async fetchIdl(programIdString: string): Promise<any | null> {
        const cachePath = path.join(this.idlCacheDir, `${programIdString}.json`);
        
        // 1. Check Local Cache
        if (fs.existsSync(cachePath)) {
            return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        }

        console.log(`[IdlFetcher] 🔍 Searching on-chain for IDL: ${programIdString}`);

        try {
            const programId = new PublicKey(programIdString);
            
            // 2. Derive the standard Anchor IDL account address
            const [base] = await PublicKey.findProgramAddress([], programId);
            const idlAddress = await PublicKey.createWithSeed(base, "anchor:idl", programId);
            
            const idlAccountInfo = await this.connection.getAccountInfo(idlAddress);
            if (!idlAccountInfo) {
                console.warn(`[IdlFetcher] ⚠️ No on-chain IDL found for ${programIdString}`);
                return null;
            }

            // Standard Anchor IDL accounts have an 8-byte discriminator
            const idlAccount = decodeIdlAccount(idlAccountInfo.data.slice(8));
            const inflatedIdl = inflate(idlAccount.data);
            const idlJson = JSON.parse(utf8.decode(inflatedIdl));

            // Cache the discovery
            fs.writeFileSync(cachePath, JSON.stringify(idlJson, null, 2));
            console.log(`[IdlFetcher] ✅ IDL Captured and Cached for ${programIdString}`);

            return idlJson;
        } catch (err: any) {
            console.error(`[IdlFetcher] 💀 Failed to fetch IDL for ${programIdString}: ${err.message}`);
            return null;
        }
    }
}
