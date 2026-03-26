import type { FlatLocaleFile, LocaleFile } from "../types.js";

/**
 * Handles structural transformations between nested locale objects and flat
 * dot-notated translation dictionaries.
 *
 * Responsibilities include:
 * - flattening nested locale objects into dot-notated dictionaries
 * - unflattening flat translation dictionaries into nested locale objects
 */
export class LocaleStructure {
    /**
     * Flattens a nested locale file into a dot-notated dictionary.
     *
     * Only string leaf values are included in the flattened output.
     *
     * @param value - Locale file to flatten
     * @param currentPath - Current dot-notated path
     * @param result - Mutable flatten result
     * @returns Flattened locale file
     */
    flatten(value: LocaleFile, currentPath: string = "", result: FlatLocaleFile = {}): FlatLocaleFile {
        for (const [key, entryValue] of Object.entries(value)) {
            const nextPath = currentPath ? `${currentPath}.${key}` : key;

            if (typeof entryValue === "string") {
                result[nextPath] = entryValue;
                continue;
            }

            if (this.#isPlainObject(entryValue)) {
                this.flatten(entryValue as LocaleFile, nextPath, result);
            }
        }

        return result;
    }

    /**
     * Reconstructs a nested locale file from a flat dot-notated dictionary.
     *
     * @param flatLocaleFile - Flat locale entries
     * @returns Nested locale file
     */
    unflatten(flatLocaleFile: FlatLocaleFile): LocaleFile {
        const result: LocaleFile = {};

        for (const [path, value] of Object.entries(flatLocaleFile)) {
            const keys = path.split(".");
            let current: Record<string, unknown> = result;

            keys.forEach((key, index) => {
                if (index === keys.length - 1) {
                    current[key] = value;
                    return;
                }

                if (!this.#isPlainObject(current[key])) {
                    current[key] = {};
                }

                current = current[key] as Record<string, unknown>;
            });
        }

        return result;
    }

    /**
     * Returns whether the provided value is a plain object.
     *
     * @param value - Value to test
     * @returns Whether the value is a plain object
     */
    #isPlainObject(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }
}
