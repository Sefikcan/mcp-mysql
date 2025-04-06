import dotenv from 'dotenv';
dotenv.config();
export class ConfigManager {
    constructor() {
        this.dbConfig = null;
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    loadEnvConfig() {
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
    setDbConfig(config) {
        this.dbConfig = config;
    }
    getDbConfig() {
        return this.dbConfig || this.loadEnvConfig();
    }
}
