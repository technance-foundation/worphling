import { OpenAI } from "openai";

import { DEFAULT_OPENAI_MODEL, DEFAULT_PROVIDER_TEMPERATURE } from "../constants.js";
import { EXAMPLE_INPUT, EXAMPLE_NEXT_INTL_INPUT, EXAMPLE_NEXT_INTL_OUTPUT, EXAMPLE_OUTPUT } from "../core/examples.js";
import { ProviderResponseValidationError } from "../errors.js";
import type {
    FlatLocaleFile,
    FlatLocaleFiles,
    PluginName,
    ResolvedConfig,
    TranslationBatch,
    TranslationBatchResult,
    TranslationProviderContract,
} from "../types.js";

/**
 * Translation service backed by OpenAI.
 *
 * This class is responsible only for:
 * - sending translation requests to the configured provider
 * - selecting the appropriate prompt examples for the active plugin
 * - validating and parsing the provider response
 *
 * It does not perform filesystem operations or diff calculation.
 */
export class OpenAiTranslationProvider implements TranslationProviderContract {
    /**
     * OpenAI client instance used for translation requests.
     */
    #client: OpenAI;

    /**
     * Fully resolved runtime configuration.
     */
    #config: ResolvedConfig;

    /**
     * Stable provider identifier.
     */
    readonly name = "openai" as const;

    /**
     * Creates a new translator instance.
     *
     * @param config - Fully resolved runtime configuration
     */
    constructor(config: ResolvedConfig) {
        this.#config = config;
        this.#client = new OpenAI({
            apiKey: config.provider.apiKey,
        });
    }

    /**
     * Translates a single batch for one locale.
     *
     * This method satisfies the `TranslationProviderContract`.
     *
     * @param batch - Translation batch
     * @param config - Optional resolved runtime config override
     * @returns Translated batch result
     */
    async translate(batch: TranslationBatch, config?: ResolvedConfig): Promise<TranslationBatchResult> {
        const runtimeConfig = config || this.#config;
        const responseText = await this.#fetchBatchTranslations(batch, runtimeConfig);
        const entries = this.#parseBatchTranslations(responseText, batch);

        return {
            locale: batch.locale,
            entries,
        };
    }

    /**
     * Translates multiple locales in the current app-oriented shape.
     *
     * @param keysToTranslate - Flat translation entries grouped by locale
     * @returns Translated flat locale entries grouped by locale
     */
    async translateAll(keysToTranslate: FlatLocaleFiles): Promise<FlatLocaleFiles> {
        const result: FlatLocaleFiles = {};

        for (const [locale, entries] of Object.entries(keysToTranslate)) {
            const batch: TranslationBatch = {
                locale,
                entries: Object.entries(entries).map(([key, source]) => ({
                    key,
                    source,
                })),
            };

            const translatedBatch = await this.translate(batch, this.#config);
            result[locale] = translatedBatch.entries;
        }

        return result;
    }

    /**
     * Sends a single translation batch to OpenAI and returns the raw JSON
     * response text.
     *
     * @param batch - Translation batch
     * @param config - Resolved runtime configuration
     * @returns Raw JSON response text
     */
    async #fetchBatchTranslations(batch: TranslationBatch, config: ResolvedConfig): Promise<string> {
        const pluginName = config.plugin.name;
        const exactLength = config.translation.exactLength;
        const model = config.provider.model || DEFAULT_OPENAI_MODEL;
        const temperature = config.provider.temperature ?? DEFAULT_PROVIDER_TEMPERATURE;
        const contextInstructions = this.#readContextInstructions();
        const payload = this.#buildBatchPayload(batch);

        const response = await this.#client.chat.completions.create({
            model,
            response_format: {
                type: "json_object",
            },
            messages: [
                {
                    role: "system",
                    content: this.#buildSystemPrompt(pluginName, exactLength, contextInstructions),
                },
                {
                    role: "user",
                    content: JSON.stringify(payload, null, 2),
                },
            ],
            temperature,
        });

        const content = response.choices[0]?.message?.content;

        return content || "{}";
    }

    /**
     * Builds the provider payload for a single translation batch.
     *
     * The payload shape matches the examples and keeps the target locale at the
     * top level.
     *
     * @param batch - Translation batch
     * @returns Provider payload
     */
    #buildBatchPayload(batch: TranslationBatch): FlatLocaleFiles {
        const localeEntries: FlatLocaleFile = {};

        for (const entry of batch.entries) {
            localeEntries[entry.key] = entry.source;
        }

        return {
            [batch.locale]: localeEntries,
        };
    }

    /**
     * Parses and validates the provider response for a single batch.
     *
     * @param responseText - Raw response text returned by the provider
     * @param batch - Original translation batch
     * @returns Parsed translated entries
     * @throws {ProviderResponseValidationError} When the response is not valid JSON
     */
    #parseBatchTranslations(responseText: string, batch: TranslationBatch): FlatLocaleFile {
        try {
            const parsedResponse = JSON.parse(responseText) as Record<string, unknown>;
            const localeEntries = parsedResponse[batch.locale];

            if (!this.#isFlatLocaleFile(localeEntries)) {
                return {};
            }

            const result: FlatLocaleFile = {};

            for (const entry of batch.entries) {
                result[entry.key] = localeEntries[entry.key] || "";
            }

            return result;
        } catch (error) {
            throw new ProviderResponseValidationError(
                `Translation response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Builds the system prompt used for translation generation.
     *
     * @param pluginName - Active plugin name
     * @param exactLength - Whether exact-length guidance is enabled
     * @param contextInstructions - Optional extra translation instructions
     * @returns System prompt
     */
    #buildSystemPrompt(pluginName: PluginName, exactLength: boolean, contextInstructions?: string): string {
        const isNextIntlPluginEnabled = pluginName === "next-intl";
        const exampleInput = isNextIntlPluginEnabled ? EXAMPLE_NEXT_INTL_INPUT : EXAMPLE_INPUT;
        const exampleOutput = isNextIntlPluginEnabled ? EXAMPLE_NEXT_INTL_OUTPUT : EXAMPLE_OUTPUT;

        return [
            "You are a translation assistant.",
            "Translate the provided keys and texts into their specified target languages.",
            "Always respond with valid JSON matching the input structure exactly.",
            "Do not wrap the response in a ```json code block.",
            "Preserve placeholders, ICU syntax, and tags whenever present.",
            exactLength ? "Translated responses must not exceed the length of their input." : undefined,
            contextInstructions ? `Additional translation instructions:\n${contextInstructions}` : undefined,
            `Example input: ${exampleInput}`,
            `Example output: ${exampleOutput}`,
        ]
            .filter(Boolean)
            .join("\n\n");
    }

    /**
     * Reads optional translation context instructions.
     *
     * The current implementation intentionally returns `undefined` until the
     * context-file loading layer is introduced.
     *
     * @returns Optional context instructions
     */
    #readContextInstructions(): string | undefined {
        return undefined;
    }

    /**
     * Returns whether the provided value is a flat locale file.
     *
     * @param value - Value to test
     * @returns Whether the value is a flat locale file
     */
    #isFlatLocaleFile(value: unknown): value is Record<string, string> {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return false;
        }

        return Object.values(value).every((entryValue) => typeof entryValue === "string");
    }
}
