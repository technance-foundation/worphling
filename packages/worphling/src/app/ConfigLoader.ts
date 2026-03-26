import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
    CONFIG_FILE_EXTENSIONS,
    DEFAULT_CI_REPORT_FILE,
    DEFAULT_DETECTION_STRATEGY,
    DEFAULT_JSON_INDENTATION,
    DEFAULT_OPENAI_MODEL,
    DEFAULT_PLUGIN_NAME,
    DEFAULT_PROVIDER_TEMPERATURE,
    DEFAULT_TRANSLATION_BATCH_SIZE,
    DEFAULT_TRANSLATION_CONCURRENCY,
    DEFAULT_TRANSLATION_MAX_RETRIES,
    SUPPORTED_DETECTION_STRATEGIES,
    SUPPORTED_PLUGIN_NAMES,
    SUPPORTED_PROVIDER_NAMES,
} from "../constants.js";
import { ConfigFileNotFoundError, ConfigLoadError, ConfigValidationError } from "../errors.js";
import type {
    CiConfig,
    Config,
    DetectionConfig,
    OutputConfig,
    PluginConfig,
    ResolvedConfig,
    TranslationConfig,
    TranslationProviderConfig,
    ValidationConfig,
} from "../types.js";

/**
 * Loads, validates, and normalizes the Worphling runtime configuration.
 *
 * Responsibilities include:
 * - resolving the config file path
 * - dynamically importing the config module
 * - validating the raw shape
 * - applying runtime defaults
 *
 * @example
 * ```ts
 * const loader = new ConfigLoader();
 * const config = await loader.load();
 * ```
 *
 * @example
 * ```ts
 * const loader = new ConfigLoader("./worphling.config.mjs");
 * const config = await loader.load();
 * ```
 */
export class ConfigLoader {
    /**
     * Optional explicit config file path.
     *
     * When omitted, the loader searches for `worphling.config.*` using the
     * supported config file extensions.
     */
    #configPath?: string;

    /**
     * Last successfully loaded and normalized config.
     */
    #config: ResolvedConfig | null = null;

    /**
     * Creates a new config loader.
     *
     * @param configPath - Optional explicit config file path
     */
    constructor(configPath?: string) {
        this.#configPath = configPath;
    }

    /**
     * Returns the last successfully loaded config.
     *
     * @returns Previously loaded config
     * @throws {ConfigValidationError} When no config has been loaded yet
     */
    getConfig(): ResolvedConfig {
        if (!this.#config) {
            throw new ConfigValidationError(
                "Configuration has not been loaded. Please ensure a valid configuration file is present.",
            );
        }

        return this.#config;
    }

    /**
     * Loads, validates, and normalizes the runtime configuration.
     *
     * @returns Fully resolved runtime config
     * @throws {ConfigFileNotFoundError} When no config file can be resolved
     * @throws {ConfigLoadError} When the config file cannot be imported
     * @throws {ConfigValidationError} When the config shape is invalid
     */
    async load(): Promise<ResolvedConfig> {
        const configFilePath = this.#resolveConfigFilePath();

        try {
            const configFileUrl = pathToFileURL(configFilePath).href;
            const loadedModule: { default?: unknown } = await import(configFileUrl);
            const rawConfig = loadedModule.default;

            this.#validate(rawConfig);

            // Resolve relative localesDir against config file's directory
            const configDir = path.dirname(configFilePath);
            if (rawConfig.localesDir && !path.isAbsolute(rawConfig.localesDir)) {
                rawConfig.localesDir = path.normalize(path.join(configDir, rawConfig.localesDir));
            }

            const resolvedConfig = this.#normalize(rawConfig);
            this.#config = resolvedConfig;

            return resolvedConfig;
        } catch (error) {
            if (error instanceof ConfigValidationError || error instanceof ConfigFileNotFoundError) {
                throw error;
            }

            const reason = error instanceof Error ? error.message : "Unknown error";
            throw new ConfigLoadError(configFilePath, reason);
        }
    }

    /**
     * Resolves the config file path.
     *
     * Resolution order:
     * 1. Explicit constructor path
     * 2. `worphling.config.mjs`
     * 3. `worphling.config.js`
     *
     * @returns Absolute config file path
     * @throws {ConfigFileNotFoundError} When no supported config file exists
     */
    #resolveConfigFilePath(): string {
        if (this.#configPath) {
            const explicitPath = path.resolve(this.#configPath);

            if (!fs.existsSync(explicitPath)) {
                throw new ConfigFileNotFoundError(explicitPath);
            }

            return explicitPath;
        }

        for (const extension of CONFIG_FILE_EXTENSIONS) {
            const filePath = path.resolve(`worphling.config${extension}`);

            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }

        throw new ConfigFileNotFoundError(path.resolve(`worphling.config${CONFIG_FILE_EXTENSIONS[0]}`));
    }

    /**
     * Validates the raw config value before normalization.
     *
     * This method checks:
     * - root-level object shape
     * - required sections
     * - supported enum-like values
     * - basic scalar value integrity
     *
     * @param config - Raw imported config value
     * @throws {ConfigValidationError} When validation fails
     */
    #validate(config: unknown): asserts config is Config {
        if (!this.#isPlainObject(config)) {
            throw new ConfigValidationError("Invalid configuration: Expected the config file to export an object.");
        }

        this.#validateRequiredString(config.sourceLocale, "sourceLocale");
        this.#validateRequiredString(config.localesDir, "localesDir");
        this.#validateRequiredString(config.filePattern, "filePattern");

        if (!this.#isPlainObject(config.provider)) {
            throw new ConfigValidationError('Invalid configuration: Missing required object "provider".');
        }

        // Apply defaults to nested objects before validation
        config.plugin = config.plugin || {};
        config.detection = config.detection || {};

        if (!this.#isPlainObject(config.plugin)) {
            throw new ConfigValidationError('Invalid configuration: Missing required object "plugin".');
        }

        if (!this.#isPlainObject(config.detection)) {
            throw new ConfigValidationError('Invalid configuration: Missing required object "detection".');
        }

        if (!this.#isPlainObject(config.output)) {
            throw new ConfigValidationError('Invalid configuration: Missing required object "output".');
        }

        if (!this.#isPlainObject(config.validation)) {
            throw new ConfigValidationError('Invalid configuration: Missing required object "validation".');
        }

        if (!this.#isPlainObject(config.translation)) {
            throw new ConfigValidationError('Invalid configuration: Missing required object "translation".');
        }

        if (!this.#isPlainObject(config.ci)) {
            throw new ConfigValidationError('Invalid configuration: Missing required object "ci".');
        }

        this.#validateProvider(config.provider);
        this.#validatePlugin(config.plugin);
        this.#validateDetection(config.detection);
        this.#validateOutput(config.output);
        this.#validateValidation(config.validation);
        this.#validateTranslation(config.translation);
        this.#validateCi(config.ci);
    }

    /**
     * Applies defaults and returns the normalized runtime config.
     *
     * @param config - Raw validated config
     * @returns Fully resolved config
     */
    #normalize(config: Config): ResolvedConfig {
        const provider: TranslationProviderConfig = {
            ...config.provider,
            model: config.provider.model || DEFAULT_OPENAI_MODEL,
            temperature: config.provider.temperature ?? DEFAULT_PROVIDER_TEMPERATURE,
        };

        const plugin: PluginConfig = {
            name: config.plugin.name || DEFAULT_PLUGIN_NAME,
        };

        const detection: DetectionConfig = {
            strategy: config.detection.strategy || DEFAULT_DETECTION_STRATEGY,
            snapshotFile: config.detection.snapshotFile,
        };

        const output: OutputConfig = {
            sortKeys: config.output.sortKeys,
            preserveIndentation: config.output.preserveIndentation ?? DEFAULT_JSON_INDENTATION,
            trailingNewline: config.output.trailingNewline,
        };

        const validation: ValidationConfig = {
            preservePlaceholders: config.validation.preservePlaceholders,
            preserveIcuSyntax: config.validation.preserveIcuSyntax,
            preserveHtmlTags: config.validation.preserveHtmlTags,
            failOnExtraKeys: config.validation.failOnExtraKeys,
            failOnMissingKeys: config.validation.failOnMissingKeys,
            failOnModifiedSource: config.validation.failOnModifiedSource,
        };

        const translation: TranslationConfig = {
            batchSize: config.translation.batchSize ?? DEFAULT_TRANSLATION_BATCH_SIZE,
            maxRetries: config.translation.maxRetries ?? DEFAULT_TRANSLATION_MAX_RETRIES,
            concurrency: config.translation.concurrency ?? DEFAULT_TRANSLATION_CONCURRENCY,
            exactLength: config.translation.exactLength,
            contextFile: config.translation.contextFile,
        };

        const ci: CiConfig = {
            mode: config.ci.mode,
            reportFile: config.ci.reportFile || DEFAULT_CI_REPORT_FILE,
            failOnChanges: config.ci.failOnChanges,
            failOnWarnings: config.ci.failOnWarnings,
        };

        return {
            sourceLocale: config.sourceLocale,
            localesDir: config.localesDir,
            filePattern: config.filePattern,
            provider,
            plugin,
            detection,
            output,
            validation,
            translation,
            ci,
        };
    }

    /**
     * Validates the translation provider config.
     *
     * @param provider - Raw provider config
     * @throws {ConfigValidationError} When validation fails
     */
    #validateProvider(provider: Record<string, unknown>): void {
        if (!this.#isSupportedProviderName(provider.name)) {
            throw new ConfigValidationError(`Invalid configuration: Unsupported provider name "${String(provider.name)}".`);
        }

        this.#validateRequiredString(provider.apiKey, "provider.apiKey");

        if (provider.model !== undefined && typeof provider.model !== "string") {
            throw new ConfigValidationError('Invalid configuration: "provider.model" must be a string when provided.');
        }

        if (provider.temperature !== undefined && typeof provider.temperature !== "number") {
            throw new ConfigValidationError('Invalid configuration: "provider.temperature" must be a number when provided.');
        }
    }

    #validatePlugin(plugin: Record<string, unknown>): void {
        // Apply default plugin name before validation
        plugin.name = plugin.name ?? DEFAULT_PLUGIN_NAME;

        if (!this.#isSupportedPluginName(plugin.name)) {
            throw new ConfigValidationError(`Invalid configuration: Unsupported plugin name "${String(plugin.name)}".`);
        }
    }

    #validateDetection(detection: Record<string, unknown>): void {
        // Apply default detection strategy before validation
        detection.strategy = detection.strategy ?? DEFAULT_DETECTION_STRATEGY;

        if (!this.#isSupportedDetectionStrategy(detection.strategy)) {
            throw new ConfigValidationError(
                `Invalid configuration: Unsupported detection strategy "${String(detection.strategy)}".`,
            );
        }

        if (detection.snapshotFile !== undefined && typeof detection.snapshotFile !== "string") {
            throw new ConfigValidationError('Invalid configuration: "detection.snapshotFile" must be a string when provided.');
        }
    }

    /**
     * Validates the output config.
     *
     * @param output - Raw output config
     * @throws {ConfigValidationError} When validation fails
     */
    #validateOutput(output: Record<string, unknown>): void {
        this.#validateRequiredBoolean(output.sortKeys, "output.sortKeys");
        this.#validateRequiredBoolean(output.trailingNewline, "output.trailingNewline");

        if (
            output.preserveIndentation !== undefined &&
            (typeof output.preserveIndentation !== "number" || output.preserveIndentation < 0)
        ) {
            throw new ConfigValidationError(
                'Invalid configuration: "output.preserveIndentation" must be a non-negative number when provided.',
            );
        }
    }

    /**
     * Validates the validation config.
     *
     * @param validation - Raw validation config
     * @throws {ConfigValidationError} When validation fails
     */
    #validateValidation(validation: Record<string, unknown>): void {
        this.#validateRequiredBoolean(validation.preservePlaceholders, "validation.preservePlaceholders");
        this.#validateRequiredBoolean(validation.preserveIcuSyntax, "validation.preserveIcuSyntax");
        this.#validateRequiredBoolean(validation.preserveHtmlTags, "validation.preserveHtmlTags");
        this.#validateRequiredBoolean(validation.failOnExtraKeys, "validation.failOnExtraKeys");
        this.#validateRequiredBoolean(validation.failOnMissingKeys, "validation.failOnMissingKeys");
        this.#validateRequiredBoolean(validation.failOnModifiedSource, "validation.failOnModifiedSource");
    }

    /**
     * Validates the translation config.
     *
     * @param translation - Raw translation config
     * @throws {ConfigValidationError} When validation fails
     */
    #validateTranslation(translation: Record<string, unknown>): void {
        if (
            translation.batchSize !== undefined &&
            (typeof translation.batchSize !== "number" || !Number.isInteger(translation.batchSize) || translation.batchSize <= 0)
        ) {
            throw new ConfigValidationError(
                'Invalid configuration: "translation.batchSize" must be a positive integer when provided.',
            );
        }

        if (
            translation.maxRetries !== undefined &&
            (typeof translation.maxRetries !== "number" ||
                !Number.isInteger(translation.maxRetries) ||
                translation.maxRetries < 0)
        ) {
            throw new ConfigValidationError(
                'Invalid configuration: "translation.maxRetries" must be a non-negative integer when provided.',
            );
        }

        if (
            translation.concurrency !== undefined &&
            (typeof translation.concurrency !== "number" ||
                !Number.isInteger(translation.concurrency) ||
                translation.concurrency <= 0)
        ) {
            throw new ConfigValidationError(
                'Invalid configuration: "translation.concurrency" must be a positive integer when provided.',
            );
        }

        this.#validateRequiredBoolean(translation.exactLength, "translation.exactLength");

        if (translation.contextFile !== undefined && typeof translation.contextFile !== "string") {
            throw new ConfigValidationError('Invalid configuration: "translation.contextFile" must be a string when provided.');
        }
    }

    /**
     * Validates the CI config.
     *
     * @param ci - Raw CI config
     * @throws {ConfigValidationError} When validation fails
     */
    #validateCi(ci: Record<string, unknown>): void {
        this.#validateRequiredBoolean(ci.mode, "ci.mode");
        this.#validateRequiredBoolean(ci.failOnChanges, "ci.failOnChanges");
        this.#validateRequiredBoolean(ci.failOnWarnings, "ci.failOnWarnings");

        if (ci.reportFile !== undefined && typeof ci.reportFile !== "string") {
            throw new ConfigValidationError('Invalid configuration: "ci.reportFile" must be a string when provided.');
        }
    }

    /**
     * Validates that a required property is a non-empty string.
     *
     * @param value - Value to validate
     * @param key - Config key name
     * @throws {ConfigValidationError} When validation fails
     */
    #validateRequiredString(value: unknown, key: string): void {
        if (typeof value !== "string" || !value.trim()) {
            throw new ConfigValidationError(`Invalid configuration: "${key}" must be a non-empty string.`);
        }
    }

    /**
     * Validates that a required property is a boolean.
     *
     * @param value - Value to validate
     * @param key - Config key name
     * @throws {ConfigValidationError} When validation fails
     */
    #validateRequiredBoolean(value: unknown, key: string): void {
        if (typeof value !== "boolean") {
            throw new ConfigValidationError(`Invalid configuration: "${key}" must be a boolean.`);
        }
    }

    /**
     * Returns whether the provided value is a plain object.
     *
     * @param value - Value to test
     * @returns Whether the value is a plain object
     */
    #isPlainObject(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    /**
     * Returns whether the provided value is a supported translation provider name.
     *
     * @param value - Value to test
     * @returns Whether the value is a supported provider name
     */
    #isSupportedProviderName(value: unknown): value is (typeof SUPPORTED_PROVIDER_NAMES)[number] {
        return typeof value === "string" && SUPPORTED_PROVIDER_NAMES.includes(value as (typeof SUPPORTED_PROVIDER_NAMES)[number]);
    }

    /**
     * Returns whether the provided value is a supported plugin name.
     *
     * @param value - Value to test
     * @returns Whether the value is a supported plugin name
     */
    #isSupportedPluginName(value: unknown): value is (typeof SUPPORTED_PLUGIN_NAMES)[number] {
        return typeof value === "string" && SUPPORTED_PLUGIN_NAMES.includes(value as (typeof SUPPORTED_PLUGIN_NAMES)[number]);
    }

    /**
     * Returns whether the provided value is a supported detection strategy.
     *
     * @param value - Value to test
     * @returns Whether the value is a supported detection strategy
     */
    #isSupportedDetectionStrategy(value: unknown): value is (typeof SUPPORTED_DETECTION_STRATEGIES)[number] {
        return (
            typeof value === "string" &&
            SUPPORTED_DETECTION_STRATEGIES.includes(value as (typeof SUPPORTED_DETECTION_STRATEGIES)[number])
        );
    }
}