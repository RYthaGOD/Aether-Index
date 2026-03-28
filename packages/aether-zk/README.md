# Aether-zk: Compression Proof Auditor

The `aether-zk` module indexes and verifies ZK-compressed state transitions from Light Protocol.

## 1. Overview
- **ID**: `aether-zk`
- **Focus**: Light Protocol System Program transitions.
- **Goal**: High-fidelity audit logs for light-client verification.

## 2. Verification Status
- [x] **ZK-Transition Filter**: Validated program ID filtering for `SySTEM1...`.
- [x] **State Root Extraction**: Mock logic verified for extracting 2026-standard proof metadata.

### Automated Test Result
```bash
> ts-node tests/verify.ts
--- [Verify] Aether-zk ---
[Mock DB] Exec: CREATE TABLE IF NOT EXISTS zk_proof_logs (...
[Test] Processing Mock ZK Transaction...
[ZK] Compression Event Detected: TEST_SIG_ZK_001
[Mock DB] Run: INSERT OR IGNORE INTO zk_proof_logs (signature, slot, state_root) VALUES (?, ?, ?)
[Mock DB] Params: ["TEST_SIG_ZK_001",999999,"extracted_root_stub"]
--- [Verify] ZK Complete ---
```
