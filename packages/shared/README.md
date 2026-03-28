# Aether-Shared: Core Interfaces & Types

The `aether-shared` package contains the fundamental interfaces and type definitions that bind the Aether Index ecosystem together.

## 1. The AetherModule Interface
Every module in the Aether Index must implement this interface to be registered with the core engine.

```typescript
export interface AetherModule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  initialize(db: any): Promise<void>;
  processTransaction(tx: any, db: any): Promise<void>;
  shutdown?(): Promise<void>;
}
```

## 2. Usage
Modules should include this package as a dependency to ensure API compatibility.
```json
"dependencies": {
  "aether-shared": "*"
}
```

## 3. Verification
- [x] **Contract Consistency**: Quadruple-checked across all 5 production modules.
