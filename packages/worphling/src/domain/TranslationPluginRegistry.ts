import { UnsupportedPluginError } from "../errors.js";
import type { PluginName, TranslationPluginContract } from "../types.js";

import { NextIntlTranslationPlugin } from "./NextIntlTranslationPlugin.js";
import { NoOpTranslationPlugin } from "./NoOpTranslationPlugin.js";

/**
 * Resolves translation plugins from stable plugin identifiers.
 */
export class TranslationPluginRegistry {
    /**
     * Resolves the active translation plugin.
     *
     * @param pluginName - Requested plugin name
     * @returns Translation plugin
     * @throws {UnsupportedPluginError} When the plugin is not supported
     */
    resolve(pluginName: PluginName): TranslationPluginContract {
        if (pluginName === "next-intl") {
            return new NextIntlTranslationPlugin();
        }

        if (pluginName === "none") {
            return new NoOpTranslationPlugin();
        }

        throw new UnsupportedPluginError(pluginName);
    }
}
