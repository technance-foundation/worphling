import type OpenAI from "openai";

import type { SupportedPluginName, SupportedProviderName, SupportedReportFormat } from "./constants.js";

/**
 * Supported CLI command names.
 *
 * These commands are intentionally modeled up front so the runtime,
 * configuration, and reporting layers can share a stable vocabulary.
 */
export type CommandName = "help" | "check" | "translate" | "fix" | "sync" | "report";

/**
 * Supported translation provider names.
 */
export type TranslationProviderName = SupportedProviderName;

/**
 * Supported plugin names.
 */
export type PluginName = SupportedPluginName;

/**
 * Supported report output formats.
 */
export type ReportFormat = SupportedReportFormat;

/**
 * JSON primitive values supported inside translation files.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Recursive JSON value type used for locale file contents.
 */
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/**
 * Recursive JSON array type.
 */
export interface JsonArray extends Array<JsonValue> {}

/**
 * Recursive JSON object type.
 */
export interface JsonObject {
    [key: string]: JsonValue;
}

/**
 * Locale file represented as a nested JSON object.
 *
 * Translation source files are expected to be objects at the root.
 */
export type LocaleFile = JsonObject;

/**
 * Locale files grouped by locale code.
 *
 * Example:
 * ```ts
 * {
 *     en: { app: { title: "Hello" } },
 *     es: { app: { title: "Hola" } },
 * }
 * ```
 */
export type LocaleFiles = Record<string, LocaleFile>;

/**
 * Flat translation dictionary using dot-notated keys.
 *
 * Example:
 * ```ts
 * {
 *     "app.title": "Hello",
 *     "app.subtitle": "Welcome back",
 * }
 * ```
 */
export type FlatLocaleFile = Record<string, string>;

/**
 * Flat translation dictionaries grouped by locale code.
 */
export type FlatLocaleFiles = Record<string, FlatLocaleFile>;

/**
 * OpenAI provider configuration.
 */
export interface OpenAiProviderConfig {
    /**
     * Stable provider identifier.
     */
    name: "openai";

    /**
     * Provider API key.
     */
    apiKey: string;

    /**
     * Model used for translation generation.
     *
     * When omitted, the runtime may apply a default model.
     */
    model?: OpenAI.Chat.ChatModel;

    /**
     * Sampling temperature used for generation.
     *
     * Translation workflows should typically keep this at `0`.
     */
    temperature?: number;
}

/**
 * Translation provider configuration.
 *
 * This union is intentionally structured for future provider expansion.
 */
export type TranslationProviderConfig = OpenAiProviderConfig;

/**
 * Plugin configuration.
 *
 * The plugin is responsible for syntax-aware translation handling, such as ICU,
 * rich text tags, and other framework-specific conventions.
 */
export interface PluginConfig {
    /**
     * Plugin identifier.
     */
    name: PluginName;
}

/**
 * Output formatting configuration for written locale files.
 */
export interface OutputConfig {
    /**
     * Whether object keys should be sorted recursively before writing.
     */
    sortKeys: boolean;

    /**
     * Number of spaces used when serializing JSON output.
     */
    preserveIndentation: number;

    /**
     * Whether written files should end with a trailing newline.
     */
    trailingNewline: boolean;
}

/**
 * Validation configuration controlling structural and policy checks.
 */
export interface ValidationConfig {
    /**
     * Whether interpolation placeholders such as `{name}` must be preserved.
     */
    preservePlaceholders: boolean;

    /**
     * Whether ICU message syntax must be preserved and validated.
     */
    preserveIcuSyntax: boolean;

    /**
     * Whether HTML-like tags such as `<bold>` must be preserved.
     */
    preserveHtmlTags: boolean;

    /**
     * Whether extra keys in target locales should fail the run.
     */
    failOnExtraKeys: boolean;

    /**
     * Whether missing keys in target locales should fail the run.
     */
    failOnMissingKeys: boolean;

    /**
     * Whether modified source keys requiring retranslation should fail the run.
     */
    failOnModifiedSource: boolean;
}

/**
 * Translation execution configuration.
 */
export interface TranslationConfig {
    /**
     * Maximum number of translation entries sent in a single batch.
     */
    batchSize: number;

    /**
     * Maximum retry attempts for transient provider failures.
     */
    maxRetries: number;

    /**
     * Maximum number of concurrent translation batches.
     */
    concurrency: number;

    /**
     * Whether translated text should attempt to stay close to the source length.
     */
    exactLength: boolean;

    /**
     * Optional path to a text file containing translation instructions, glossary
     * rules, tone, or domain terminology.
     */
    contextFile?: string;
}

/**
 * Runtime policy configuration.
 *
 * These settings control reporting and failure behavior for normal runs,
 * regardless of whether the caller is local development, CI, or another
 * automation environment.
 */
export interface RuntimeConfig {
    /**
     * Optional default report output path.
     *
     * CLI `--report-file` should take precedence when provided.
     */
    reportFile?: string;

    /**
     * Whether the process should fail when changes are detected.
     *
     * CLI `--fail-on-changes` should take precedence when provided.
     */
    failOnChanges: boolean;

    /**
     * Whether warnings should cause the process to fail.
     *
     * CLI `--fail-on-warnings` should take precedence when provided.
     */
    failOnWarnings: boolean;
}

/**
 * Main runtime configuration for Worphling.
 *
 * This interface is intentionally aligned with the new v3 config format and is
 * expected to be the single source of truth for configuration across the
 * runtime, CLI, and reporting layers.
 */
export interface Config {
    /**
     * Locale used as the source of truth for all translations.
     */
    sourceLocale: string;

    /**
     * Directory containing all locale files.
     */
    localesDir: string;

    /**
     * Glob-like file pattern used to discover locale files.
     *
     * Example:
     * - `*.json`
     * - `*.jsonc`
     */
    filePattern: string;

    /**
     * Translation provider configuration.
     */
    provider: TranslationProviderConfig;

    /**
     * Syntax/plugin configuration.
     */
    plugin: PluginConfig;

    /**
     * Snapshot file contents for source tracking.
     */
    snapshot: SnapshotConfig;

    /**
     * Output writing configuration.
     */
    output: OutputConfig;

    /**
     * Validation behavior configuration.
     */
    validation: ValidationConfig;

    /**
     * Translation execution configuration.
     */
    translation: TranslationConfig;

    /**
     * Runtime reporting and failure policy configuration.
     */
    runtime: RuntimeConfig;
}

/**
 * Normalized config after defaults have been applied.
 *
 * For now this is the same as {@link Config}, but keeping the alias makes the
 * loading pipeline more expressive and gives us room to distinguish raw vs
 * normalized config later without a breaking rename.
 */
export type ResolvedConfig = Config;

/**
 * CLI flags resolved from command-line arguments.
 *
 * These flags override or refine config-driven behavior for a single run.
 */
export interface CliFlags {
    /**
     * Command selected by the user.
     */
    command: CommandName;

    /**
     * Optional explicit config file path.
     */
    configPath?: string;

    /**
     * Whether the run should avoid writing files.
     */
    dryRun: boolean;

    /**
     * Whether the run is allowed to write files.
     */
    write: boolean;

    /**
     * Optional comma-separated locale filter resolved into an array.
     */
    locales?: Array<string>;

    /**
     * Optional report format requested by the caller.
     */
    reportFormat?: ReportFormat;

    /**
     * Optional explicit report output path.
     */
    reportFile?: string;

    /**
     * Whether the process should fail when changes are detected.
     */
    failOnChanges: boolean;

    /**
     * Whether warnings should cause the process to fail.
     */
    failOnWarnings: boolean;
}

/**
 * Runtime config composed from the loaded config file plus CLI flags.
 */
export interface AppConfig {
    /**
     * Loaded and normalized config file.
     */
    config: ResolvedConfig;

    /**
     * Parsed CLI flags for the current invocation.
     */
    flags: CliFlags;

    /**
     * Optional runtime logger.
     *
     * When omitted, the app will create its default console logger.
     */
    logger?: Logger;
}

/**
 * Category of detected locale issue.
 */
export type LocaleIssueType =
    | "missing"
    | "extra"
    | "modified"
    | "invalid-placeholder"
    | "invalid-icu"
    | "invalid-tag"
    | "invalid-structure"
    | "provider-error";

/**
 * Severity level assigned to a detected issue.
 */
export type IssueSeverity = "error" | "warning" | "info";

/**
 * Structured issue emitted during analysis, validation, or translation.
 */
export interface LocaleIssue {
    /**
     * Stable issue type.
     */
    type: LocaleIssueType;

    /**
     * Issue severity.
     */
    severity: IssueSeverity;

    /**
     * Locale affected by the issue.
     */
    locale: string;

    /**
     * Translation key affected by the issue.
     */
    key: string;

    /**
     * Human-readable issue message.
     */
    message: string;

    /**
     * Optional source value associated with the issue.
     */
    sourceValue?: string;

    /**
     * Optional target value associated with the issue.
     */
    targetValue?: string;
}

/**
 * Diff result describing missing, extra, and modified keys across locales.
 */
export interface DiffResult {
    /**
     * Missing keys grouped by locale.
     */
    missing: FlatLocaleFiles;

    /**
     * Extra keys grouped by locale.
     */
    extra: FlatLocaleFiles;

    /**
     * Modified source-derived keys grouped by locale.
     */
    modified: FlatLocaleFiles;
}

/**
 * Action planned by the engine before applying changes.
 *
 * Planning actions explicitly makes dry-runs, CI reports, and deterministic
 * execution significantly easier to implement and test.
 */
export type PlanAction =
    | {
          type: "translate-missing";
          locale: string;
          entries: FlatLocaleFile;
      }
    | {
          type: "retranslate-modified";
          locale: string;
          entries: FlatLocaleFile;
      }
    | {
          type: "remove-extra-keys";
          locale: string;
          entries: FlatLocaleFile;
      }
    | {
          type: "write-locale-file";
          locale: string;
      };

/**
 * Execution plan produced before translation or file writes occur.
 */
export interface Plan {
    /**
     * Ordered list of actions to execute.
     */
    actions: Array<PlanAction>;
}

/**
 * Single translation entry sent to a translation provider.
 */
export interface TranslationEntry {
    /**
     * Dot-notated translation key.
     */
    key: string;

    /**
     * Source message to translate.
     */
    source: string;
}

/**
 * Translation batch for a single locale.
 */
export interface TranslationBatch {
    /**
     * Target locale for the batch.
     */
    locale: string;

    /**
     * Entries to translate.
     */
    entries: Array<TranslationEntry>;
}

/**
 * Result returned for a translated batch.
 */
export interface TranslationBatchResult {
    /**
     * Target locale for the batch.
     */
    locale: string;

    /**
     * Flat translated entries keyed by dot-notated translation key.
     */
    entries: FlatLocaleFile;
}

/**
 * Prompt context supplied by a translation plugin.
 */
export interface TranslationPluginPromptContext {
    /**
     * Additional plugin-specific system prompt instructions.
     */
    additionalInstructions: Array<string>;

    /**
     * Example input appropriate for the plugin.
     */
    exampleInput: string;

    /**
     * Example output appropriate for the plugin.
     */
    exampleOutput: string;
}

/**
 * Contract for translation plugins.
 *
 * ICU remains the core message model of Worphling. Plugins only add
 * framework-specific prompting and validation adjustments on top of that core
 * behavior.
 */
export interface TranslationPluginContract {
    /**
     * Stable plugin identifier.
     */
    readonly name: PluginName;

    /**
     * Returns prompt context used by translation providers.
     *
     * @returns Plugin prompt context
     */
    getPromptContext(): TranslationPluginPromptContext;

    /**
     * Returns framework-specific validation overrides.
     *
     * These overrides are merged on top of the user-provided validation config.
     * ICU and placeholder preservation are considered core behavior and should
     * not be modeled as plugin-specific concerns.
     *
     * @returns Partial validation config overrides
     */
    getValidationOverrides(): Partial<ValidationConfig>;
}

/**
 * Contract for translation providers.
 *
 * Providers are intentionally decoupled from filesystem, diffing, and writing
 * concerns so they can be tested and replaced independently.
 */
export interface TranslationProviderContract {
    /**
     * Stable provider identifier.
     */
    readonly name: TranslationProviderName;

    /**
     * Translates a batch of source entries into the requested locale.
     *
     * @param batch - Translation batch to process
     * @param config - Fully resolved runtime config
     * @returns Translated batch result
     */
    translate(batch: TranslationBatch, config: ResolvedConfig): Promise<TranslationBatchResult>;
}

/**
 * Snapshot file contents for hash-based or snapshot-based source tracking.
 */
export interface SnapshotFile {
    /**
     * Source locale the snapshot belongs to.
     */
    sourceLocale: string;

    /**
     * Flattened source values keyed by dot-notated translation key.
     */
    entries: Record<string, string>;
}

/**
 * Summary of a completed run.
 */
export interface RunSummary {
    /**
     * Command executed for the run.
     */
    command: CommandName;

    /**
     * Source locale used as the translation source of truth.
     */
    sourceLocale: string;

    /**
     * Target locales included in the run.
     */
    targetLocales: Array<string>;

    /**
     * Total number of missing keys detected.
     */
    missingCount: number;

    /**
     * Total number of extra keys detected.
     */
    extraCount: number;

    /**
     * Total number of modified keys detected.
     */
    modifiedCount: number;

    /**
     * Total number of keys translated during the run.
     */
    translatedCount: number;

    /**
     * Total number of files written during the run.
     */
    writtenFileCount: number;

    /**
     * Whether the run changed files or would change files in dry-run mode.
     */
    hasChanges: boolean;

    /**
     * Whether translation execution failed due to a provider error.
     */
    hasProviderFailure?: boolean;
}

/**
 * Structured run report used by console output, CI output, and serialized
 * report files.
 */
export interface RunReport {
    /**
     * Top-level summary of the run.
     */
    summary: RunSummary;

    /**
     * Structured issues detected during the run.
     */
    issues: Array<LocaleIssue>;
}

/**
 * Stable process exit codes used by the CLI.
 */
export enum ExitCode {
    /**
     * Command completed successfully.
     */
    Success = 0,

    /**
     * Generic runtime failure.
     */
    Error = 1,

    /**
     * Configuration file could not be found, loaded, or validated.
     */
    ConfigError = 2,

    /**
     * Validation failed.
     */
    ValidationError = 3,

    /**
     * Changes were detected and configured policy required failure.
     */
    ChangesDetected = 4,

    /**
     * Translation provider failed.
     */
    ProviderError = 5,
}

/**
 * Contract for runtime logging.
 *
 * This keeps user-facing output consistent across the CLI, app orchestration,
 * repositories, and execution collaborators.
 */
export interface Logger {
    /**
     * Logs a message.
     *
     * @param message - Message to write
     */
    log(message: string): void;

    /**
     * Logs a neutral informational message.
     *
     * @param message - Message to write
     */
    info(message: string): void;

    /**
     * Logs a success message.
     *
     * @param message - Message to write
     */
    success(message: string): void;

    /**
     * Logs a warning message.
     *
     * @param message - Message to write
     */
    warn(message: string): void;

    /**
     * Logs an error message.
     *
     * @param message - Message to write
     */
    error(message: string): void;
}

/**
 * Snapshot configuration.
 */
export interface SnapshotConfig {
    /**
     * Snapshot file path used for source-change detection.
     */
    file: string;
}
