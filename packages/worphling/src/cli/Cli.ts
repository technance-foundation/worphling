import minimist from "minimist";
import pc from "picocolors";

import type { CliFlags, CommandName, ReportFormat } from "../types.js";

import {
    CLI_COMMAND_DEFINITIONS,
    CLI_HELP_EXAMPLES,
    CLI_OPTION_DEFINITIONS,
    createMinimistConfiguration,
    isCliCommandName,
    isCliReportFormat,
} from "./cliSchema.js";

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
 * worphling sync --fail-on-changes
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
        const args = minimist(process.argv.slice(2), createMinimistConfiguration());
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

        if (isCliCommandName(value)) {
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

        if (isCliReportFormat(reportFormat)) {
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
            ...Cli.#renderCommandLines(),
            "",
            section("Options"),
            ...Cli.#renderOptionLines(),
            "",
            section("Examples"),
            ...Cli.#renderExampleLines(),
            "",
            pc.dim("Config file: worphling.config.mjs or worphling.config.js"),
            "",
        ].join("\n");
    }

    /**
     * Renders command help lines from the shared command schema.
     *
     * @returns Formatted command lines
     */
    static #renderCommandLines(): Array<string> {
        const longestCommandLength = Math.max(...CLI_COMMAND_DEFINITIONS.map((command) => command.name.length));

        return CLI_COMMAND_DEFINITIONS.map((command) => {
            const paddedCommandName = command.name.padEnd(longestCommandLength + 4, " ");

            return `  ${pc.green(paddedCommandName)}${command.description}`;
        });
    }

    /**
     * Renders option help lines from the shared option schema.
     *
     * @returns Formatted option lines
     */
    static #renderOptionLines(): Array<string> {
        const renderedLabels = CLI_OPTION_DEFINITIONS.map((option) => Cli.#renderOptionLabel(option));
        const longestLabelLength = Math.max(...renderedLabels.map((label) => label.length));

        return CLI_OPTION_DEFINITIONS.map((option, index) => {
            const label = renderedLabels[index].padEnd(longestLabelLength + 4, " ");

            return `  ${label}${option.description}`;
        });
    }

    /**
     * Renders example help lines from the shared example schema.
     *
     * @returns Formatted example lines
     */
    static #renderExampleLines(): Array<string> {
        return CLI_HELP_EXAMPLES.map((example) => `  ${pc.yellow(example)}`);
    }

    /**
     * Renders a single option label for help output.
     *
     * @param option - Option definition
     * @returns Rendered option label
     */
    static #renderOptionLabel(option: (typeof CLI_OPTION_DEFINITIONS)[number]): string {
        const shortPrefix = option.short ? `-${option.short}, ` : "    ";
        const valueSuffix = option.type === "string" ? ` <${option.valueLabel || "value"}>` : "";

        return `${shortPrefix}--${option.name}${valueSuffix}`;
    }
}
