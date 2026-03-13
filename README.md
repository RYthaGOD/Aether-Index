![AetherIndex Teaser](assets/teaser.png)

# 🌌 AetherIndex: The Universal Solana Data Engine

> **Every Swap. Every Token. Every Price. All Sovereign.**

AetherIndex is a high-performance, developer-first indexing engine for the entire Solana ecosystem. It transforms raw gRPC streams into a structured, analytical-grade data lake (DuckDB & Parquet) on your local disk, enabling sub-second OHLCV query performance without the cloud tax.

---

## ⚡ Why AetherIndex?

Traditional Solana indexers are often limited to specific pools or require massive centralized database clusters. **AetherIndex is different.**

- **Global Coverage**: Subscribes to and parses activity across all major DEXs (Raydium, Jupiter, Orca, Phoenix).
- **Dynamic Price Oracle**: Trustless, on-chain price triangulation. Resolves USD value for *any* token by automatically discovering SOL and USDC base rates.
- **Sovereign Analytics**: Powered by **DuckDB** (analytical engine) and **SQLite** (registry). Query millions of rows with vectorized SQL in under 100ms.
- **Token Discovery**: Automatically discovers new token launches and queues them for metadata enrichment.
- **Zero-Trust Durability**: Implements Write-Ahead Logging (WAL) and memory-buffered batching for data integrity under extreme chain volume.

---

## 🏗️ The "Sovereign" Architecture

AetherIndex leverages an elite local-first strategy:

1.  **Yellowstone gRPC (The Ingestion)**: High-speed, low-latency transaction ingestion directly from Geyser nodes.
2.  **DuckDB (The Analytical Engine)**: An embedded vectorized SQL database that acts as your local "ClickHouse." It converts trillions of raw ticks into efficient Parquet-backed OHLCV candles.
3.  **SQLite (The Registry & Meta-Layer)**: A robust, ACID-compliant layer for the Global Token Registry and system sync state.

---

## 🚀 Quick Start

### 1. Requirements
- Docker & Docker Compose
- Helius API Key (Yellowstone gRPC enabled)

### 2. Launch
```bash
# Clone and enter
git clone https://github.com/RYthaGOD/Aether-Index.git
cd Aether-Index

# Configure environment
cp .env.example .env
# Edit .env with your Helius Key and RPC URLs

# Fire it up
docker-compose up -d
```

### 3. Query the Universe
Your GraphQL Gateway is live at `http://localhost:4000/graphql`.

```graphql
query {
  # Search for any token discovered by the indexer
  searchTokens(query: "SOL") {
    mint
    symbol
    name
  }

  # Fetch high-fidelity OHLCV candles
  getHistory(tokenAddress: "...", interval: "1m") {
    window_start
    open
    high
    low
    close
    volume
  }
}
```

---

## 🗺️ Suggested Next Steps (Roadmap)

To take AetherIndex to Mainnet dominance, consider these architectural expansions:

1.  **Metaplex Metadata Integration**: Fully implement the `fetchMetaplexMetadata` worker to resolve symbols, names, and images for new launches automatically.
2.  **CLMM & DLMM Support**: Extend the `SwapParser` to handle concentrated liquidity pools (Raydium CLMM, Orca Whirlpools, Meteora) for 100% liquidity coverage.
3.  **Advanced Analytical Views**: Add DuckDB views for "Top Movers," "Volume Clusters," and "Smart Money Tracking" using the indexed `maker` data.
4.  **Websocket Price Feeds**: Implement a real-time Sub/Pub layer in the API to push live candle updates to frontends as they close.

---

## 🛠️ Tech Stack
- **Languages**: TypeScript, SQL (Vectorized)
- **Data Ingestion**: Yellowstone gRPC (@triton-one)
- **Analytical Storage**: DuckDB
- **Metadata Storage**: SQLite3
- **API Connectivity**: GraphQL (Apollo Server)

---

## 🤝 Contributing
Join the elite. Help us refine the 1s reconciliation engine or add new DEX parsers.

**Rykiri**: "The net is cast. AetherIndex now sees everything on the chain. Let's stack that data. ⚡🌩️🚀"
