import pc from "picocolors";

import type { Logger } from "../types.js";

/**
 * Console-backed runtime logger.
 *
 * This is the single concrete logger used by the CLI runtime so all
 * user-facing messages share the same formatting behavior.
 */
export class ConsoleLogger implements Logger {
    /**
     * Logs a neutral message without a level prefix.
     *
     * This is mainly useful for already-formatted multi-line output such as
     * rendered markdown reports or help text.
     *
     * @param message - Message to write
     */
    log(message: string): void {
        console.log(message);
    }

    /**
     * Logs an informational message.
     *
     * @param message - Message to write
     */
    info(message: string): void {
        console.log(pc.cyan(`[INFO] ${message}`));
    }

    /**
     * Logs a success message.
     *
     * @param message - Message to write
     */
    success(message: string): void {
        console.log(pc.green(`[SUCCESS] ${message}`));
    }

    /**
     * Logs a warning message.
     *
     * @param message - Message to write
     */
    warn(message: string): void {
        console.log(pc.yellow(`[WARN] ${message}`));
    }

    /**
     * Logs an error message.
     *
     * @param message - Message to write
     */
    error(message: string): void {
        console.error(pc.red(`[ERROR] ${message}`));
    }
}
