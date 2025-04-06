import * as mysql from 'mysql2/promise';
import { getErrorMessage } from './utils.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
export class DatabaseManager {
    constructor() {
        this.connection = null;
    }
    static getInstance() {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }
    async connect(config) {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
        try {
            this.connection = await mysql.createConnection(config);
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to connect to database: ${getErrorMessage(error)}`);
        }
    }
    async ensureConnection() {
        if (!this.connection) {
            throw new McpError(ErrorCode.InvalidRequest, "Database connection not established");
        }
    }
    async query(sql, params = []) {
        await this.ensureConnection();
        try {
            return await this.connection.query(sql, params);
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Query execution failed: ${getErrorMessage(error)}`);
        }
    }
    async cleanup() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
}
