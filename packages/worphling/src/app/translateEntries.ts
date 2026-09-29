import {
    DEFAULT_JSON_INDENTATION,
    DEFAULT_OPENAI_MODEL,
    DEFAULT_PROVIDER_TEMPERATURE,
    DEFAULT_TRANSLATION_BATCH_SIZE,
    DEFAULT_TRANSLATION_CONCURRENCY,
    DEFAULT_TRANSLATION_MAX_RETRIES,
} from "../constants.js";
import { TranslationPluginRegistry, ValidationEngine } from "../domain/index.js";
import { ConfigValidationError, TranslationProviderExecutionError } from "../errors.js";
import { SilentLogger } from "../infrastructure/index.js";
import { TranslationProviderFactory } from "../providers/index.js";
import type {
    FlatLocaleFile,
    LocaleIssue,
    Logger,
    PluginName,
    ResolvedConfig,
    TranslationConfig,
    TranslationProviderConfig,
    TranslationProviderContract,
    ValidationConfig,
} from "../types.js";

import { TranslationExecutor } from "./TranslationExecutor.js";

/**
 * Input accepted by `translateEntries`.
 */
export interface TranslateEntriesInput {
    /**
     * Provider config (for example `{ name: "openai", apiKey }`), or a ready
     * provider instance implementing `TranslationProviderContract`.
     */
    provider: TranslationProviderConfig | TranslationProviderContract;

    /**
     * Translation plugin controlling prompt guidance and validation overrides.
     */
    plugin: PluginName;

    /**
     * Locale the source entries are written in.
     */
    sourceLocale: string;

    /**
     * Locale to translate the entries into.
     */
    targetLocale: string;

    /**
     * Flat map of translation key to ICU source message.
     */
    entries: FlatLocaleFile;

    /**
     * Optional translation instructions such as tone, glossary, or domain
     * terminology. Only applied when `provider` is a provider config.
     */
    context?: string;

    /**
     * Optional validation overrides applied on top of the strict defaults.
     */
    validation?: Partial<ValidationConfig>;

    /**
     * Optional batching, retry, concurrency, and length overrides.
     */
    translation?: Partial<Pick<TranslationConfig, "batchSize" | "maxRetries" | "concurrency" | "exactLength">>;

    /**
     * Optional logger for runtime diagnostics. Defaults to a silent logger.
     */
    logger?: Logger;
}

/**
 * Result returned by `translateEntries`.
 */
export interface TranslateEntriesResult {
    /**
     * Translated messages keyed by source key.
     *
     * Entries that failed validation are still included; the matching
     * `issues` describe what is wrong with them. Keys the provider did not
     * translate are left out and reported as `missing`.
     */
    translations: FlatLocaleFile;

    /**
     * Validation and provider issues for the target locale.
     */
    issues: Array<LocaleIssue>;
}

/**
 * Validation defaults for programmatic translation.
 *
 * Every structural check is enabled and untranslated keys are errors, since
 * the caller has no follow-up run to catch them.
 */
const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
    preservePlaceholders: true,
    preserveIcuSyntax: true,
    preserveHtmlTags: true,
    failOnExtraKeys: false,
    failOnMissingKeys: true,
    failOnModifiedSource: false,
};

/**
 * Translates a flat map of ICU messages with the same provider prompt,
 * batching, retries, and validation the CLI uses, without touching the
 * filesystem.
 *
 * Validation problems and provider failures are returned as `issues` instead
 * of being thrown. Invalid input still throws.
 *
 * @param input - Entries, locales, provider, and optional overrides
 * @returns Translated entries and the issues found while producing them
 * @throws {ConfigValidationError} When locales or translation overrides are invalid
 * @throws {UnsupportedPluginError} When the plugin is not supported
 * @throws {UnsupportedProviderError} When the provider config is not supported
 */
export async function translateEntries(input: TranslateEntriesInput): Promise<TranslateEntriesResult> {
    const config = resolveConfig(input);

    if (Object.keys(input.entries).length === 0) {
        return { translations: {}, issues: [] };
    }

    const logger = input.logger || new SilentLogger();
    const plugin = new TranslationPluginRegistry().resolve(config.plugin.name);
    const provider = isTranslationProvider(input.provider)
        ? input.provider
        : new TranslationProviderFactory().create(config, plugin, logger);
    const executor = new TranslationExecutor(provider, config.translation, config, logger);

    let translatedEntries: FlatLocaleFile = {};
    let providerIssues: Array<LocaleIssue> = [];

    try {
        const translatedLocales = await executor.execute([
            { type: "translate-missing", locale: input.targetLocale, entries: input.entries },
        ]);

        translatedEntries = translatedLocales[input.targetLocale] || {};
    } catch (error) {
        if (!(error instanceof TranslationProviderExecutionError)) {
            throw error;
        }

        providerIssues = [
            {
                type: "provider-error",
                severity: "error",
                locale: input.targetLocale,
                key: "translation-execution",
                message: error.message,
            },
        ];
    }

    const { translations, missing } = partitionTranslations(input.entries, translatedEntries);
    const issues = [
        ...new ValidationEngine(plugin).validate({
            sourceLocaleFile: input.entries,
            targetLocaleFiles: { [input.targetLocale]: translations },
            diffResult: {
                missing: Object.keys(missing).length > 0 ? { [input.targetLocale]: missing } : {},
                extra: {},
                modified: {},
            },
            validationConfig: config.validation,
        }),
        ...providerIssues,
    ];

    return { translations, issues };
}

/**
 * Builds the runtime config the executor and provider expect.
 *
 * File-layer fields (`localesDir`, `filePattern`, `snapshot`, `output`,
 * `runtime`) are required by `ResolvedConfig` but unused here, so they hold
 * inert placeholders.
 *
 * @param input - Programmatic translation input
 * @returns Resolved runtime config
 * @throws {ConfigValidationError} When locales or translation overrides are invalid
 */
function resolveConfig(input: TranslateEntriesInput): ResolvedConfig {
    assertLocale(input.sourceLocale, "sourceLocale");
    assertLocale(input.targetLocale, "targetLocale");

    if (input.sourceLocale === input.targetLocale) {
        throw new ConfigValidationError('Invalid input: "sourceLocale" and "targetLocale" must differ.');
    }

    const translation: TranslationConfig = {
        batchSize: input.translation?.batchSize ?? DEFAULT_TRANSLATION_BATCH_SIZE,
        maxRetries: input.translation?.maxRetries ?? DEFAULT_TRANSLATION_MAX_RETRIES,
        concurrency: input.translation?.concurrency ?? DEFAULT_TRANSLATION_CONCURRENCY,
        exactLength: input.translation?.exactLength ?? false,
        context: input.context,
    };

    assertInteger(translation.batchSize, "translation.batchSize", 1);
    assertInteger(translation.maxRetries, "translation.maxRetries", 0);
    assertInteger(translation.concurrency, "translation.concurrency", 1);

    const provider: TranslationProviderConfig = isTranslationProvider(input.provider)
        ? { name: input.provider.name, apiKey: "" }
        : {
              ...input.provider,
              model: input.provider.model || DEFAULT_OPENAI_MODEL,
              temperature: input.provider.temperature ?? DEFAULT_PROVIDER_TEMPERATURE,
          };

    return {
        sourceLocale: input.sourceLocale,
        localesDir: "",
        filePattern: "",
        provider,
        plugin: { name: input.plugin },
        snapshot: { file: "" },
        output: { sortKeys: false, preserveIndentation: DEFAULT_JSON_INDENTATION, trailingNewline: false },
        validation: { ...DEFAULT_VALIDATION_CONFIG, ...input.validation },
        translation,
        runtime: { failOnChanges: false, failOnWarnings: false },
    };
}

/**
 * Splits provider output into usable translations and untranslated sources.
 *
 * Only requested keys are kept. An empty translation for a non-empty source
 * counts as untranslated, since the provider fills omitted keys with `""`.
 *
 * @param sourceEntries - Requested source entries
 * @param translatedEntries - Entries returned by the executor
 * @returns Usable translations and the source entries left untranslated
 */
function partitionTranslations(
    sourceEntries: FlatLocaleFile,
    translatedEntries: FlatLocaleFile,
): { translations: FlatLocaleFile; missing: FlatLocaleFile } {
    const translations: FlatLocaleFile = {};
    const missing: FlatLocaleFile = {};

    for (const [key, sourceValue] of Object.entries(sourceEntries)) {
        const translatedValue = translatedEntries[key];

        if (typeof translatedValue !== "string" || (translatedValue === "" && sourceValue !== "")) {
            missing[key] = sourceValue;
            continue;
        }

        translations[key] = translatedValue;
    }

    return { translations, missing };
}

/**
 * Returns whether the provider input is a ready provider instance rather than
 * a provider config.
 *
 * @param provider - Provider config or instance
 * @returns Whether the value implements `TranslationProviderContract`
 */
function isTranslationProvider(
    provider: TranslationProviderConfig | TranslationProviderContract,
): provider is TranslationProviderContract {
    return typeof (provider as TranslationProviderContract).translate === "function";
}

/**
 * Asserts that a locale identifier is a non-empty string.
 *
 * @param value - Locale value
 * @param fieldName - Input field name used in the error message
 * @throws {ConfigValidationError} When the locale is empty
 */
function assertLocale(value: unknown, fieldName: string): void {
    if (typeof value !== "string" || value.trim() === "") {
        throw new ConfigValidationError(`Invalid input: "${fieldName}" must be a non-empty string.`);
    }
}

/**
 * Asserts that a numeric override is an integer at or above a minimum.
 *
 * @param value - Numeric value
 * @param fieldName - Input field name used in the error message
 * @param minimum - Smallest allowed value
 * @throws {ConfigValidationError} When the value is not an allowed integer
 */
function assertInteger(value: number, fieldName: string, minimum: number): void {
    if (!Number.isInteger(value) || value < minimum) {
        const expectation = minimum === 0 ? "a non-negative integer" : "a positive integer";

        throw new ConfigValidationError(`Invalid input: "${fieldName}" must be ${expectation}.`);
    }
}
