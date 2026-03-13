![AetherIndex Teaser](assets/teaser.png)

# 🌌 AetherIndex: The Sovereign Solana Data Engine

> **Every Swap. Every Token. Every Price. 100% Sovereign.**

AetherIndex is a high-performance, developer-first indexing engine for the entire Solana ecosystem. This "Sovereign" edition has been hardened for production-grade discovery, featuring trustless pricing, hybrid ingestion, and advanced alpha tracking.

---

## ⚡ Why AetherIndex Sovereign?

Traditional indexers depend on expensive cloud APIs. AetherIndex puts the power back in your hands:

- **🛡️ Trustless Price Oracle**: No mocks. Prices are calculated on-chain by decoding Raydium V4, Orca Whirlpool, and Meteora DLMM pool reserves at the binary level.
- **🛡️ Socket Guardian (Synthetic gRPC)**: Parallelized WebSocket redundancy beating $1,000/mo enterprise streams. Detects slot gaps and auto-patches data via RPC fallbacks.
- **📡 Hybrid Ingestion**: Support for Parallel WebSockets, Yellowstone gRPC, and Helius Webhooks. 
- **🏷️ DAS Metadata Enrichment**: Automatically resolves token names, symbols, and icons using the Helius Digital Asset Standard (DAS) API.
- **🌩️ Advanced Alpha Discovery**: 
    - **Meteora DLMM Support**: Full parsing for the latest concentrated liquidity pools.
    - **Rug Detection**: Creator clustering traces funding sources and launch history to identify serial ruggers.
- **📊 Vectorized Analytics**: Powered by **DuckDB**. Query millions of rows (OHLCV, Top Movers, Volume Clusters) in under 50ms with vectorized SQL.
- **🔄 Sovereign Re-Sync**: Dedicated CLI to backfill missing data directly from historical blocks.

---

## 🏗️ Architecture

AetherIndex leans into a local-first, high-throughput strategy:

1.  **Ingestion (Hybrid)**: Helius Webhooks (Primary) + Yellowstone gRPC (Fallback).
2.  **Processor (The Heart)**: Centralized logic that unifies data flows, enriched via DAS, and broadcasts via GraphQL Subscriptions.
3.  **Analytical Layer (DuckDB)**: Vectorized SQL engine acting as a local "Clickhouse" for OHLCV and trend discovery.
4.  **Metadata Layer (SQLite)**: Durable registry for tokens, creators, and sync state.

---

## 🚀 Quick Start

### 1. Requirements
- Docker & Docker Compose
- Helius API Key (with DAS and Webhook access)

### 2. Launch
```bash
# Clone and enter
git clone https://github.com/RYthaGOD/Aether-Index.git
cd Aether-Index

# Configure environment
cp .env.example .env
### 3. Install Globally (Optional)
```bash
npm install -g .
# Or for development
npm link
```

### 4. Start the Engine
```bash
# Setup your sovereign environment
aetherindex init

# Ignition
aetherindex up
```

### 5. Backfill Historical Data
```bash
aetherindex backfill <start_slot> <end_slot>
```

---

## 📡 GraphQL Alpha Feed
Your Gateway is live at `http://localhost:4000/graphql`.

- **Subscriptions**: `newSwap`, `priceUpdated(mint)`
- **Analytics**: `getTopMovers`, `getVolumeClusters`, `searchTokens`

---

## 🛠️ Tech Stack
- **Languages**: TypeScript, SQL (Vectorized)
- **Ingestion**: Helius (DAS, Webhooks), Yellowstone gRPC
- **Storage**: DuckDB (Parquet), SQLite3
- **Gateway**: Apollo Server v3 (WebSockets)

---

## 🤝 Contributing
Join the elite. Help us refine the rug-detection heuristics or add new DEX parsers (Phoenix, Lifinity).

**Rykiri**: "The shadows have been cleared. AetherIndex is now as invincible as the Yellow Flash himself. Let's dominate the chain. ⚡🌩️🚀"
