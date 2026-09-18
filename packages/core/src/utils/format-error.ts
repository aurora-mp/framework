/**
 * Converts an unknown error value into a string suitable for the framework's
 * single-argument logger. Prefers full stack traces so incident forensics
 * survive log aggregation.
 *
 * @internal
 */
export function formatError(error: unknown): string {
    if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
    return String(error);
}
