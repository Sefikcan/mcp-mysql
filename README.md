# MCP MySQL Server

A Model Context Protocol (MCP) server implementation for MySQL database operations. This server provides a standardized interface for interacting with MySQL databases through MCP tools.

## Features

- Connect to MySQL databases
- Execute SELECT queries
- Perform INSERT, UPDATE, and DELETE operations
- List database tables
- Describe table structures
- Environment-based configuration
- Type-safe implementation

## Prerequisites

- Node.js (v14 or higher)
- MySQL Server
- TypeScript

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mcp-mysql
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your MySQL configuration:
```env
MYSQL_HOST=localhost
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database
MYSQL_PORT=3306  # Optional, defaults to 3306
```

## Project Structure

```
src/
├── index.ts        # Main server implementation
├── config.ts       # Configuration management
├── database.ts     # Database connection handling
├── types.ts        # TypeScript type definitions
└── utils.ts        # Utility functions
```

## Available Tools

### 1. connect_db
Establishes a connection to a MySQL database.
```typescript
{
    host: string;      // Database host
    user: string;      // Database user
    password: string;  // Database password
    database: string;  // Database name
    port?: number;     // Optional: Database port (default: 3306)
}
```

### 2. query
Executes SELECT queries on the database.
```typescript
{
    sql: string;       // SQL SELECT query
    params?: any[];    // Optional: Query parameters
}
```

### 3. execute
Performs INSERT, UPDATE, or DELETE operations.
```typescript
{
    sql: string;       // SQL query (INSERT, UPDATE, DELETE)
    params?: any[];    // Optional: Query parameters
}
```

### 4. list_tables
Lists all tables in the connected database.

### 5. describe_table
Retrieves the structure of a specified table.
```typescript
{
    table: string;     // Table name
}
```

## Error Handling

The server implements comprehensive error handling:
- Connection errors
- Query execution errors
- Invalid parameter errors
- Type validation errors

## Development

1. Build the project:
```bash
npm run build
```

2. Run in development mode:
```bash
npm run dev
```

3. Run tests:
```bash
npm test
```

## Type Safety

The project is written in TypeScript and provides type definitions for:
- Database configuration
- Query parameters
- Tool arguments
- Response structures
## License

This project is licensed under the MIT License - see the LICENSE file for details.
