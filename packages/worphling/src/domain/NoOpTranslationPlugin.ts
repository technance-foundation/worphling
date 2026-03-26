import { EXAMPLE_INPUT, EXAMPLE_OUTPUT } from "../core/examples.js";
import type { TranslationPluginContract, TranslationPluginPromptContext, ValidationConfig } from "../types.js";

/**
 * Default translation plugin with no framework-specific runtime behavior.
 */
export class NoOpTranslationPlugin implements TranslationPluginContract {
    /**
     * Stable plugin identifier.
     */
    readonly name = "none" as const;

    /**
     * Returns prompt context for translation providers.
     *
     * @returns Plugin prompt context
     */
    getPromptContext(): TranslationPluginPromptContext {
        return {
            additionalInstructions: [],
            exampleInput: EXAMPLE_INPUT,
            exampleOutput: EXAMPLE_OUTPUT,
        };
    }

    /**
     * Resolves effective validation config for the plugin.
     *
     * @param config - Base validation config
     * @returns Effective validation config
     */
    resolveValidationConfig(config: ValidationConfig): ValidationConfig {
        return config;
    }
}
