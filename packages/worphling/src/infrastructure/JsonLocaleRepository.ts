import fs from "node:fs";
import path from "node:path";

import { ANSI_COLORS } from "../constants.js";
import { LocaleFileReadError, LocaleFileWriteError } from "../errors.js";
import type { LocaleFile, LocaleFiles, OutputConfig } from "../types.js";

/**
 * Repository responsible for reading and writing locale JSON files on disk.
 *
 * Responsibilities include:
 * - reading locale files from the configured locales directory
 * - writing locale files using the configured output formatting
 */
export class JsonLocaleRepository {
    /**
     * Absolute path to the locales directory.
     */
    #localesDirectoryPath: string;

    /**
     * Output formatting configuration used for file writes.
     */
    #output: OutputConfig;

    /**
     * Creates a new locale JSON repository.
     *
     * @param localesDirectoryPath - Directory containing locale JSON files
     * @param output - Output formatting configuration
     */
    constructor(localesDirectoryPath: string, output: OutputConfig) {
        this.#localesDirectoryPath = path.resolve(localesDirectoryPath);
        this.#output = output;
    }

    /**
     * Reads all locale JSON files from the configured locales directory.
     *
     * @returns Locale files grouped by locale key
     * @throws {LocaleFileReadError} When the directory or files cannot be read
     */
    readAll(): LocaleFiles {
        if (!fs.existsSync(this.#localesDirectoryPath)) {
            throw new LocaleFileReadError(this.#localesDirectoryPath, "Directory not found.");
        }

        const jsonFiles = this.#scan();

        return this.#read(jsonFiles);
    }

    /**
     * Writes all provided locale files into the configured locales directory.
     *
     * @param translations - Locale files grouped by locale key
     * @throws {LocaleFileWriteError} When files cannot be written
     */
    writeAll(translations: LocaleFiles): void {
        if (!fs.existsSync(this.#localesDirectoryPath)) {
            throw new LocaleFileWriteError(this.#localesDirectoryPath, "Directory not found.");
        }

        for (const [locale, content] of Object.entries(translations)) {
            this.#writeLocaleFile(locale, content);
        }
    }

    /**
     * Returns the JSON file names available in the configured locales
     * directory.
     *
     * @returns JSON file names
     */
    #scan(): Array<string> {
        return fs.readdirSync(this.#localesDirectoryPath).filter((file) => file.endsWith(".json"));
    }

    /**
     * Reads and parses all provided JSON locale files.
     *
     * @param files - JSON locale file names
     * @returns Locale files grouped by locale key
     * @throws {LocaleFileReadError} When a file cannot be read or parsed
     */
    #read(files: Array<string>): LocaleFiles {
        const result: LocaleFiles = {};

        for (const file of files) {
            const filePath = path.join(this.#localesDirectoryPath, file);

            try {
                const content = fs.readFileSync(filePath, "utf-8");
                const parsed = JSON.parse(content) as LocaleFile;
                const locale = this.#extractLanguageKey(filePath);

                result[locale] = parsed;
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                throw new LocaleFileReadError(filePath, reason);
            }
        }

        return result;
    }

    /**
     * Writes a single locale file using the configured output formatting.
     *
     * @param locale - Locale key
     * @param content - Locale file content
     * @throws {LocaleFileWriteError} When the file cannot be written
     */
    #writeLocaleFile(locale: string, content: LocaleFile): void {
        const filePath = path.join(this.#localesDirectoryPath, `${locale}.json`);

        try {
            const contentToWrite = this.#output.sortKeys ? this.#sortObjectKeysRecursively(content) : content;
            const jsonContent = JSON.stringify(contentToWrite, null, this.#output.preserveIndentation);
            const finalContent = this.#output.trailingNewline ? `${jsonContent}\n` : jsonContent;

            fs.writeFileSync(filePath, finalContent, "utf-8");

            console.log(ANSI_COLORS.green, `Success: File written for locale "${locale}" at ${filePath}`);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new LocaleFileWriteError(filePath, reason);
        }
    }

    /**
     * Extracts the locale key from a locale file path.
     *
     * @param filePath - Locale file path
     * @returns Locale key
     */
    #extractLanguageKey(filePath: string): string {
        return path.basename(filePath, ".json");
    }

    /**
     * Recursively sorts object keys while preserving array order.
     *
     * @param value - Value to normalize
     * @returns Sorted value
     */
    #sortObjectKeysRecursively(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((entry) => this.#sortObjectKeysRecursively(entry));
        }

        if (!this.#isPlainObject(value)) {
            return value;
        }

        const sortedKeys = Object.keys(value).sort();
        const result: Record<string, unknown> = {};

        for (const key of sortedKeys) {
            result[key] = this.#sortObjectKeysRecursively(value[key]);
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
