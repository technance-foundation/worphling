import type { DiffResult, Logger } from "../types.js";

/**
 * Human-facing console reporter for runtime execution.
 *
 * This collaborator formats stable CLI messages while delegating the actual
 * output transport to the configured logger.
 */
export class RunConsoleReporter {
    /**
     * Runtime logger used for user-facing output.
     */
    #logger: Logger;

    /**
     * Creates a new run console reporter.
     *
     * @param logger - Runtime logger
     */
    constructor(logger: Logger) {
        this.#logger = logger;
    }

    /**
     * Logs a stable summary of detected diff state.
     *
     * @param diffResult - Structured diff result
     */
    logDetectedChanges(diffResult: DiffResult): void {
        const missingCount = this.#countFlatLocaleEntries(diffResult.missing);
        const extraCount = this.#countFlatLocaleEntries(diffResult.extra);
        const modifiedCount = this.#countFlatLocaleEntries(diffResult.modified);

        if (missingCount > 0) {
            this.#logger.warn(`Found ${missingCount} missing translations across all languages.`);
        }

        if (extraCount > 0) {
            this.#logger.warn(`Found ${extraCount} extra translation key${extraCount > 1 ? "s" : ""} across all languages.`);
        }

        if (modifiedCount > 0) {
            this.#logger.warn(`Found ${modifiedCount} modified keys that need retranslation.`);
        }

        if (missingCount === 0 && extraCount === 0 && modifiedCount === 0) {
            this.#logger.success("All target languages are already translated and up to date.");
        }
    }

    /**
     * Logs the resolved execution mode for the current run.
     *
     * @param executionPolicy - Resolved execution policy
     * @param ciMode - Whether CI mode is active
     */
    logExecutionMode(
        executionPolicy: {
            executePlan: boolean;
            writeFiles: boolean;
            reason?: string;
        },
        ciMode: boolean,
    ): void {
        if (executionPolicy.reason) {
            this.#logger.warn(executionPolicy.reason);
        }

        if (ciMode && !executionPolicy.reason?.includes("CI mode is active")) {
            this.#logger.warn("CI mode is active. Locale files will not be modified.");
        }

        if (!executionPolicy.executePlan) {
            return;
        }

        if (executionPolicy.writeFiles) {
            this.#logger.warn("Applying planned locale changes...");
            return;
        }

        this.#logger.warn("Executing planned locale changes in memory only.");
    }

    /**
     * Logs that a report artifact was written successfully.
     *
     * @param reportFilePath - Written report file path
     */
    logReportWritten(reportFilePath: string): void {
        this.#logger.success(`Success: Report written to ${reportFilePath}`);
    }

    /**
     * Counts the total number of flat translation entries across all locales.
     *
     * @param localeFiles - Flat locale files grouped by locale
     * @returns Total entry count
     */
    #countFlatLocaleEntries(localeFiles: Record<string, Record<string, string>>): number {
        return Object.values(localeFiles).reduce((total, entries) => total + Object.keys(entries).length, 0);
    }
}
