import fs from 'fs';
import path from 'path';

// ══════════════════════════════════════════════════
//  Aether Indexer — IDL Integrity Auditor (v2)
//  Purpose: Identifying missing or bit-mismatched types
// ══════════════════════════════════════════════════

const idlPath = path.resolve(__dirname, '../../data/idls/dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH.json');

async function audit() {
    console.log(`⚡ Auditing Drift IDL Integrity: ${idlPath}...`);
    
    if (!fs.existsSync(idlPath)) {
        console.error('❌ IDL not found.');
        process.exit(1);
    }

    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    const definedTypes = new Set(idl.types?.map((t: any) => t.name) || []);
    
    console.log(`📡 Registered Types: ${definedTypes.size}`);

    function checkType(type: any, context: string) {
        if (!type) return;
        
        // Normalize object-based defined types (e.g., { defined: { name: "..." } })
        let typeName = type;
        if (typeof type === 'object') {
            if (type.defined) {
                typeName = typeof type.defined === 'object' ? type.defined.name : type.defined;
            } else if (type.option) {
                return checkType(type.option, context);
            } else if (type.vec) {
                return checkType(type.vec, context);
            } else if (type.array) {
                return checkType(type.array[0], context);
            }
        }

        if (typeof typeName === 'string') {
            const primitives = ['u8', 'u16', 'u32', 'u64', 'u128', 'u256', 'i8', 'i16', 'i32', 'i64', 'i128', 'i256', 'f32', 'f64', 'bool', 'string', 'pubkey', 'publicKey', 'bytes'];
            if (!primitives.includes(typeName) && !definedTypes.has(typeName)) {
                console.error(`❌ [${context}] Type not found: ${typeName}`);
            }
        } else {
            console.error(`❌ [${context}] Ambiguous Type Structure: ${JSON.stringify(type)}`);
        }
    }

    // Audit Instructions
    idl.instructions?.forEach((ix: any) => {
        ix.args?.forEach((arg: any) => {
            checkType(arg.type, `Instruction:${ix.name}:Arg:${arg.name}`);
        });
    });

    // Audit Types (Nested)
    idl.types?.forEach((t: any) => {
        t.type?.fields?.forEach((f: any) => {
            checkType(f.type, `Type:${t.name}:Field:${f.name}`);
        });
        t.type?.variants?.forEach((v: any) => {
            v.fields?.forEach((f: any) => {
                if (typeof f === 'object') {
                    checkType(f.type || f, `Type:${t.name}:Variant:${v.name}`);
                }
            });
        });
    });

    // Audit Events
    idl.events?.forEach((ev: any) => {
        ev.fields?.forEach((f: any) => {
            checkType(f.type, `Event:${ev.name}:Field:${f.name}`);
        });
    });

    console.log('✅ Integrity Audit Complete.');
}

audit();
