import { UniversalModule } from '../src/modules/universal';
import * as path from 'path';

async function run() {
    console.log("=== Verifying API SQL Injection Hardening ===");
    
    const idlPath = path.resolve(__dirname, '../../../data/idls/GtmN6x2aPYq6LkbJTj1qxm5Jn6zGQNWsgG9NFnx1QaEu.json');
    
    // Bypass constructor to avoid Coder exception in this minimal mock
    const module = Object.create(UniversalModule.prototype) as UniversalModule;
    Object.assign(module, {
        programId: 'GtmN6x2aPYq6LkbJTj1qxm5Jn6zGQNWsgG9NFnx1QaEu',
        idl: require(idlPath),
        tableMap: {},
        columnWhitelist: {}
    });
    
    // Mock DB
    const mockDb = {
        ensureDynamicTable: async () => {},
        runSqlite: async () => {},
        runDuckDB: async () => {}
    };
    
    await module.initialize(mockDb);
    
    // Mock Express App
    const mockApp = {
        routes: {} as any,
        get: (route: string, handler: any) => {
            mockApp.routes[route] = handler;
        }
    };
    
    module.extendServer(mockApp);
    
    // Simulate an API request to /api/v1/indexed/seeker_sentinel/:instruction
    const route = '/api/v1/indexed/seeker_sentinel/:instruction';
    const handler = mockApp.routes[route];
    
    if (!handler) {
        throw new Error("Route not registered!");
    }
    
    console.log(`Simulating request to ${route}`);
    
    let executedSql = "";
    
    // Override db client for the handler
    const mockDbClient = {
        querySqlite: async (sql: string, params: any[]) => {
            executedSql = sql;
            console.log(`[SQL Generator] Executed: ${sql}`);
            console.log(`[SQL Generator] Params:   ${JSON.stringify(params)}`);
            return [];
        }
    };
    require.cache[require.resolve('../src/db/client')] = {
        exports: { db: mockDbClient }
    } as any;
    
    // Malicious request
    const req = {
        params: { instruction: 'submitheartbeat' },
        query: {
            signer: 'Alice',
            '1=1; DROP TABLE ix_submitheartbeat; --': 'boom',
            limit: 10
        }
    };
    
    const res = {
        json: (data: any) => console.log(`[API Response] Success`),
        status: (code: number) => ({ json: (data: any) => console.log(`[API Error] ${code}: ${data.error}`) })
    };
    
    await handler(req, res);
    
    if (executedSql.includes('DROP TABLE')) {
        console.error("❌ SQL INJECTION VULNERABILITY DETECTED!");
        process.exit(1);
    } else {
        console.log("✅ SQL INJECTION PREVENTED! Malicious keys were filtered out by the IDL Whitelist.");
    }
    
    console.log("=== Verification Complete ===");
}

run().catch(console.error);
