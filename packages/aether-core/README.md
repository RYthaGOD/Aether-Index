# Aether Index: High-Performance Modular Engine

Aether Index is a professional-grade, plug-and-play indexing engine for the Solana ecosystem. It is designed to transform raw on-chain events into structured, multi-database (SQLite + DuckDB) state with sub-second latency.

## 1. Monorepo Structure
This project uses NPM Workspaces to maintain strict module isolation:
- **`@aether/core`**: The central ingestion engine (Helius Webhooks) and dynamic module dispatcher.
- **`aether-agentic`**: Semantic narrative engine for AI agents (MCP).
- **`aether-zk`**: ZK-compression state auditor for Light Protocol.
- **`aether-lending`**: Risk & liquidation monitor (Kamino/Save).
- **`aether-nft`**: Metaplex Core rarity & metadata indexer.
- **`aether-shared`**: Shared TypeScript interfaces for module developers.

## 2. Developer Quickstart
### Adding a New Module
1. Create a new package in `packages/`.
2. Implement the `AetherModule` interface from `aether-shared`.
3. Register your module in `packages/aether-core/src/api/index.ts`.

```typescript
import { YourNewModule } from '../../your-module/src';
WebhookReceiver.registerModule(new YourNewModule());
```

## 3. Verification & CI
Every module in this repository includes a standalone `tests/verify.ts` script that simulates production Helius payloads. To verify the entire stack:
1. Navigate to the module directory.
2. Run `ts-node tests/verify.ts`.
3. Check simulation logs for correctly parsed and persisted data.
