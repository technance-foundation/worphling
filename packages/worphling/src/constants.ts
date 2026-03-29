import type OpenAI from "openai";

/**
 * Supported config file extensions, checked in declaration order.
 */
export const CONFIG_FILE_EXTENSIONS = [".mjs", ".js"] as const;

/**
 * Supported translation provider names.
 *
 * This constant is the source of truth for provider names.
 */
export const SUPPORTED_PROVIDER_NAMES = ["openai"] as const;

/**
 * Supported plugin names.
 */
export const SUPPORTED_PLUGIN_NAMES = ["next-intl", "none"] as const;

/**
 * Supported serialized report formats.
 */
export const SUPPORTED_REPORT_FORMATS = ["json", "markdown"] as const;

/**
 * Derived literal union types from supported constants.
 *
 * These ensure runtime values and type system stay perfectly aligned.
 */
export type SupportedProviderName = (typeof SUPPORTED_PROVIDER_NAMES)[number];
export type SupportedPluginName = (typeof SUPPORTED_PLUGIN_NAMES)[number];
export type SupportedReportFormat = (typeof SUPPORTED_REPORT_FORMATS)[number];

/**
 * Default OpenAI model used when none is configured explicitly.
 */
export const DEFAULT_OPENAI_MODEL: OpenAI.ChatModel = "gpt-5.1-2025-11-13";

/**
 * Default JSON indentation used when writing locale files.
 */
export const DEFAULT_JSON_INDENTATION = 4;

/**
 * Default translation batch size.
 */
export const DEFAULT_TRANSLATION_BATCH_SIZE = 100;

/**
 * Default translation retry count.
 */
export const DEFAULT_TRANSLATION_MAX_RETRIES = 3;

/**
 * Default translation batch concurrency.
 */
export const DEFAULT_TRANSLATION_CONCURRENCY = 2;

/**
 * Default plugin name.
 */
export const DEFAULT_PLUGIN_NAME: SupportedPluginName = "none";

/**
 * Default translation provider temperature.
 */
export const DEFAULT_PROVIDER_TEMPERATURE = 0;
