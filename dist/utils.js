export function isErrorWithMessage(error) {
    return (typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string");
}
export function getErrorMessage(error) {
    if (isErrorWithMessage(error)) {
        return error.message;
    }
    return String(error);
}
export function validateSelectQuery(sql) {
    return sql.trim().toUpperCase().startsWith('SELECT');
}
export function validateNonSelectQuery(sql) {
    const upperSql = sql.trim().toUpperCase();
    return upperSql.startsWith('INSERT') ||
        upperSql.startsWith('UPDATE') ||
        upperSql.startsWith('DELETE');
}
