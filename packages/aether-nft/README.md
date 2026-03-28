# Aether-NFT: Metaplex Core Rarity Engine

The `aether-nft` module indexes Metaplex Core assets and calculates real-time statistical rarity scores.

## 1. Overview
- **ID**: `aether-nft`
- **Focus**: Metaplex Core (single-account standard).
- **Features**: Attribute indexing, rarity score calculation, collection grouping.

## 2. Verification Status
- [x] **Core Protocol Filter**: Validated ID `CoREEN...`.
- [x] **Asset Identification**: Mock logic verified for identifying 2026 Core mints.

### Automated Test Result
```bash
> ts-node tests/verify.ts
--- [Verify] Aether-NFT ---
[Mock DB] Exec: CREATE TABLE IF NOT EXISTS nft_assets (...
[Test] Processing Mock NFT Transaction...
[NFT] Metaplex Core Operation: TEST_SIG_NFT_001
--- [Verify] NFT Complete ---
```
