import { merge } from "lodash-es";

import type { FlatLocaleFile, FlatLocaleFiles, LocaleFile, LocaleFiles } from "../types.js";

import { LocaleStructure } from "./LocaleStructure.js";

/**
 * Calculates locale diffs and applies structural translation updates.
 *
 * Responsibilities include:
 * - detecting missing translation keys in target locales
 * - detecting modified source keys using stored snapshots
 * - detecting and removing extra target keys not present in the source locale
 * - merging translated keys back into target locale files
 */
export class LocaleDiffCalculator {
    /**
     * Locale structure helper used for flattening and unflattening locale data.
     */
    #localeStructure: LocaleStructure;

    /**
     * Creates a new locale diff calculator.
     *
     * @param localeStructure - Optional locale structure helper
     */
    constructor(localeStructure?: LocaleStructure) {
        this.#localeStructure = localeStructure || new LocaleStructure();
    }

    /**
     * Finds missing translation keys for each target locale relative to the
     * source locale.
     *
     * @param source - Source locale file
     * @param targets - Target locale files
     * @returns Missing keys grouped by locale
     */
    findMissingKeys(source: LocaleFile, targets: LocaleFiles): FlatLocaleFiles {
        const result: FlatLocaleFiles = {};
        const flatSource = this.#localeStructure.flatten(source);

        for (const [locale, target] of Object.entries(targets)) {
            const flatTarget = this.#localeStructure.flatten(target);
            const missingEntries: FlatLocaleFile = {};

            for (const [key, value] of Object.entries(flatSource)) {
                if (!(key in flatTarget)) {
                    missingEntries[key] = value;
                }
            }

            if (Object.keys(missingEntries).length > 0) {
                result[locale] = missingEntries;
            }
        }

        return result;
    }

    /**
     * Finds extra translation keys for each target locale relative to the
     * source locale.
     *
     * @param source - Source locale file
     * @param targets - Target locale files
     * @returns Extra keys grouped by locale
     */
    findExtraKeys(source: LocaleFile, targets: LocaleFiles): FlatLocaleFiles {
        const result: FlatLocaleFiles = {};
        const flatSource = this.#localeStructure.flatten(source);

        for (const [locale, target] of Object.entries(targets)) {
            const flatTarget = this.#localeStructure.flatten(target);
            const extraEntries: FlatLocaleFile = {};

            for (const [key, value] of Object.entries(flatTarget)) {
                if (!(key in flatSource)) {
                    extraEntries[key] = value;
                }
            }

            if (Object.keys(extraEntries).length > 0) {
                result[locale] = extraEntries;
            }
        }

        return result;
    }

    /**
     * Finds source keys whose values have changed relative to a stored snapshot.
     *
     * @param currentSource - Current source locale file
     * @param snapshot - Flattened source snapshot entries
     * @returns Modified source keys
     */
    findModifiedKeys(currentSource: LocaleFile, snapshot: Record<string, string> | null): FlatLocaleFile {
        if (!snapshot) {
            return {};
        }

        const result: FlatLocaleFile = {};
        const flatCurrentSource = this.#localeStructure.flatten(currentSource);

        for (const [key, value] of Object.entries(flatCurrentSource)) {
            if (key in snapshot && snapshot[key] !== value) {
                result[key] = value;
            }
        }

        return result;
    }

    /**
     * Returns all source keys as a flat dot-notated dictionary.
     *
     * @param source - Source locale file
     * @returns Flattened source entries
     */
    getAllSourceKeys(source: LocaleFile): FlatLocaleFile {
        return this.#localeStructure.flatten(source);
    }

    /**
     * Removes the provided extra keys from a target locale.
     *
     * The original target locale object is not mutated.
     *
     * @param target - Target locale file
     * @param extraKeys - Extra flat keys to remove
     * @returns Cleaned target locale file
     */
    removeExtraKeys(target: LocaleFile, extraKeys: FlatLocaleFile): LocaleFile {
        if (!Object.keys(extraKeys).length) {
            return target;
        }

        const flatTarget = this.#localeStructure.flatten(target);
        const filteredFlatTarget: FlatLocaleFile = {};

        for (const [key, value] of Object.entries(flatTarget)) {
            if (!(key in extraKeys)) {
                filteredFlatTarget[key] = value;
            }
        }

        return this.#localeStructure.unflatten(filteredFlatTarget);
    }

    /**
     * Removes all extra keys from target locales that do not exist in the
     * source locale.
     *
     * The original target locale objects are not mutated.
     *
     * @param source - Source locale file
     * @param targets - Target locale files
     * @returns Cleaned target locale files
     */
    removeAllExtraKeys(source: LocaleFile, targets: LocaleFiles): LocaleFiles {
        const extraKeysByLocale = this.findExtraKeys(source, targets);
        const cleanedTargets: LocaleFiles = {};

        for (const [locale, target] of Object.entries(targets)) {
            const extraKeys = extraKeysByLocale[locale] || {};
            cleanedTargets[locale] = this.removeExtraKeys(target, extraKeys);
        }

        return cleanedTargets;
    }

    /**
     * Merges translated flat keys back into the provided target locale files.
     *
     * @param targetLocales - Existing target locale files
     * @param translatedKeys - Newly translated flat keys grouped by locale
     * @returns Updated target locale files
     */
    updateTargetLocales(targetLocales: LocaleFiles, translatedKeys: FlatLocaleFiles): LocaleFiles {
        const updatedLocales: LocaleFiles = { ...targetLocales };

        for (const [locale, flatTranslatedKeys] of Object.entries(translatedKeys)) {
            const targetLocale = updatedLocales[locale] || {};
            updatedLocales[locale] = this.#updateTargetLocale(targetLocale, flatTranslatedKeys);
        }

        return updatedLocales;
    }

    /**
     * Merges translated flat keys into a target locale.
     *
     * @param targetLocale - Existing target locale
     * @param translatedKeys - Flat translated keys
     * @returns Updated target locale
     */
    #updateTargetLocale(targetLocale: LocaleFile, translatedKeys: FlatLocaleFile): LocaleFile {
        const unflattenedTranslatedKeys = this.#localeStructure.unflatten(translatedKeys);

        return merge({}, targetLocale, unflattenedTranslatedKeys) as LocaleFile;
    }
}
