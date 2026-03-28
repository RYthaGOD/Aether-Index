import axios, { AxiosInstance } from 'axios';

export interface AetherConfig {
  url: string;
  apiKey?: string;
}

/**
 * Aether SDK: Unified Data Consumption Layer
 * 2026 Sovereign Edition
 */
export class AetherSDK {
  private api: AxiosInstance;

  constructor(config: AetherConfig) {
    this.api = axios.create({
      baseURL: config.url,
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
    });
  }

  /**
   * Lending Guard API: Real-time liquidations and health monitoring
   */
  public lending = {
    getLiquidations: async () => (await this.api.get('/api/lending/liquidations')).data,
    getProtocolData: async (id: string) => (await this.api.get(`/api/lending/protocol/${id}`)).data
  };

  /**
   * Agentic Memory API: Semantic narratives for AI agents
   */
  public agentic = {
    getNarratives: async () => (await this.api.get('/api/agentic/narratives')).data
  };

  /**
   * ZK Auditor API: Validated ZK state transitions
   */
  public zk = {
    getProofs: async () => (await this.api.get('/api/zk/proofs')).data
  };

  /**
   * NFT Rarity API: Metaplex Core metadata
   */
  public nft = {
    getRarity: async (mint: string) => (await this.api.get(`/api/nft/rarity/${mint}`)).data
  };

  /**
   * ShardLock API: Decentralized storage telemetry
   */
  public shardLock = {
    getLocations: async (merkleRoot: string) => (await this.api.get(`/api/shard-lock/locations/${merkleRoot}`)).data
  };
}
