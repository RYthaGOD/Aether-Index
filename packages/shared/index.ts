// Aether Shared Types

/**
 * AetherModule Interface
 * 
 * Every plug-and-play module for the Aether Index must implement this interface.
 * This ensures the core engine can dynamically register, initialize, and 
 * dispatch transactions to modules without hardcoded logic.
 */
export interface AetherModule {
  /**
   * Unique identifier for the module (e.g., 'aether-agentic')
   */
  readonly id: string;

  /**
   * Human-readable name for the module
   */
  readonly name: string;

  /**
   * Brief description of what the module indexes
   */
  readonly description: string;

  /**
   * Initialize module-specific state, register database tables, and verify configurations.
   * @param db The shared Aether Database Client
   */
  initialize(db: any): Promise<void>;

  /**
   * Process a transaction broadcasted by the Aether Core.
   * @param tx The Helius Enhanced Transaction object (EnrichedTransaction)
   * @param db The shared Aether Database Client for persistence
   */
  processTransaction(tx: any, db: any): Promise<void>;

  /**
   * Optional cleanup logic performed when the engine shuts down.
   */
  shutdown?(): Promise<void>;

  /**
   * Universal Integration: Allows modules to dynamically register their 
   * own API routes/endpoints (REST, GraphQL, etc.) to the core server.
   * @param app The Express application instance from the core engine.
   */
  extendServer?(app: any): void;
}
