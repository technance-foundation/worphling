import type { Logger } from "../types.js";

/**
 * Logger that discards every message.
 *
 * Used as the default for programmatic API calls, where the host application
 * decides whether and how runtime diagnostics are surfaced.
 */
export class SilentLogger implements Logger {
    /**
     * Discards a neutral message.
     */
    log(): void {}

    /**
     * Discards an informational message.
     */
    info(): void {}

    /**
     * Discards a success message.
     */
    success(): void {}

    /**
     * Discards a warning message.
     */
    warn(): void {}

    /**
     * Discards an error message.
     */
    error(): void {}
}
