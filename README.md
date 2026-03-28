# Aether Index: High-Performance Modular Engine

Aether Index is a professional-grade, plug-and-play indexing engine for the Solana ecosystem. It is designed to transform raw on-chain events into structured, multi-database (SQLite + DuckDB) state with sub-second latency.

---

## 🏛️ Modular Architecture (NPM Workspaces)

The project is structured as a monorepo to ensure strict protocol isolation and developer ease-of-use:

- **`@aether/core`**: The central ingestion engine (Helius Webhooks) and dynamic module dispatcher.
- **`aether-agentic`**: Semantic narrative engine for AI agents (MCP).
- **`aether-zk`**: ZK-compression state auditor for Light Protocol.
- **`aether-lending`**: Risk & liquidation monitor (Kamino/Save).
- **`aether-nft`**: Metaplex Core rarity & metadata indexer.
- **`aether-shared`**: Common interfaces for plug-and-play development.

---

## 🚀 Core Capabilities

### 1. Dynamic Module Dispatcher
- **Parallel Processing**: Broadcasts transactions to all registered modules concurrently for near-zero latency.
- **Plug-and-Play**: Add new protocol support by simply implementing the `AetherModule` interface and registering it in the core.
- **HMAC Verification**: Ensures data authenticity for all incoming webhooks.

### 2. Analytical Engine
- **Hybrid Storage**: Uses **SQLite** for consistency and **DuckDB** for vectorized analytics.
- **Multi-DB Support**: Each module can manage its own schema sovereignly within the shared database clients.

### 3. Agentic Interoperability
- **MCP Native**: Implements the Model Context Protocol for seamless integration with AI agents like ElizaOS.
- **Semantic Narratives**: Transforms complex on-chain logs into machine-readable narratives.

---

## Quick Start

```bash
# 1. Setup dependencies
npm install && npm run build

# 2. Configure Environment
# Add your Helius/RPC/Redis credentials to .env
cp .env.example .env

# 3. Launch Services
npm start
```

---

## System Verification

Validate the security and performance of your instance:

```bash
# Verify webhook security, gap patching, and rate limiting
node dist/tests/verify_hardening.js

# Verify access tier gating and API rate limits
node dist/tests/verify_access_tiers.js
```

---

## Developer Resources

- 🌐 [Local Landing Page](http://localhost:4000/)
- 📡 [GraphQL Explorer](http://localhost:4000/graphql)
- 💎 [Live Data Dashboard](http://localhost:4000/dashboard)

> "The shadows have been cleared. AetherIndex is now hardened, optimized, and sovereign. Let's dominate the chain." — **Rykiri**
