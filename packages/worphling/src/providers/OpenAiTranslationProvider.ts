import { OpenAI } from "openai";

import { DEFAULT_OPENAI_MODEL, DEFAULT_PROVIDER_TEMPERATURE } from "../constants.js";
import { ProviderResponseValidationError } from "../errors.js";
import type {
    FlatLocaleFile,
    ResolvedConfig,
    TranslationBatch,
    TranslationBatchResult,
    TranslationPluginContract,
    TranslationProviderContract,
} from "../types.js";

/**
 * Translation service backed by OpenAI.
 *
 * This class is responsible only for:
 * - sending translation requests to the configured provider
 * - using plugin-supplied prompt context
 * - validating and parsing the provider response
 *
 * It does not perform filesystem operations, diff calculation, batching,
 * retries, or concurrency orchestration.
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
     * Active translation plugin.
     */
    #plugin: TranslationPluginContract;

    /**
     * Optional preloaded translation context instructions.
     */
    #contextInstructions?: string;

    /**
     * Stable provider identifier.
     */
    readonly name = "openai" as const;

    /**
     * Creates a new translator instance.
     *
     * @param config - Fully resolved runtime configuration
     * @param plugin - Active translation plugin
     * @param contextInstructions - Optional preloaded translation context instructions
     */
    constructor(config: ResolvedConfig, plugin: TranslationPluginContract, contextInstructions?: string) {
        this.#config = config;
        this.#plugin = plugin;
        this.#contextInstructions = contextInstructions;
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
     * Sends a single translation batch to OpenAI and returns the raw JSON
     * response text.
     *
     * @param batch - Translation batch
     * @param config - Resolved runtime configuration
     * @returns Raw JSON response text
     */
    async #fetchBatchTranslations(batch: TranslationBatch, config: ResolvedConfig): Promise<string> {
        const exactLength = config.translation.exactLength;
        const model = config.provider.model || DEFAULT_OPENAI_MODEL;
        const temperature = config.provider.temperature ?? DEFAULT_PROVIDER_TEMPERATURE;
        const payload = this.#buildBatchPayload(batch);

        const response = await this.#client.chat.completions.create({
            model,
            response_format: {
                type: "json_object",
            },
            messages: [
                {
                    role: "system",
                    content: this.#buildSystemPrompt(exactLength, this.#contextInstructions),
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
     * The payload shape keeps the target locale at the top level.
     *
     * @param batch - Translation batch
     * @returns Provider payload
     */
    #buildBatchPayload(batch: TranslationBatch): Record<string, FlatLocaleFile> {
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
     * Worphling treats ICU as the default message model. Plugins only add
     * framework-specific instructions on top of that baseline.
     *
     * @param exactLength - Whether exact-length guidance is enabled
     * @param contextInstructions - Optional extra translation instructions
     * @returns System prompt
     */
    #buildSystemPrompt(exactLength: boolean, contextInstructions?: string): string {
        const promptContext = this.#plugin.getPromptContext();

        return [
            "You are a translation assistant.",
            "The project uses ICU message syntax as the default translation format.",
            "Translate the provided keys and texts into their specified target languages.",
            "Always respond with valid JSON matching the input structure exactly.",
            "Do not wrap the response in a ```json code block.",
            "Do not add, remove, rename, reorder, or restructure keys.",
            "Preserve ICU message structure exactly when present.",
            "Preserve ICU argument names exactly.",
            "Preserve plural, select, and selectordinal branch keys exactly, including required branches such as `other` and exact-match selectors such as `=0`.",
            "Preserve placeholders exactly when present.",
            "Preserve HTML-like or rich-text tags exactly when present.",
            "Preserve escaping semantics exactly, including single-quote escaping used for literal ICU characters such as `{` and `}`.",
            ...promptContext.additionalInstructions,
            exactLength
                ? "Translated responses should not exceed the length of their input when reasonably possible."
                : undefined,
            contextInstructions ? `Additional translation instructions:\n${contextInstructions}` : undefined,
            `Example input: ${promptContext.exampleInput}`,
            `Example output: ${promptContext.exampleOutput}`,
        ]
            .filter(Boolean)
            .join("\n\n");
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
