import * as mysql from 'mysql2/promise';
import { DatabaseConfig, QueryResult } from './types.js';
import { getErrorMessage } from './utils.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export class DatabaseManager {
    private static instance: DatabaseManager;
    private connection: mysql.Connection | null = null;

    private constructor() {}

    static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    async connect(config: DatabaseConfig): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }

        try {
            this.connection = await mysql.createConnection(config);
        } catch (error) {
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to connect to database: ${getErrorMessage(error)}`,
            );
        }
    }

    async ensureConnection(): Promise<void> {
        if (!this.connection) {
            throw new McpError(
                ErrorCode.InvalidRequest,
                "Database connection not established"
            );
        }
    }

    async query(sql: string, params: any[] = []): Promise<QueryResult> {
        await this.ensureConnection();
        try {
            return await this.connection!.query(sql, params);
        } catch (error) {
            throw new McpError(
                ErrorCode.InternalError,
                `Query execution failed: ${getErrorMessage(error)}`
            );
        }
    }

    async cleanup(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
} 