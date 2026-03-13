![AetherIndex Teaser](assets/teaser.png)

# 🌌 AetherIndex: The Sovereign Solana Indexer

> **Sub-second precision. Zero cloud tax. Total data sovereignty.**

AetherIndex is a high-performance, developer-first charting backend for Solana. It allows you to run a professional-grade OHLCV indexing service for **$0/month** by leveraging a specialized "Sovereign" architecture.

---

## ⚡ Why AetherIndex?

Modern Solana indexers often require expensive managed database clusters (ClickHouse/PostgreSQL) and premium RPC tiers. **AetherIndex breaks this mold.**

- **$0 Infrastructure Cost**: Uses **DuckDB** and **SQLite** for analytical-grade performance on local disk. No managed DB required.
- **Sub-Second Precision**: Ingests trades directly via **Helius LaserStream gRPC** (Devnet) or Webhooks (Mainnet).
- **Absolute Truth**: Cross-references DEX log events against on-chain token balance changes for 100% pricing accuracy.
- **One-Command Setup**: Dockerized and ready to deploy in seconds.

---

## 🏗️ The "Sovereign" Architecture

AetherIndex uses a dual-layered local storage strategy:

1.  **DuckDB (The Speed)**: An embedded analytical engine (vectorized SQL) that processes millions of trades into 1s, 1m, and 1h OHLCV candles with sub-100ms query times.
2.  **SQLite (The Truth)**: A local, ACID-compliant ledger that tracks every swap and handles chain re-orgs (reconciliation) automatically.

---

## 🚀 Quick Start

### 1. Requirements
- Docker & Docker Compose
- Helius API Key (Free Tier)

### 2. Launch
```bash
# Clone and enter
git clone https://github.com/your-repo/aether-index.git
cd aether-index

# Set your keys
echo "HELIUS_API_KEY=your_key_here" > .env

# Fire it up
docker-compose up -d
```

### 3. Query
Your GraphQL Gateway is live at `http://localhost:4000/graphql`.

```graphql
query {
  getHistory(tokenAddress: "...", interval: "1m") {
    open
    high
    low
    close
    volume
  }
}
```

---

## 💰 Monetization Use Cases

AetherIndex isn't just a tool; it's a business-in-a-box:
- **Whitelabel Charting**: Sell embeddable charts to new Solana projects.
- **Alpha Feeds**: Provide sub-second "Hot Swap" alerts to trading groups.
- **Data-as-a-Service**: Export compressed Parquet files for backtesting labs.

---

## 🛠️ Built With 2026 Tech
- **Core**: TypeScript, Node.js
- **Ingestion**: Yellowstone gRPC, Helius LaserStream
- **Storage**: DuckDB (Parquet), SQLite3
- **API**: GraphQL (Apollo Server)

---

## 🤝 Contributing
Join the elite. Help us refine the 1s reconciliation engine or add new DEX parsers (Raydium CLMM, Phoenix).

**LFG.** 🚀
