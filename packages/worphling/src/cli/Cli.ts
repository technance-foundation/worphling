import minimist from "minimist";
import pc from "picocolors";

import type { CliFlags, CommandName, ReportFormat } from "../types.js";

/**
 * Parses command-line arguments into normalized CLI flags and renders the
 * user-facing CLI help output.
 *
 * Supported command structure:
 *
 * ```bash
 * worphling help
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
 * - `--fail-on-warnings`
 * - `--help`
 * - `-h`
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
            boolean: ["dry-run", "write", "ci", "fail-on-changes", "fail-on-warnings", "help"],
            default: {
                "dry-run": false,
                write: false,
                ci: false,
                "fail-on-changes": false,
                "fail-on-warnings": false,
                help: false,
            },
            alias: {
                c: "config",
                h: "help",
            },
        });

        const command = this.#resolveCommand(args._[0], Boolean(args.help));
        const locales = this.#parseLocales(args.locales);
        const reportFormat = this.#parseReportFormat(args["report-format"]);

        return {
            command,
            configPath: this.#getOptionalString(args.config),
            dryRun: Boolean(args["dry-run"]),
            write: Boolean(args.write),
            locales,
            reportFormat,
            reportFile: this.#getOptionalString(args["report-file"]),
            ci: Boolean(args.ci),
            failOnChanges: Boolean(args["fail-on-changes"]),
            failOnWarnings: Boolean(args["fail-on-warnings"]),
        };
    }

    /**
     * Resolves the CLI command.
     *
     * Defaults to `'help'` when no command is provided.
     *
     * @param value - Raw command argument
     * @param helpRequested - Whether help was explicitly requested with a flag
     * @returns Normalized command name
     */
    #resolveCommand(value: unknown, helpRequested: boolean): CommandName {
        if (helpRequested) {
            return "help";
        }

        if (value === undefined) {
            return "help";
        }

        if (
            value === "help" ||
            value === "check" ||
            value === "translate" ||
            value === "fix" ||
            value === "sync" ||
            value === "report"
        ) {
            return value;
        }

        throw new Error(`Unsupported command "${String(value)}".`);
    }

    /**
     * Parses the optional locales filter.
     *
     * Input is expected to be a comma-separated string such as `'es,fa,ru'`.
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

    /**
     * Returns the formatted CLI help text.
     *
     * @returns Help output
     */
    static renderHelp(): string {
        const title = pc.bold(pc.cyan("Worphling"));
        const subtitle = pc.dim("Keep your translations in sync with AI-powered automation.");
        const section = (name: string) => pc.bold(pc.underline(name));

        return [
            title,
            subtitle,
            "",
            section("Usage"),
            "  worphling <command> [options]",
            "",
            section("Commands"),
            `  ${pc.green("help")}         Show this help message`,
            `  ${pc.green("check")}        Analyze locale files without changing them`,
            `  ${pc.green("translate")}    Translate missing and modified keys`,
            `  ${pc.green("fix")}          Remove extra keys from target locales`,
            `  ${pc.green("sync")}         Translate and clean locale files in one run`,
            `  ${pc.green("report")}       Generate a standalone report`,
            "",
            section("Options"),
            "  -c, --config <path>            Use a specific config file",
            "  -h, --help                     Show help",
            "      --write                    Apply changes to disk",
            "      --dry-run                  Run without writing files",
            "      --ci                       Enable CI mode",
            "      --locales <a,b,c>          Restrict execution to specific locales",
            "      --report-file <path>       Write a report file",
            "      --report-format <format>   Force report format: json | markdown",
            "      --fail-on-changes          Exit non-zero when changes are detected",
            "      --fail-on-warnings         Exit non-zero when warnings are present",
            "",
            section("Examples"),
            `  ${pc.yellow("worphling check")}`,
            `  ${pc.yellow("worphling check --ci")}`,
            `  ${pc.yellow("worphling sync --write")}`,
            `  ${pc.yellow("worphling report --report-file ./artifacts/worphling-report.md")}`,
            "",
            pc.dim("Config file: worphling.config.mjs or worphling.config.js"),
            "",
        ].join("\n");
    }
}
