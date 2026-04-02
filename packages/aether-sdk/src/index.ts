import axios, { AxiosInstance } from 'axios';

export interface AetherConfig {
  url: string;
  apiKey?: string;
}

export class AetherError extends Error {
  constructor(public message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'AetherError';
  }
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
      timeout: 10000, 
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
    });

    // Resilience interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        const message = error.response?.data?.error || error.message;
        const status = error.response?.status;
        throw new AetherError(message, status);
      }
    );
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

  /**
   * Universal Indexing API: Access any dynamically indexed Anchor program
   */
  public indexed = {
    /**
     * Fetch instruction logs for a specific program
     * @param program Program name (as per IDL filename)
     * @param instruction Instruction name
     * @param filters Query filters (e.g. { signer: '...' })
     */
    getData: async (program: string, instruction: string, filters: any = {}) => {
      return (await this.api.get(`/api/v1/indexed/${program}/${instruction}`, { params: filters })).data;
    },

    /**
     * Fetch usage statistics for a program
     */
    getStats: async (program: string, since?: string) => {
      return (await this.api.get(`/api/v1/stats/${program}/summary`, { params: { since } })).data;
    },

    /**
     * Discover indexed instructions and tables for a program
     */
    getProgram: async (program: string) => {
      return (await this.api.get(`/api/v1/programs/${program}`)).data;
    }
  };
}
