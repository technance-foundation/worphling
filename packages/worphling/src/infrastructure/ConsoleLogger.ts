import { ANSI_COLORS } from "../constants.js";
import type { Logger } from "../types.js";

/**
 * Console-backed runtime logger.
 *
 * This is the single concrete logger used by the CLI runtime so all
 * user-facing messages share the same formatting behavior.
 */
export class ConsoleLogger implements Logger {
    /**
     * Logs a message.
     *
     * @param message - Message to write
     */
    log(message: string): void {
        console.log(message);
    }

    /**
     * Logs a neutral informational message.
     *
     * @param message - Message to write
     */
    info(message: string): void {
        console.log(message);
    }

    /**
     * Logs a success message.
     *
     * @param message - Message to write
     */
    success(message: string): void {
        console.log(ANSI_COLORS.green, message);
    }

    /**
     * Logs a warning message.
     *
     * @param message - Message to write
     */
    warn(message: string): void {
        console.log(ANSI_COLORS.yellow, message);
    }

    /**
     * Logs an error message.
     *
     * @param message - Message to write
     */
    error(message: string): void {
        console.error(ANSI_COLORS.red, message);
    }
}
