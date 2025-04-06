export function isErrorWithMessage(error: unknown): error is { message: string } {
    return (
        typeof error === "object" && 
        error !== null && 
        "message" in error &&
        typeof (error as Record<string, unknown>).message === "string"
    );
}

export function getErrorMessage(error: unknown): string {
    if (isErrorWithMessage(error)) {
        return error.message;
    }
    return String(error);
}

export function validateSelectQuery(sql: string): boolean {
    return sql.trim().toUpperCase().startsWith('SELECT');
}

export function validateNonSelectQuery(sql: string): boolean {
    const upperSql = sql.trim().toUpperCase();
    return upperSql.startsWith('INSERT') || 
           upperSql.startsWith('UPDATE') || 
           upperSql.startsWith('DELETE');
} 