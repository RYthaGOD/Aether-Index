import { IdlParser } from '../src/worker/idl_parser';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    console.log("=== Verifying Dynamic IDL Parsing ===");
    const idlPath = path.resolve(__dirname, '../../../data/idls/GtmN6x2aPYq6LkbJTj1qxm5Jn6zGQNWsgG9NFnx1QaEu.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    
    console.log(`Loaded IDL: ${idl.name}`);
    const schema = IdlParser.generateSchema(idl);
    
    for (const [tableName, columns] of Object.entries(schema)) {
        console.log(`\nTable: ${tableName}`);
        columns.forEach(col => console.log(`  - ${col}`));
    }
    console.log("\n=== IDL Parsing Verification Complete ===");
}

run().catch(console.error);
