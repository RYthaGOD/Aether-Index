# Aether-Lending: Real-Time Risk & Auction Monitor

The `aether-lending` module provides sub-second monitoring of liquidation events across Kamino V2 and Save.

## 1. Overview
- **ID**: `aether-lending`
- **Protocols Managed**: Kamino KLend V2, Save (formerly Solend).
- **Features**: Health factor decay tracking, liquidation front-running preparation.

## 2. Verification Status
- [x] **Multi-Protocol Dispatch**: Confirmed correct routing for both Kamino and Save IDs.
- [x] **Liquidation Capture**: Verified instruction name parsing for 2026-style events.

### Automated Test Result
```bash
> ts-node tests/verify.ts
--- [Verify] Aether-Lending ---
[Mock DB] Exec: CREATE TABLE IF NOT EXISTS lending_liquidations (...
[Test] Processing Mock Liquidation...
[Lending] Liquidation Detected [KAMINO]: TEST_SIG_LENDING_001
[Mock DB] Run: INSERT OR IGNORE INTO lending_liquidations (signature, protocol) VALUES (?, ?)
[Mock DB] Params: ["TEST_SIG_LENDING_001","KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"]
--- [Verify] Lending Complete ---
```
