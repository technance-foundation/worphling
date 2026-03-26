import { EXAMPLE_NEXT_INTL_INPUT, EXAMPLE_NEXT_INTL_OUTPUT } from "../core/examples.js";
import type { TranslationPluginContract, TranslationPluginPromptContext, ValidationConfig } from "../types.js";

/**
 * Translation plugin for `next-intl` message syntax.
 *
 * This plugin makes `next-intl` meaningful at runtime by:
 * - supplying plugin-specific prompt instructions and examples
 * - forcing syntax-preservation validation for placeholders, ICU, and tags
 */
export class NextIntlTranslationPlugin implements TranslationPluginContract {
    /**
     * Stable plugin identifier.
     */
    readonly name = "next-intl" as const;

    /**
     * Returns prompt context for translation providers.
     *
     * @returns Plugin prompt context
     */
    getPromptContext(): TranslationPluginPromptContext {
        return {
            additionalInstructions: [
                "The project uses next-intl message syntax.",
                "Preserve all ICU message constructs exactly, including plural, select, and selectordinal branches.",
                "Preserve all rich-text tag structures such as <bold>{name}</bold> exactly.",
                "Preserve interpolation placeholders exactly.",
            ],
            exampleInput: EXAMPLE_NEXT_INTL_INPUT,
            exampleOutput: EXAMPLE_NEXT_INTL_OUTPUT,
        };
    }

    /**
     * Resolves effective validation config for the plugin.
     *
     * `next-intl` always requires placeholder, ICU, and tag preservation.
     *
     * @param config - Base validation config
     * @returns Effective validation config
     */
    resolveValidationConfig(config: ValidationConfig): ValidationConfig {
        return {
            ...config,
            preservePlaceholders: true,
            preserveIcuSyntax: true,
            preserveHtmlTags: true,
        };
    }
}
