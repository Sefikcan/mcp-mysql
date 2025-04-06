import { z } from 'zod';
export const ConnectDbSchema = z.object({
    host: z.string().min(1, 'Host is required'),
    user: z.string().min(1, 'User is required'),
    password: z.string().min(1, 'Password is required'),
    database: z.string().min(1, 'Database name is required'),
    port: z.number().optional().default(3306),
});
export const QueryParamsSchema = z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();
export const QuerySchema = z.object({
    sql: z.string().min(1, 'SQL query is required'),
    params: QueryParamsSchema,
});
export const ExecuteSchema = QuerySchema;
export const DescribeTableSchema = z.object({
    table: z.string().min(1, 'Table name is required'),
});
// Tool schemas for MCP
export const toolSchemas = {
    connect_db: {
        type: "object",
        properties: {
            host: { type: 'string', description: 'Database host' },
            user: { type: 'string', description: 'Database user' },
            password: { type: 'string', description: 'Database password' },
            database: { type: 'string', description: 'Database name' },
            port: { type: 'number', description: 'Database port (optional)' },
        },
        required: ["host", "user", "password", "database"]
    },
    query: {
        type: "object",
        properties: {
            sql: { type: "string", description: 'SQL SELECT query' },
            params: {
                type: "array",
                items: { type: ["string", "number", "boolean", "null"] },
                description: "Query parameters (optional)"
            },
        },
        required: ["sql"]
    },
    execute: {
        type: "object",
        properties: {
            sql: { type: 'string', description: 'SQL query (INSERT, UPDATE, DELETE)' },
            params: {
                type: "array",
                items: { type: ["string", "number", "boolean", "null"] },
                description: "Query parameters (optional)"
            },
        },
        required: ['sql']
    },
    list_tables: {
        type: 'object',
        properties: {},
        required: []
    },
    describe_table: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' }
        },
        required: ['table']
    }
};
