import { EXAMPLE_INPUT, EXAMPLE_OUTPUT } from "../examples.js";
import type { TranslationPluginContract, TranslationPluginPromptContext, ValidationConfig } from "../types.js";

/**
 * Default translation plugin for plain ICU-based workflows without
 * framework-specific conventions.
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
     * Returns framework-specific validation overrides.
     *
     * The default plugin does not strengthen validation beyond the core ICU
     * behavior configured by the user.
     *
     * @returns Empty validation overrides
     */
    getValidationOverrides(): Partial<ValidationConfig> {
        return {};
    }
}
