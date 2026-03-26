import { UnsupportedProviderError } from "../errors.js";
import type { ResolvedConfig, TranslationPluginContract, TranslationProviderContract } from "../types.js";

import { OpenAiTranslationProvider } from "./OpenAiTranslationProvider.js";

/**
 * Resolves translation providers from stable provider identifiers.
 */
export class TranslationProviderFactory {
    /**
     * Creates the configured translation provider.
     *
     * @param config - Fully resolved runtime configuration
     * @param plugin - Active translation plugin
     * @returns Translation provider
     * @throws {UnsupportedProviderError} When the provider is not supported
     */
    create(config: ResolvedConfig, plugin: TranslationPluginContract): TranslationProviderContract {
        if (config.provider.name === "openai") {
            return new OpenAiTranslationProvider(config, plugin);
        }

        throw new UnsupportedProviderError(config.provider.name);
    }
}
