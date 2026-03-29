import type { CommandName, ReportFormat } from "../types.js";

/**
 * User-facing command definition used as the single source of truth for CLI
 * parsing and help rendering.
 */
export interface CliCommandDefinition {
    /**
     * Stable command name.
     */
    name: CommandName;

    /**
     * Human-readable help description.
     */
    description: string;
}

/**
 * User-facing option definition used as the single source of truth for CLI
 * parsing and help rendering.
 */
export interface CliOptionDefinition {
    /**
     * Long option name without the leading `--`.
     */
    name: string;

    /**
     * Optional short option alias without the leading `-`.
     */
    short?: string;

    /**
     * Primitive option type used for CLI parsing.
     */
    type: "string" | "boolean";

    /**
     * Human-readable help description.
     */
    description: string;

    /**
     * Default value used by the parser when applicable.
     */
    defaultValue?: string | boolean;

    /**
     * Optional placeholder label shown in help output for string options.
     */
    valueLabel?: string;

    /**
     * Optional allowed values for validation and help output.
     */
    allowedValues?: Array<string>;
}

/**
 * Canonical command definitions.
 */
export const CLI_COMMAND_DEFINITIONS: Array<CliCommandDefinition> = [
    {
        name: "help",
        description: "Show this help message",
    },
    {
        name: "check",
        description: "Analyze locale files without changing them",
    },
    {
        name: "translate",
        description: "Translate missing and modified keys",
    },
    {
        name: "fix",
        description: "Remove extra keys from target locales",
    },
    {
        name: "sync",
        description: "Translate and clean locale files in one run",
    },
    {
        name: "report",
        description: "Generate a standalone report",
    },
];

/**
 * Canonical option definitions.
 */
export const CLI_OPTION_DEFINITIONS: Array<CliOptionDefinition> = [
    {
        name: "config",
        short: "c",
        type: "string",
        description: "Use a specific config file",
        valueLabel: "path",
    },
    {
        name: "help",
        short: "h",
        type: "boolean",
        description: "Show help",
        defaultValue: false,
    },
    {
        name: "write",
        type: "boolean",
        description: "Apply changes to disk",
        defaultValue: false,
    },
    {
        name: "dry-run",
        type: "boolean",
        description: "Run without writing files",
        defaultValue: false,
    },
    {
        name: "locales",
        type: "string",
        description: "Restrict execution to specific locales",
        valueLabel: "a,b,c",
    },
    {
        name: "report-file",
        type: "string",
        description: "Write a report file",
        valueLabel: "path",
    },
    {
        name: "report-format",
        type: "string",
        description: "Force report format: json | markdown",
        valueLabel: "format",
        allowedValues: ["json", "markdown"],
    },
    {
        name: "fail-on-changes",
        type: "boolean",
        description: "Exit non-zero when changes are detected",
        defaultValue: false,
    },
    {
        name: "fail-on-warnings",
        type: "boolean",
        description: "Exit non-zero when warnings are present",
        defaultValue: false,
    },
];

/**
 * Example CLI invocations shown in help output.
 */
export const CLI_HELP_EXAMPLES: Array<string> = [
    "worphling check",
    "worphling sync --write",
    "worphling report --report-file ./artifacts/worphling-report.md",
];

/**
 * Returns whether the provided value is a supported command name.
 *
 * @param value - Value to test
 * @returns Whether the value is a supported command name
 */
export function isCliCommandName(value: unknown): value is CommandName {
    return typeof value === "string" && CLI_COMMAND_DEFINITIONS.some((command) => command.name === value);
}

/**
 * Returns whether the provided value is a supported report format.
 *
 * @param value - Value to test
 * @returns Whether the value is a supported report format
 */
export function isCliReportFormat(value: unknown): value is ReportFormat {
    return value === "json" || value === "markdown";
}

/**
 * Creates the `minimist` parser configuration derived from the shared option
 * schema.
 *
 * @returns Derived parser configuration
 */
export function createMinimistConfiguration(): {
    string: Array<string>;
    boolean: Array<string>;
    default: Record<string, string | boolean>;
    alias: Record<string, string>;
} {
    const stringOptions = CLI_OPTION_DEFINITIONS.filter((option) => option.type === "string").map((option) => option.name);
    const booleanOptions = CLI_OPTION_DEFINITIONS.filter((option) => option.type === "boolean").map((option) => option.name);

    const defaultValues: Record<string, string | boolean> = {};
    const aliases: Record<string, string> = {};

    for (const option of CLI_OPTION_DEFINITIONS) {
        if (option.defaultValue !== undefined) {
            defaultValues[option.name] = option.defaultValue;
        }

        if (option.short) {
            aliases[option.short] = option.name;
        }
    }

    return {
        string: stringOptions,
        boolean: booleanOptions,
        default: defaultValues,
        alias: aliases,
    };
}
