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
        this.server = new Server({ name: "mysql-server", version: "1.0.0" }, { capabilities: { tools: {} } });
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
        this.server.setRequestHandler(ListToolsRequestSchema, () => ({
            tools: this.getTools()
        }));

        this.server.setRequestHandler(CallToolRequestSchema, this.handleToolRequest.bind(this));
    }

    private getTools() {
        return [
            this.createTool("connect_db", "Connect to MySQL database", this.getConnectDbSchema()),
            this.createTool("query", "Execute a SELECT query", this.getQuerySchema()),
            this.createTool("execute", "Execute an INSERT, UPDATE, or DELETE query", this.getExecuteSchema()),
            this.createTool("list_tables", "List all tables in the database", this.getListTablesSchema()),
            this.createTool("describe_table", "Get table structure", this.getDescribeTableSchema())
        ];
    }

    private createTool(name: string, description: string, schema: object) {
        return { name, description, inputSchema: schema };
    }

    private getConnectDbSchema() {
        return {
            type: "object",
            properties: {
                host: { type: 'string' },
                user: { type: 'string' },
                password: { type: 'string' },
                database: { type: 'string' },
                port: { type: 'number' },
            },
            required: ["host", "user", "password", "database"]
        };
    }

    private getQuerySchema() {
        return {
            type: "object",
            properties: {
                sql: { type: "string" },
                params: { type: "array", items: { type: ["string", "number", "boolean", "null"] } },
            },
            required: ["sql"]
        };
    }

    private getExecuteSchema() {
        return {
            type: "object",
            properties: {
                sql: { type: 'string' },
                params: { type: "array", items: { type: ['string', 'number', 'boolean', 'null'] } },
            },
            required: ['sql']
        };
    }

    private getListTablesSchema() {
        return {
            type: 'object',
            properties: {},
            required: []
        };
    }

    private getDescribeTableSchema() {
        return {
            type: 'object',
            properties: { table: { type: 'string' } },
            required: ['table']
        };
    }

    private async handleToolRequest(request: any) {
        const { name, arguments: args } = request.params;
        const { sql, params, table, host, user, password, database, port } = args || {};

        switch (name) {
            case 'connect_db': return this.handleConnectDb({ host, user, password, database, port });
            case 'query': return this.handleQuery({ sql, params });
            case 'execute': return this.handleExecute({ sql, params });
            case 'list_tables': return this.handleListTables();
            case 'describe_table': return this.handleDescribeTable({ table });
            default: throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
    }

    private async handleConnectDb({ host, user, password, database, port }: ConnectDbArgs): Promise<ToolResponse> {
        this.configManager.setDbConfig({ host, user, password, database, port });
        await this.dbManager.connect({ host, user, password, database, port });
        return this.createTextResponse("Successfully connected to database");
    }

    private async handleQuery({ sql, params }: QueryArgs): Promise<ToolResponse> {
        if (!validateSelectQuery(sql)) throw new McpError(ErrorCode.InvalidParams, 'Only SELECT queries allowed');
        const [rows] = await this.dbManager.query(sql, params || []);
        return this.createTextResponse(JSON.stringify(rows, null, 2));
    }

    private async handleExecute({ sql, params }: QueryArgs): Promise<ToolResponse> {
        if (!validateNonSelectQuery(sql)) throw new McpError(ErrorCode.InvalidParams, 'Use query tool for SELECT statements');
        const [result] = await this.dbManager.query(sql, params || []);
        return this.createTextResponse(JSON.stringify(result, null, 2));
    }

    private async handleListTables(): Promise<ToolResponse> {
        const [rows] = await this.dbManager.query("SHOW TABLES");
        return this.createTextResponse(JSON.stringify(rows, null, 2));
    }

    private async handleDescribeTable({ table }: DescribeTableArgs): Promise<ToolResponse> {
        const [rows] = await this.dbManager.query("DESCRIBE ??", [table]);
        return this.createTextResponse(JSON.stringify(rows, null, 2));
    }

    private createTextResponse(text: string): ToolResponse {
        return { content: [{ type: "text", text }] };
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