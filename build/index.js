import * as mysql from 'mysql2/promise';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
dotenv.config();
function isErrorWithMessage(error) {
    return (typeof error === "object" && error !== null && "message" in error &&
        typeof error.message === "string");
}
function getErrorMessage(error) {
    if (isErrorWithMessage(error)) {
        return error.message;
    }
    return String(error);
}
class MySQLServer {
    server;
    connection = null;
    config = null;
    constructor() {
        this.server = new Server({
            name: "mysql-server",
            version: "1.0.0",
        }, {
            capabilities: {
                tools: {}
            }
        });
        if (!process.env.MYSQL_HOST
            && !process.env.MYSQL_USER
            && process.env.MYSQL_PASSWORD !== undefined
            && process.env.MYSQL_PASSWORD !== null
            && !process.env.MYSQL_DATABASE) {
            this.config = {
                host: process.env.MYSQL_HOST || 'localhost',
                user: process.env.MYSQL_USER || 'myuser',
                password: process.env.MYSQL_PASSWORD || 'mypass',
                database: process.env.MYSQL_DATABASE || 'mydb',
                port: Number(process.env.MYSQL_PORT ?? 3306),
            };
        }
        this.setupToolHandlers();
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.cleanup();
            process.exit(0);
        });
    }
    async cleanup() {
        if (this.connection) {
            await this.connection.end();
        }
        await this.server.close();
    }
    async ensureConnection() {
        if (!this.config) {
            throw new McpError(ErrorCode.InvalidRequest, "Database configuration not set. Use connect_db tool first");
        }
        if (!this.connection) {
            try {
                this.connection = await mysql.createConnection(this.config);
            }
            catch (error) {
                throw new McpError(ErrorCode.InternalError, `Failed to connect to database: ${getErrorMessage(error)}`);
            }
        }
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "connect_db",
                    description: "Connect to MySQL database",
                    inputSchema: {
                        type: "object",
                        properties: {
                            host: {
                                type: 'string',
                                description: 'Database host',
                            },
                            user: {
                                type: 'string',
                                description: 'Database user',
                            },
                            password: {
                                type: 'string',
                                description: 'Database password',
                            },
                            database: {
                                type: 'string',
                                description: 'Database name',
                            },
                            port: {
                                type: 'number',
                                description: 'Database port (optional)',
                            },
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
                            sql: {
                                type: "string",
                                description: 'SQL SELECT query',
                            },
                            params: {
                                type: "array",
                                items: {
                                    type: ["string", "number", "boolean", "null"]
                                },
                                description: "QUERY parameters (optional)",
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
                            sql: {
                                type: 'string',
                                description: 'SQL query (INSERT, UPDATE, DELETE)',
                            },
                            params: {
                                type: 'array',
                                items: {
                                    type: ['string', 'number', 'boolean', 'null'],
                                },
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
                            table: {
                                type: 'string',
                                description: 'Table name',
                            },
                        },
                        required: ['table'],
                    },
                },
            ]
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            switch (request.params.name) {
                case 'connect_db':
                    return await this.handleConnectDb(request.params.arguments);
                case 'query':
                    return await this.handleQuery(request.params.arguments);
                case 'execute':
                    return await this.handleExecute(request.params.arguments);
                case 'list_tables':
                    return await this.handleListTables();
                case 'describe_tables':
                    return await this.handleDescribeTable(request.params.arguments);
                default:
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
        });
    }
    async handleConnectDb(args) {
        if (this.config === null) {
            if (!args.host || !args.user || args.password === undefined || args.password === null || !args.database) {
                throw new McpError(ErrorCode.InvalidParams, 'Missing required database configuration parameters');
            }
        }
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
        this.config = {
            host: args.host,
            user: args.user,
            password: args.password,
            database: args.database,
            port: args.port,
        };
        try {
            await this.ensureConnection();
            return {
                content: [{
                        type: "text",
                        text: "Successfully connected to database",
                    }]
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to connect to database: ${getErrorMessage(error)}`);
        }
    }
    async handleQuery(args) {
        await this.ensureConnection();
        if (!args.sql) {
            throw new McpError(ErrorCode.InvalidParams, "SQL query is required");
        }
        if (!args.sql.trim().toUpperCase().startsWith('SELECT')) {
            throw new McpError(ErrorCode.InvalidParams, 'Only SELECT queries are allowed with query tool');
        }
        try {
            const [rows] = await this.connection.query(args.sql, args.params || []);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(rows, null, 2),
                    }
                ]
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Query execution failed: ${getErrorMessage(error)}`);
        }
    }
    async handleExecute(args) {
        await this.ensureConnection();
        if (!args.sql) {
            throw new McpError(ErrorCode.InvalidParams, "SQL query is required");
        }
        const sql = args.sql.trim().toUpperCase();
        if (sql.startsWith('SELECT')) {
            throw new McpError(ErrorCode.InvalidParams, 'Use query tool for SELECT statements');
        }
        try {
            const [result] = await this.connection.query(args.sql, args.params || []);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }
                ]
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Query execution failed: ${getErrorMessage(error)}`);
        }
    }
    async handleListTables() {
        await this.ensureConnection();
        try {
            const [rows] = await this.connection.query("SHOW TABLES");
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(rows, null, 2),
                    }
                ]
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to list tables: ${getErrorMessage(error)}`);
        }
    }
    async handleDescribeTable(args) {
        await this.ensureConnection();
        if (!args.table) {
            throw new McpError(ErrorCode.InvalidParams, "Table name is required");
        }
        try {
            const [rows] = await this.connection.query("DESCRIBE ??", [args.table]);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(rows, null, 2),
                    }
                ]
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to describe table: ${getErrorMessage(error)}`);
        }
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("MySQL MCP server running on stdio");
    }
}
const server = new MySQLServer();
server.run().catch(console.error);
