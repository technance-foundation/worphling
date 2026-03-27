import type { LocaleDiffCalculator } from "../domain/LocaleDiffCalculator.js";
import type { CommandName, DiffResult, FlatLocaleFile, LocaleFile, LocaleFiles, Plan } from "../types.js";

/**
 * Builds structured diff results and ordered execution plans for a run.
 *
 * This collaborator keeps command-specific action selection out of `App`
 * while staying close to the existing domain model.
 */
export class RunPlanner {
    /**
     * Locale diff calculator used for structural analysis.
     */
    #localeDiffCalculator: LocaleDiffCalculator;

    /**
     * Creates a new run planner.
     *
     * @param localeDiffCalculator - Locale diff calculator dependency
     */
    constructor(localeDiffCalculator: LocaleDiffCalculator) {
        this.#localeDiffCalculator = localeDiffCalculator;
    }

    /**
     * Builds the structured diff result for the current locale state using the
     * stored source snapshot.
     *
     * @param sourceLocaleFile - Current source locale file
     * @param targetLocaleFiles - Current target locale files
     * @param snapshot - Previously stored source snapshot
     * @returns Structured diff result
     */
    analyze(sourceLocaleFile: LocaleFile, targetLocaleFiles: LocaleFiles, snapshot: Record<string, string> | null): DiffResult {
        const missing = this.#localeDiffCalculator.findMissingKeys(sourceLocaleFile, targetLocaleFiles);
        const extra = this.#localeDiffCalculator.findExtraKeys(sourceLocaleFile, targetLocaleFiles);
        const modified = this.#buildModifiedKeysMap(sourceLocaleFile, targetLocaleFiles, snapshot);

        return {
            missing,
            extra,
            modified,
        };
    }

    /**
     * Builds the ordered execution plan for the requested command.
     *
     * Command semantics:
     * - `check`: analyze only
     * - `report`: analyze only
     * - `translate`: translate missing + modified keys
     * - `fix`: remove extra keys only
     * - `sync`: translate missing + modified keys and remove extra keys
     *
     * @param diffResult - Structured diff result
     * @param command - Selected command
     * @returns Ordered execution plan
     */
    createPlan(diffResult: DiffResult, command: CommandName): Plan {
        if (command === "check" || command === "report") {
            return {
                actions: [],
            };
        }

        const actions: Plan["actions"] = [];
        const locales = this.#collectSortedLocales(diffResult);

        for (const locale of locales) {
            const missingEntries = diffResult.missing[locale];
            const modifiedEntries = diffResult.modified[locale];
            const extraEntries = diffResult.extra[locale];

            if ((command === "translate" || command === "sync") && missingEntries && Object.keys(missingEntries).length > 0) {
                actions.push({
                    type: "translate-missing",
                    locale,
                    entries: this.#sortEntries(missingEntries),
                });
            }

            if ((command === "translate" || command === "sync") && modifiedEntries && Object.keys(modifiedEntries).length > 0) {
                actions.push({
                    type: "retranslate-modified",
                    locale,
                    entries: this.#sortEntries(modifiedEntries),
                });
            }

            if ((command === "fix" || command === "sync") && extraEntries && Object.keys(extraEntries).length > 0) {
                actions.push({
                    type: "remove-extra-keys",
                    locale,
                    entries: this.#sortEntries(extraEntries),
                });
            }

            if (this.#localeHasMutations(locale, diffResult, command)) {
                actions.push({
                    type: "write-locale-file",
                    locale,
                });
            }
        }

        return {
            actions,
        };
    }

    /**
     * Builds the modified-key map for all target locales.
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
    ): Record<string, FlatLocaleFile> {
        if (!snapshot) {
            return {};
        }

        const modifiedSourceKeys = this.#localeDiffCalculator.findModifiedKeys(sourceLocaleFile, snapshot);

        if (!Object.keys(modifiedSourceKeys).length) {
            return {};
        }

        return Object.keys(targetLocaleFiles)
            .sort()
            .reduce<Record<string, FlatLocaleFile>>((result, locale) => {
                result[locale] = { ...modifiedSourceKeys };
                return result;
            }, {});
    }

    /**
     * Collects all locales participating in the current diff in deterministic
     * sorted order.
     *
     * @param diffResult - Structured diff result
     * @returns Sorted locale list
     */
    #collectSortedLocales(diffResult: DiffResult): Array<string> {
        return [
            ...new Set<string>([
                ...Object.keys(diffResult.missing),
                ...Object.keys(diffResult.extra),
                ...Object.keys(diffResult.modified),
            ]),
        ].sort();
    }

    /**
     * Returns whether the given locale has command-relevant mutations.
     *
     * @param locale - Target locale
     * @param diffResult - Structured diff result
     * @param command - Selected command
     * @returns Whether the locale should be scheduled for writing
     */
    #localeHasMutations(locale: string, diffResult: DiffResult, command: CommandName): boolean {
        if (
            (command === "translate" || command === "sync") &&
            diffResult.missing[locale] &&
            Object.keys(diffResult.missing[locale]).length > 0
        ) {
            return true;
        }

        if (
            (command === "translate" || command === "sync") &&
            diffResult.modified[locale] &&
            Object.keys(diffResult.modified[locale]).length > 0
        ) {
            return true;
        }

        if (
            (command === "fix" || command === "sync") &&
            diffResult.extra[locale] &&
            Object.keys(diffResult.extra[locale]).length > 0
        ) {
            return true;
        }

        return false;
    }

    /**
     * Returns a copy of the provided flat entries with stable key ordering.
     *
     * @param entries - Flat locale entries
     * @returns Sorted flat locale entries
     */
    #sortEntries(entries: FlatLocaleFile): FlatLocaleFile {
        return Object.fromEntries(Object.entries(entries).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)));
    }
}
