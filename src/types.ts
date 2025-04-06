import { RowDataPacket, FieldPacket } from 'mysql2';
import { ServerResult } from '@modelcontextprotocol/sdk/types.js';

export interface DatabaseConfig {
    host: string;
    port?: number;
    user: string;
    password: string;
    database: string;
}

export type ToolResponse = ServerResult;

export type QueryResult = [RowDataPacket[] | RowDataPacket[][] | any, FieldPacket[]];