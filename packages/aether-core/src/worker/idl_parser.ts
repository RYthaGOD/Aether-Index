import { Idl } from '@coral-xyz/anchor';

/**
 * IdlParser: The Architect of Dynamic Schemas
 * 
 * Responsible for translating Anchor IDLs into optimized SQLite and DuckDB schemas.
 * This is the core "Universal" engine component.
 */
export class IdlParser {
    /**
     * Translates an Anchor IDL into a set of SQL column definitions.
     */
    static generateSchema(idl: Idl): { [tableName: string]: string[] } {
        const schemas: { [tableName: string]: string[] } = {};

        // 1. Process Instructions (for indexing events/calls)
        if (idl.instructions) {
            for (const ix of idl.instructions) {
                const tableName = `ix_${ix.name.toLowerCase()}`;
                const columns = [
                    'signature TEXT PRIMARY KEY',
                    'slot INTEGER',
                    'timestamp DATETIME DEFAULT CURRENT_TIMESTAMP',
                    'signer TEXT'
                ];

                for (const arg of ix.args) {
                    const sqlType = this.mapAnchorTypeToSql(arg.type);
                    columns.push(`${arg.name} ${sqlType}`);
                }
                schemas[tableName] = columns;
            }
        }

        // 2. Process Accounts (for state indexing)
        if (idl.accounts) {
            for (const acc of idl.accounts) {
                const tableName = `acc_${acc.name.toLowerCase()}`;
                const columns = [
                    'pubkey TEXT PRIMARY KEY',
                    'slot INTEGER',
                    'last_updated DATETIME DEFAULT CURRENT_TIMESTAMP'
                ];

                // If it's a legacy IDL, fields might be in 'type.fields'
                const fields = (acc as any).type?.fields || [];
                for (const field of fields) {
                    const sqlType = this.mapAnchorTypeToSql(field.type);
                    columns.push(`${field.name} ${sqlType}`);
                }
                schemas[tableName] = columns;
            }
        }

        return schemas;
    }

    /**
     * Maps Anchor/Borsh types to SQL primitives.
     */
    private static mapAnchorTypeToSql(type: any): string {
        // Handle simple string types
        if (typeof type === 'string') {
            switch (type) {
                case 'u64':
                case 'i64':
                case 'f64':
                    return 'REAL'; // SQLite/DuckDB handle big ints as REAL or double better in generic queries
                case 'u32':
                case 'i32':
                case 'u16':
                case 'i16':
                case 'u8':
                case 'i8':
                    return 'INTEGER';
                case 'publicKey':
                case 'string':
                    return 'TEXT';
                case 'bool':
                    return 'INTEGER'; // 0 or 1
                default:
                    return 'TEXT'; // Fallback for complex types (serialized as string/JSON)
            }
        }

        // Handle nested/defined types (simplified for now)
        if (type.defined) return 'TEXT';
        if (type.vec || type.option || type.array) return 'TEXT'; // Serialized complex types

        return 'TEXT';
    }
}
