import { EXAMPLE_NEXT_INTL_INPUT, EXAMPLE_NEXT_INTL_OUTPUT } from "../core/examples.js";
import type { TranslationPluginContract, TranslationPluginPromptContext, ValidationConfig } from "../types.js";

/**
 * Translation plugin for `next-intl` integration.
 *
 * `next-intl` uses ICU messages and rich-text tag conventions. ICU itself is a
 * core Worphling concern, while this plugin adds next-intl-specific prompt
 * guidance and validation strengthening for rich-text tags.
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
                "The project uses next-intl on top of ICU message syntax.",
                "Preserve rich-text tag structures such as <bold>{name}</bold> exactly.",
                "Do not rename, reorder, remove, or invent rich-text tags.",
            ],
            exampleInput: EXAMPLE_NEXT_INTL_INPUT,
            exampleOutput: EXAMPLE_NEXT_INTL_OUTPUT,
        };
    }

    /**
     * Returns framework-specific validation overrides.
     *
     * `next-intl` relies on rich-text tag preservation, so tag validation is
     * always enforced for this integration.
     *
     * @returns Validation overrides for next-intl
     */
    getValidationOverrides(): Partial<ValidationConfig> {
        return {
            preserveHtmlTags: true,
        };
    }
}
