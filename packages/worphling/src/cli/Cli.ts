import minimist from "minimist";

import type { CliFlags, CommandName, ReportFormat } from "../types.js";

/**
 * Parses command-line arguments into normalized CLI flags.
 *
 * Supported command structure:
 *
 * ```bash
 * worphling check
 * worphling translate --write
 * worphling sync --ci --fail-on-changes
 * worphling report --report-format json
 * ```
 *
 * Supported options:
 * - `--config`
 * - `--dry-run`
 * - `--write`
 * - `--locales`
 * - `--report-format`
 * - `--report-file`
 * - `--ci`
 * - `--fail-on-changes`
 *
 * @example
 * ```ts
 * const cli = new Cli();
 * const flags = cli.flags;
 * ```
 */
export class Cli {
    /**
     * Parsed and normalized CLI flags for the current process invocation.
     */
    readonly flags: CliFlags;

    /**
     * Creates a new CLI parser instance.
     */
    constructor() {
        this.flags = this.#detectFlags();
    }

    /**
     * Parses process arguments and returns normalized CLI flags.
     *
     * @returns Parsed CLI flags
     */
    #detectFlags(): CliFlags {
        const args = minimist(process.argv.slice(2), {
            string: ["config", "locales", "report-format", "report-file"],
            boolean: ["dry-run", "write", "ci", "fail-on-changes"],
            default: {
                "dry-run": false,
                write: false,
                ci: false,
                "fail-on-changes": false,
            },
            alias: {
                c: "config",
            },
        });

        const command = this.#resolveCommand(args._[0]);
        const locales = this.#parseLocales(args["locales"]);
        const reportFormat = this.#parseReportFormat(args["report-format"]);

        return {
            command,
            configPath: this.#getOptionalString(args["config"]),
            dryRun: Boolean(args["dry-run"]),
            write: Boolean(args["write"]),
            locales,
            reportFormat,
            reportFile: this.#getOptionalString(args["report-file"]),
            ci: Boolean(args["ci"]),
            failOnChanges: Boolean(args["fail-on-changes"]),
        };
    }

    /**
     * Resolves the CLI command.
     *
     * Defaults to `"check"` when no command is provided.
     *
     * @param value - Raw command argument
     * @returns Normalized command name
     */
    #resolveCommand(value: unknown): CommandName {
        if (value === undefined) {
            return "check";
        }

        if (value === "check" || value === "translate" || value === "fix" || value === "sync" || value === "report") {
            return value;
        }

        throw new Error(`Unsupported command "${String(value)}".`);
    }

    /**
     * Parses the optional locales filter.
     *
     * Input is expected to be a comma-separated string such as `"es,fa,ru"`.
     *
     * @param value - Raw locales argument
     * @returns Parsed locale list, or `undefined` when not provided
     */
    #parseLocales(value: unknown): Array<string> | undefined {
        const localesValue = this.#getOptionalString(value);

        if (!localesValue) {
            return undefined;
        }

        const locales = localesValue
            .split(",")
            .map((locale) => locale.trim())
            .filter(Boolean);

        return locales.length > 0 ? locales : undefined;
    }

    /**
     * Parses the optional report format.
     *
     * @param value - Raw report-format argument
     * @returns Parsed report format, or `undefined` when not provided
     */
    #parseReportFormat(value: unknown): ReportFormat | undefined {
        const reportFormat = this.#getOptionalString(value);

        if (!reportFormat) {
            return undefined;
        }

        if (reportFormat === "json" || reportFormat === "markdown") {
            return reportFormat;
        }

        throw new Error(`Unsupported report format "${reportFormat}".`);
    }

    /**
     * Returns a trimmed string value when the provided input is a non-empty
     * string.
     *
     * @param value - Raw argument value
     * @returns Trimmed string value, or `undefined`
     */
    #getOptionalString(value: unknown): string | undefined {
        if (typeof value !== "string") {
            return undefined;
        }

        const trimmedValue = value.trim();

        return trimmedValue ? trimmedValue : undefined;
    }
}
