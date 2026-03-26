import { UnsupportedProviderError } from "../errors.js";
import { TranslationContextRepository } from "../infrastructure/index.js";
import type { Logger, ResolvedConfig, TranslationPluginContract, TranslationProviderContract } from "../types.js";

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
     * @param logger - Shared runtime logger
     * @returns Translation provider
     * @throws {UnsupportedProviderError} When the provider is not supported
     */
    create(config: ResolvedConfig, plugin: TranslationPluginContract, logger: Logger): TranslationProviderContract {
        const contextInstructions = new TranslationContextRepository().read(config.translation.contextFile);

        if (config.provider.name === "openai") {
            return new OpenAiTranslationProvider(config, plugin, logger, contextInstructions);
        }

        throw new UnsupportedProviderError(config.provider.name);
    }
}
