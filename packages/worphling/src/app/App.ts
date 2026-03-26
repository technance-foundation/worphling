import { omit } from "lodash-es";

import { ANSI_COLORS } from "../constants.js";
import { LocaleDiffCalculator, LocaleStructure } from "../domain/index.js";
import { JsonLocaleRepository, SnapshotRepository } from "../infrastructure/index.js";
import { Translator } from "../providers/index.js";
import type { AppConfig, FlatLocaleFiles, LocaleFile, LocaleFiles } from "../types.js";
import { ExitCode } from "../types.js";

/**
 * Main Worphling application runtime.
 *
 * This class orchestrates:
 * - reading locale files
 * - identifying source and target locales
 * - detecting missing and modified keys
 * - invoking the translation provider when needed
 * - writing updated locale files
 */
export class App {
    /**
     * Runtime configuration and CLI flags for the current invocation.
     */
    #config: AppConfig;

    /**
     * Locale file repository used for filesystem access.
     */
    #localeRepository: JsonLocaleRepository;

    /**
     * Snapshot repository used for source snapshot persistence.
     */
    #snapshotRepository: SnapshotRepository;

    /**
     * Locale diff calculator used for diffing and merging locale state.
     */
    #localeDiffCalculator: LocaleDiffCalculator;

    /**
     * Creates a new Worphling runtime application.
     *
     * @param config - Runtime config and CLI flags
     */
    constructor(config: AppConfig) {
        const localeStructure = new LocaleStructure();

        this.#config = config;
        this.#localeRepository = new JsonLocaleRepository(config.config.localesDir, config.config.output);
        this.#snapshotRepository = new SnapshotRepository(localeStructure);
        this.#localeDiffCalculator = new LocaleDiffCalculator(localeStructure);
    }

    /**
     * Executes the application.
     *
     * @returns Process exit code
     */
    async run(): Promise<ExitCode> {
        const runtimeConfig = this.#config.config;
        const flags = this.#config.flags;

        const allLocaleFiles = this.#localeRepository.readAll();
        const sourceLocale = runtimeConfig.sourceLocale;
        const sourceLocaleFile = allLocaleFiles[sourceLocale];

        if (!sourceLocaleFile) {
            throw new Error(`Source locale "${sourceLocale}" was not found in "${runtimeConfig.localesDir}".`);
        }

        const allTargetLocaleFiles = omit(allLocaleFiles, sourceLocale) as LocaleFiles;
        const targetLocaleFiles = this.#filterLocales(allTargetLocaleFiles);

        const removedExtraKeys = this.#countRemovedExtraKeys(sourceLocaleFile, targetLocaleFiles);
        const cleanedTargetLocaleFiles = this.#localeDiffCalculator.removeAllExtraKeys(sourceLocaleFile, targetLocaleFiles);
        const snapshotFile = this.#snapshotRepository.load(runtimeConfig.detection.snapshotFile);
        const snapshot = snapshotFile?.entries || null;

        const missingKeys = this.#localeDiffCalculator.findMissingKeys(sourceLocaleFile, cleanedTargetLocaleFiles);
        const modifiedKeys = this.#buildModifiedKeysMap(sourceLocaleFile, cleanedTargetLocaleFiles, snapshot);
        const keysToTranslate = this.#mergeKeysToTranslate(missingKeys, modifiedKeys);

        const missingCount = this.#countFlatLocaleEntries(missingKeys);
        const modifiedCount = this.#countFlatLocaleEntries(modifiedKeys);

        if (missingCount > 0) {
            console.log(ANSI_COLORS.yellow, `Found ${missingCount} missing translations across all languages.`);
        }

        if (modifiedCount > 0) {
            console.log(ANSI_COLORS.yellow, `Found ${modifiedCount} modified keys that need retranslation.`);
        }

        const hasChanges = Object.keys(keysToTranslate).length > 0 || removedExtraKeys > 0;

        if (!hasChanges) {
            console.log(ANSI_COLORS.green, "All target languages are already translated and up to date.");

            if (runtimeConfig.output.sortKeys) {
                console.log(ANSI_COLORS.yellow, "Sorting all files as requested...");
            }

            if (!flags.dryRun) {
                this.#localeRepository.writeAll({
                    ...cleanedTargetLocaleFiles,
                    [sourceLocale]: sourceLocaleFile,
                });
            }

            if (!snapshotFile && runtimeConfig.detection.snapshotFile && !flags.dryRun) {
                this.#snapshotRepository.save(runtimeConfig.detection.snapshotFile, sourceLocale, sourceLocaleFile);
            }

            return ExitCode.Success;
        }

        if (flags.command === "check" || flags.command === "report") {
            return flags.failOnChanges || runtimeConfig.ci.failOnChanges ? ExitCode.ChangesDetected : ExitCode.Success;
        }

        const translator = new Translator(runtimeConfig);
        const translatedKeys = await translator.translateAll(keysToTranslate);
        const updatedTargetLocaleFiles = this.#localeDiffCalculator.updateTargetLocales(cleanedTargetLocaleFiles, translatedKeys);

        if (runtimeConfig.output.sortKeys) {
            console.log(ANSI_COLORS.yellow, "Sorting all files as requested...");
        }

        if (!flags.dryRun) {
            this.#localeRepository.writeAll({
                ...updatedTargetLocaleFiles,
                [sourceLocale]: sourceLocaleFile,
            });

            if (runtimeConfig.detection.snapshotFile) {
                this.#snapshotRepository.save(runtimeConfig.detection.snapshotFile, sourceLocale, sourceLocaleFile);
            }
        }

        return ExitCode.Success;
    }

    /**
     * Filters target locales using the optional CLI locale filter.
     *
     * @param locales - All available target locale files
     * @returns Filtered target locale files
     */
    #filterLocales(locales: LocaleFiles): LocaleFiles {
        const selectedLocales = this.#config.flags.locales;

        if (!selectedLocales?.length) {
            return locales;
        }

        return Object.fromEntries(Object.entries(locales).filter(([locale]) => selectedLocales.includes(locale)));
    }

    /**
     * Builds the modified-keys map for all target locales.
     *
     * @param sourceLocaleFile - Current source locale file
     * @param targetLocaleFiles - Current target locale files
     * @param snapshot - Previously stored source snapshot
     * @returns Modified keys grouped by locale
     */
    #buildModifiedKeysMap(
        sourceLocaleFile: LocaleFile,
        targetLocaleFiles: LocaleFiles,
        snapshot: Record<string, string> | null,
    ): FlatLocaleFiles {
        if (!snapshot) {
            return {};
        }

        const modifiedSourceKeys = this.#localeDiffCalculator.findModifiedKeys(sourceLocaleFile, snapshot);

        if (!Object.keys(modifiedSourceKeys).length) {
            return {};
        }

        return Object.keys(targetLocaleFiles).reduce<FlatLocaleFiles>((result, locale) => {
            result[locale] = { ...modifiedSourceKeys };
            return result;
        }, {});
    }

    /**
     * Merges missing and modified keys into the final translation payload.
     *
     * @param missingKeys - Missing keys grouped by locale
     * @param modifiedKeys - Modified keys grouped by locale
     * @returns Keys to translate grouped by locale
     */
    #mergeKeysToTranslate(missingKeys: FlatLocaleFiles, modifiedKeys: FlatLocaleFiles): FlatLocaleFiles {
        const locales = new Set<string>([...Object.keys(missingKeys), ...Object.keys(modifiedKeys)]);
        const result: FlatLocaleFiles = {};

        for (const locale of locales) {
            result[locale] = {
                ...(missingKeys[locale] || {}),
                ...(modifiedKeys[locale] || {}),
            };
        }

        return result;
    }

    /**
     * Counts the total number of flat translation entries across all locales.
     *
     * @param localeFiles - Flat locale files grouped by locale
     * @returns Total entry count
     */
    #countFlatLocaleEntries(localeFiles: FlatLocaleFiles): number {
        return Object.values(localeFiles).reduce((total, entries) => total + Object.keys(entries).length, 0);
    }

    /**
     * Counts the total number of extra keys that would be removed from target locales.
     *
     * @param sourceLocaleFile - Source locale file
     * @param targetLocaleFiles - Target locale files
     * @returns Total number of extra keys
     */
    #countRemovedExtraKeys(sourceLocaleFile: LocaleFile, targetLocaleFiles: LocaleFiles): number {
        const flatSource = this.#localeDiffCalculator.getAllSourceKeys(sourceLocaleFile);
        let totalKeysToRemove = 0;

        for (const target of Object.values(targetLocaleFiles)) {
            const flatTarget = this.#localeDiffCalculator.getAllSourceKeys(target);

            for (const key of Object.keys(flatTarget)) {
                if (!(key in flatSource)) {
                    totalKeysToRemove += 1;
                }
            }
        }

        return totalKeysToRemove;
    }
}