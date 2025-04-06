import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager } from './config.js';
import { DatabaseManager } from './database.js';
import { validateSelectQuery, validateNonSelectQuery } from './utils.js';
import type { ConnectDbArgs, QueryArgs, DescribeTableArgs, ToolResponse } from './types.js';

class MySQLServer {
    private server: Server;
    private dbManager: DatabaseManager;
    private configManager: ConfigManager;

    constructor() {
        this.server = new Server(
            {
                name: "mysql-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        );

        this.dbManager = DatabaseManager.getInstance();
        this.configManager = ConfigManager.getInstance();

        this.setupToolHandlers();
        this.setupErrorHandling();
    }

    private setupErrorHandling() {
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.cleanup();
            process.exit(0);
        });
    }

    private setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "connect_db",
                    description: "Connect to MySQL database",
                    inputSchema: {
                        type: "object",
                        properties: {
                            host: { type: 'string', description: 'Database host' },
                            user: { type: 'string', description: 'Database user' },
                            password: { type: 'string', description: 'Database password' },
                            database: { type: 'string', description: 'Database name' },
                            port: { type: 'number', description: 'Database port (optional)' },
                        },
                        required: ["host", "user", "password", "database"],
                    }
                },
                {
                    name: "query",
                    description: "Execute a SELECT query",
                    inputSchema: {
                        type: "object",
                        properties: {
                            sql: { type: "string", description: 'SQL SELECT query' },
                            params: {
                                type: "array",
                                items: { type: ["string", "number", "boolean", "null"] },
                                description: "Query parameters (optional)",
                            },
                        },
                        required: ["sql"],
                    }
                },
                {
                    name: 'execute',
                    description: 'Execute an INSERT, UPDATE, or DELETE query',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sql: { type: 'string', description: 'SQL query (INSERT, UPDATE, DELETE)' },
                            params: {
                                type: 'array',
                                items: { type: ['string', 'number', 'boolean', 'null'] },
                                description: 'Query parameters (optional)',
                            },
                        },
                        required: ['sql'],
                    },
                },
                {
                    name: 'list_tables',
                    description: 'List all tables in the database',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                },
                {
                    name: 'describe_table',
                    description: 'Get table structure',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            table: { type: 'string', description: 'Table name' },
                        },
                        required: ['table'],
                    },
                },
            ]
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const args = request.params.arguments || {};
            
            switch (request.params.name) {
                case 'connect_db': {
                    const { host, user, password, database, port } = args as Record<string, unknown>;
                    if (!host || !user || !password || !database) {
                        throw new McpError(
                            ErrorCode.InvalidParams,
                            'Missing required database configuration parameters'
                        );
                    }
                    return await this.handleConnectDb({
                        host: String(host),
                        user: String(user),
                        password: String(password),
                        database: String(database),
                        port: typeof port === 'number' ? port : undefined
                    });
                }
                case 'query': {
                    const { sql, params } = args as Record<string, unknown>;
                    if (!sql || typeof sql !== 'string') {
                        throw new McpError(
                            ErrorCode.InvalidParams,
                            'SQL query is required and must be a string'
                        );
                    }
                    return await this.handleQuery({
                        sql,
                        params: Array.isArray(params) ? params : undefined
                    });
                }
                case 'execute': {
                    const { sql, params } = args as Record<string, unknown>;
                    if (!sql || typeof sql !== 'string') {
                        throw new McpError(
                            ErrorCode.InvalidParams,
                            'SQL query is required and must be a string'
                        );
                    }
                    return await this.handleExecute({
                        sql,
                        params: Array.isArray(params) ? params : undefined
                    });
                }
                case 'list_tables':
                    return await this.handleListTables();
                case 'describe_table': {
                    const { table } = args as Record<string, unknown>;
                    if (!table || typeof table !== 'string') {
                        throw new McpError(
                            ErrorCode.InvalidParams,
                            'Table name is required and must be a string'
                        );
                    }
                    return await this.handleDescribeTable({ table });
                }
                default:
                    throw new McpError(
                        ErrorCode.MethodNotFound,
                        `Unknown tool: ${request.params.name}`
                    );
            }
        });
    }

    private async handleConnectDb(args: ConnectDbArgs): Promise<ToolResponse> {
        this.configManager.setDbConfig(args);
        await this.dbManager.connect(args);
        
        return {
            content: [{
                type: "text",
                text: "Successfully connected to database",
            }]
        };
    }

    private async handleQuery(args: QueryArgs): Promise<ToolResponse> {
        if (!validateSelectQuery(args.sql)) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Only SELECT queries are allowed with query tool'
            );
        }

        const [rows] = await this.dbManager.query(args.sql, args.params || []);
        return {
            content: [{
                type: "text",
                text: JSON.stringify(rows, null, 2),
            }]
        };
    }

    private async handleExecute(args: QueryArgs): Promise<ToolResponse> {
        if (!validateNonSelectQuery(args.sql)) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Use query tool for SELECT statements'
            );
        }

        const [result] = await this.dbManager.query(args.sql, args.params || []);
        return {
            content: [{
                type: "text",
                text: JSON.stringify(result, null, 2),
            }]
        };
    }

    private async handleListTables(): Promise<ToolResponse> {
        const [rows] = await this.dbManager.query("SHOW TABLES");
        return {
            content: [{
                type: "text",
                text: JSON.stringify(rows, null, 2),
            }]
        };
    }

    private async handleDescribeTable(args: DescribeTableArgs): Promise<ToolResponse> {
        const [rows] = await this.dbManager.query("DESCRIBE ??", [args.table]);
        return {
            content: [{
                type: "text",
                text: JSON.stringify(rows, null, 2),
            }]
        };
    }

    private async cleanup(): Promise<void> {
        await this.dbManager.cleanup();
        await this.server.close();
    }

    async run(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("MySQL MCP server running on stdio");
    }
}

const server = new MySQLServer();
server.run().catch(console.error);