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
import { 
    ConnectDbSchema, 
    QuerySchema, 
    ExecuteSchema, 
    DescribeTableSchema,
    toolSchemas,
    type ConnectDbInput,
    type QueryInput,
    type ExecuteInput,
    type DescribeTableInput
} from './schemas.js';
import type { ToolResponse } from './types.js';

class MySQLServer {
    private server: Server;
    private dbManager: DatabaseManager;
    private configManager: ConfigManager;

    constructor() {
        this.server = new Server(
            { name: "mysql-server", version: "1.0.0" },
            { capabilities: { tools: {} } }
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
        this.server.setRequestHandler(ListToolsRequestSchema, () => ({
            tools: this.getTools()
        }));

        this.server.setRequestHandler(CallToolRequestSchema, this.handleToolRequest.bind(this));
    }

    private getTools() {
        return [
            this.createTool("connect_db", "Connect to MySQL database", toolSchemas.connect_db),
            this.createTool("query", "Execute a SELECT query", toolSchemas.query),
            this.createTool("execute", "Execute an INSERT, UPDATE, or DELETE query", toolSchemas.execute),
            this.createTool("list_tables", "List all tables in the database", toolSchemas.list_tables),
            this.createTool("describe_table", "Get table structure", toolSchemas.describe_table)
        ];
    }

    private createTool(name: string, description: string, schema: object) {
        return { name, description, inputSchema: schema };
    }

    private async handleToolRequest(request: any) {
        const { name, arguments: args = {} } = request.params;

        try {
            switch (name) {
                case 'connect_db': {
                    const validatedArgs = ConnectDbSchema.parse(args);
                    return await this.handleConnectDb(validatedArgs);
                }
                case 'query': {
                    const validatedArgs = QuerySchema.parse(args);
                    return await this.handleQuery(validatedArgs);
                }
                case 'execute': {
                    const validatedArgs = ExecuteSchema.parse(args);
                    return await this.handleExecute(validatedArgs);
                }
                case 'list_tables':
                    return await this.handleListTables();
                case 'describe_table': {
                    const validatedArgs = DescribeTableSchema.parse(args);
                    return await this.handleDescribeTable(validatedArgs);
                }
                default:
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
                const zodError = error as { errors: Array<{ message: string }> };
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Invalid parameters: ${zodError.errors.map(e => e.message).join(', ')}`
                );
            }
            throw error;
        }
    }

    private async handleConnectDb(args: ConnectDbInput): Promise<ToolResponse> {
        this.configManager.setDbConfig(args);
        await this.dbManager.connect(args);
        return this.createTextResponse("Successfully connected to database");
    }

    private async handleQuery(args: QueryInput): Promise<ToolResponse> {
        if (!validateSelectQuery(args.sql)) {
            throw new McpError(ErrorCode.InvalidParams, 'Only SELECT queries allowed');
        }
        const [rows] = await this.dbManager.query(args.sql, args.params || []);
        return this.createTextResponse(JSON.stringify(rows, null, 2));
    }

    private async handleExecute(args: ExecuteInput): Promise<ToolResponse> {
        if (!validateNonSelectQuery(args.sql)) {
            throw new McpError(ErrorCode.InvalidParams, 'Use query tool for SELECT statements');
        }
        const [result] = await this.dbManager.query(args.sql, args.params || []);
        return this.createTextResponse(JSON.stringify(result, null, 2));
    }

    private async handleListTables(): Promise<ToolResponse> {
        const [rows] = await this.dbManager.query("SHOW TABLES");
        return this.createTextResponse(JSON.stringify(rows, null, 2));
    }

    private async handleDescribeTable(args: DescribeTableInput): Promise<ToolResponse> {
        const [rows] = await this.dbManager.query("DESCRIBE ??", [args.table]);
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