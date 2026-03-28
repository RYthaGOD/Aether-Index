# @aether/sdk: Universal Index Consumer (2026)

A lightweight, zero-dependency (almost) TypeScript client for the Aether Index modular engine.

## 🚀 Quick Start

```bash
npm install @aether/sdk
```

```typescript
import { AetherSDK } from '@aether/sdk';

// Initialize with your local or production Aether Index endpoint
const aether = new AetherSDK({ 
    url: 'http://localhost:4000',
    apiKey: process.env.AETHER_API_KEY 
});

async function main() {
    // 1. Get real-time Agentic narratives
    const stories = await aether.agentic.getNarratives();
    console.log(stories[0].narrative);

    // 2. Monitor Kamino/Save Liquidations
    const liquidations = await aether.lending.getLiquidations();
    
    // 3. Audit ZK-compressed state root
    const proofs = await aether.zk.getProofs();
}
```

## 🛠️ API Coverage
- **`lending`**: `getLiquidations()`, `getProtocolData(id)`
- **`agentic`**: `getNarratives()`
- **`zk`**: `getProofs()`
- **`nft`**: `getRarity(mint)`
- **`shardLock`**: `getLocations(merkleRoot)`

---

## 🏗️ Technical Specification
The SDK consumes standardized REST endpoints dynamically registered by Aether Index modules via the `extendServer` lifecycle method. This ensures that any new module created with `npm run create-module` can be instantly added to the SDK definition.
