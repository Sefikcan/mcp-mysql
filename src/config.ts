import dotenv from 'dotenv';
import { DatabaseConfig } from './types.js';

dotenv.config();

export class ConfigManager {
    private static instance: ConfigManager;
    private dbConfig: DatabaseConfig | null = null;

    private constructor() {}

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    loadEnvConfig(): DatabaseConfig | null {
        if (process.env.MYSQL_HOST &&
            process.env.MYSQL_USER &&
            process.env.MYSQL_PASSWORD !== undefined &&
            process.env.MYSQL_PASSWORD !== null &&
            process.env.MYSQL_DATABASE) {
            return {
                host: process.env.MYSQL_HOST,
                user: process.env.MYSQL_USER,
                password: process.env.MYSQL_PASSWORD,
                database: process.env.MYSQL_DATABASE,
                port: Number(process.env.MYSQL_PORT ?? 3306),
            };
        }
        return null;
    }

    setDbConfig(config: DatabaseConfig) {
        this.dbConfig = config;
    }

    getDbConfig(): DatabaseConfig | null {
        return this.dbConfig || this.loadEnvConfig();
    }
} 