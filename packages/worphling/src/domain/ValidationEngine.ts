import type { DiffResult, LocaleFile, LocaleFiles, LocaleIssue, ValidationConfig } from "../types.js";

import { LocaleStructure } from "./LocaleStructure.js";

/**
 * Input required to validate the effective locale state for a run.
 */
interface ValidationEngineInput {
    /**
     * Current source locale file.
     */
    sourceLocaleFile: LocaleFile;

    /**
     * Effective target locale files after planned mutations have been applied
     * in memory for the current run.
     */
    targetLocaleFiles: LocaleFiles;

    /**
     * Structured diff result for the current run.
     */
    diffResult: DiffResult;

    /**
     * Active validation behavior configuration.
     */
    validationConfig: ValidationConfig;
}

/**
 * Validates locale content and converts structural findings into structured
 * issues.
 *
 * Responsibilities include:
 * - converting missing/extra/modified diff state into issues
 * - validating placeholder preservation
 * - validating ICU structure preservation
 * - validating HTML-like tag preservation
 */
export class ValidationEngine {
    /**
     * Locale structure helper used for flattening locale files.
     */
    #localeStructure: LocaleStructure;

    /**
     * Creates a new validation engine.
     *
     * @param localeStructure - Optional locale structure helper
     */
    constructor(localeStructure?: LocaleStructure) {
        this.#localeStructure = localeStructure || new LocaleStructure();
    }

    /**
     * Validates the current locale state and returns structured issues.
     *
     * @param input - Validation input
     * @returns Deterministically ordered issues
     */
    validate(input: ValidationEngineInput): Array<LocaleIssue> {
        const issues: Array<LocaleIssue> = [];
        const flatSourceLocaleFile = this.#localeStructure.flatten(input.sourceLocaleFile);

        issues.push(
            ...this.#buildDiffIssues(
                input.diffResult.missing,
                "missing",
                input.validationConfig.failOnMissingKeys ? "error" : "warning",
                "Missing translation entry.",
            ),
        );
        issues.push(
            ...this.#buildDiffIssues(
                input.diffResult.extra,
                "extra",
                input.validationConfig.failOnExtraKeys ? "error" : "warning",
                "Extra translation entry not present in source locale.",
            ),
        );
        issues.push(
            ...this.#buildDiffIssues(
                input.diffResult.modified,
                "modified",
                input.validationConfig.failOnModifiedSource ? "error" : "warning",
                "Source translation changed and requires retranslation.",
            ),
        );

        for (const locale of Object.keys(input.targetLocaleFiles).sort()) {
            const targetLocaleFile = input.targetLocaleFiles[locale];
            const flatTargetLocaleFile = this.#localeStructure.flatten(targetLocaleFile);

            for (const key of Object.keys(flatSourceLocaleFile).sort()) {
                const sourceValue = flatSourceLocaleFile[key];
                const targetValue = flatTargetLocaleFile[key];

                if (typeof targetValue !== "string") {
                    continue;
                }

                if (input.validationConfig.preservePlaceholders) {
                    const placeholderIssue = this.#validatePlaceholders(locale, key, sourceValue, targetValue);

                    if (placeholderIssue) {
                        issues.push(placeholderIssue);
                    }
                }

                if (input.validationConfig.preserveIcuSyntax) {
                    const icuIssue = this.#validateIcuSyntax(locale, key, sourceValue, targetValue);

                    if (icuIssue) {
                        issues.push(icuIssue);
                    }
                }

                if (input.validationConfig.preserveHtmlTags) {
                    const tagIssue = this.#validateHtmlTags(locale, key, sourceValue, targetValue);

                    if (tagIssue) {
                        issues.push(tagIssue);
                    }
                }
            }
        }

        return issues.sort((left, right) => {
            const localeComparison = left.locale.localeCompare(right.locale);

            if (localeComparison !== 0) {
                return localeComparison;
            }

            const keyComparison = left.key.localeCompare(right.key);

            if (keyComparison !== 0) {
                return keyComparison;
            }

            const typeComparison = left.type.localeCompare(right.type);

            if (typeComparison !== 0) {
                return typeComparison;
            }

            return left.message.localeCompare(right.message);
        });
    }

    /**
     * Builds issues for a single diff category.
     *
     * @param localeFiles - Flat locale files grouped by locale
     * @param type - Issue type
     * @param severity - Issue severity
     * @param message - Human-readable issue message
     * @returns Issue list
     */
    #buildDiffIssues(
        localeFiles: Record<string, Record<string, string>>,
        type: LocaleIssue["type"],
        severity: LocaleIssue["severity"],
        message: string,
    ): Array<LocaleIssue> {
        const issues: Array<LocaleIssue> = [];

        for (const locale of Object.keys(localeFiles).sort()) {
            const entries = localeFiles[locale];

            for (const key of Object.keys(entries).sort()) {
                issues.push({
                    type,
                    severity,
                    locale,
                    key,
                    message,
                    sourceValue: type === "extra" ? undefined : entries[key],
                    targetValue: type === "extra" ? entries[key] : undefined,
                });
            }
        }

        return issues;
    }

    /**
     * Validates placeholder preservation for a single translation entry.
     *
     * @param locale - Target locale
     * @param key - Translation key
     * @param sourceValue - Source message
     * @param targetValue - Target message
     * @returns Validation issue when placeholders do not match
     */
    #validatePlaceholders(locale: string, key: string, sourceValue: string, targetValue: string): LocaleIssue | null {
        const sourcePlaceholders = this.#extractPlaceholderTokens(sourceValue);
        const targetPlaceholders = this.#extractPlaceholderTokens(targetValue);

        if (this.#areStringArraysEqual(sourcePlaceholders, targetPlaceholders)) {
            return null;
        }

        return {
            type: "invalid-placeholder",
            severity: "error",
            locale,
            key,
            message: `Placeholder mismatch. Expected ${this.#formatTokenList(sourcePlaceholders)}, received ${this.#formatTokenList(targetPlaceholders)}.`,
            sourceValue,
            targetValue,
        };
    }

    /**
     * Validates ICU preservation for a single translation entry.
     *
     * @param locale - Target locale
     * @param key - Translation key
     * @param sourceValue - Source message
     * @param targetValue - Target message
     * @returns Validation issue when ICU structure does not match
     */
    #validateIcuSyntax(locale: string, key: string, sourceValue: string, targetValue: string): LocaleIssue | null {
        const sourceIcuSignatures = this.#extractIcuSignatures(sourceValue);
        const targetIcuSignatures = this.#extractIcuSignatures(targetValue);

        if (this.#areStringArraysEqual(sourceIcuSignatures, targetIcuSignatures)) {
            return null;
        }

        return {
            type: "invalid-icu",
            severity: "error",
            locale,
            key,
            message: `ICU structure mismatch. Expected ${this.#formatTokenList(sourceIcuSignatures)}, received ${this.#formatTokenList(targetIcuSignatures)}.`,
            sourceValue,
            targetValue,
        };
    }

    /**
     * Validates HTML-like tag preservation for a single translation entry.
     *
     * @param locale - Target locale
     * @param key - Translation key
     * @param sourceValue - Source message
     * @param targetValue - Target message
     * @returns Validation issue when tag structure does not match
     */
    #validateHtmlTags(locale: string, key: string, sourceValue: string, targetValue: string): LocaleIssue | null {
        const sourceTags = this.#extractHtmlTagTokens(sourceValue);
        const targetTags = this.#extractHtmlTagTokens(targetValue);

        if (this.#areStringArraysEqual(sourceTags, targetTags)) {
            return null;
        }

        return {
            type: "invalid-tag",
            severity: "error",
            locale,
            key,
            message: `Tag structure mismatch. Expected ${this.#formatTokenList(sourceTags)}, received ${this.#formatTokenList(targetTags)}.`,
            sourceValue,
            targetValue,
        };
    }

    /**
     * Extracts simple placeholder tokens such as `{name}`.
     *
     * Complex ICU blocks such as `{count, plural, ...}` are intentionally not
     * treated as simple placeholders here.
     *
     * @param value - Message text
     * @returns Sorted placeholder token list
     */
    #extractPlaceholderTokens(value: string): Array<string> {
        const matches = value.match(/\{[A-Za-z0-9_.-]+\}/g);

        return (matches || []).slice().sort();
    }

    /**
     * Extracts normalized HTML-like tag tokens while preserving token order.
     *
     * Examples:
     * - `open:bold`
     * - `close:bold`
     * - `self:br`
     *
     * @param value - Message text
     * @returns Ordered tag token list
     */
    #extractHtmlTagTokens(value: string): Array<string> {
        const tagPattern = /<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^<>]*?)?\/?>/g;
        const tokens: Array<string> = [];

        for (const match of value.matchAll(tagPattern)) {
            const fullMatch = match[0];
            const tagName = match[1];

            if (fullMatch.startsWith("</")) {
                tokens.push(`close:${tagName}`);
                continue;
            }

            if (fullMatch.endsWith("/>")) {
                tokens.push(`self:${tagName}`);
                continue;
            }

            tokens.push(`open:${tagName}`);
        }

        return tokens;
    }

    /**
     * Extracts normalized ICU block signatures from a message.
     *
     * The implementation is intentionally structural rather than exhaustive. It
     * validates that the same ICU arguments and selector families are present.
     *
     * @param value - Message text
     * @returns Sorted ICU signature list
     */
    #extractIcuSignatures(value: string): Array<string> {
        const signatures: Array<string> = [];

        this.#collectIcuSignatures(value, signatures);

        return signatures.slice().sort();
    }

    /**
     * Recursively collects ICU signatures from balanced brace blocks.
     *
     * @param value - Message text
     * @param signatures - Mutable signature accumulator
     */
    #collectIcuSignatures(value: string, signatures: Array<string>): void {
        const blocks = this.#extractBalancedBraceContents(value);

        for (const block of blocks) {
            const signature = this.#buildIcuSignature(block);

            if (signature) {
                signatures.push(signature);
            }

            this.#collectIcuSignatures(block, signatures);
        }
    }

    /**
     * Extracts balanced brace contents from the provided text.
     *
     * Returned values exclude the outer braces.
     *
     * @param value - Message text
     * @returns Balanced brace contents
     */
    #extractBalancedBraceContents(value: string): Array<string> {
        const blocks: Array<string> = [];
        let currentDepth = 0;
        let blockStartIndex = -1;

        for (let index = 0; index < value.length; index += 1) {
            const currentCharacter = value[index];

            if (currentCharacter === "{") {
                if (currentDepth === 0) {
                    blockStartIndex = index;
                }

                currentDepth += 1;
                continue;
            }

            if (currentCharacter === "}") {
                if (currentDepth === 0) {
                    continue;
                }

                currentDepth -= 1;

                if (currentDepth === 0 && blockStartIndex >= 0) {
                    blocks.push(value.slice(blockStartIndex + 1, index));
                    blockStartIndex = -1;
                }
            }
        }

        return blocks;
    }

    /**
     * Builds a normalized ICU signature from a single balanced block content.
     *
     * Non-ICU brace content returns `null`.
     *
     * @param blockContent - Balanced brace content without outer braces
     * @returns Normalized ICU signature, or `null`
     */
    #buildIcuSignature(blockContent: string): string | null {
        const segments = this.#splitTopLevelCommaSegments(blockContent, 3).map((segment) => segment.trim());

        if (segments.length < 2) {
            return null;
        }

        const argumentName = segments[0];
        const formatType = segments[1];

        if (!argumentName || !formatType) {
            return null;
        }

        if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(argumentName)) {
            return null;
        }

        if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(formatType)) {
            return null;
        }

        if ((formatType === "plural" || formatType === "select" || formatType === "selectordinal") && segments.length >= 3) {
            const selectors = this.#extractIcuSelectors(segments[2]);

            return `${argumentName}:${formatType}:${selectors.join("|")}`;
        }

        return `${argumentName}:${formatType}`;
    }

    /**
     * Splits a string by top-level commas while respecting brace nesting.
     *
     * @param value - Text to split
     * @param maxSegments - Optional maximum number of output segments
     * @returns Split segments
     */
    #splitTopLevelCommaSegments(value: string, maxSegments?: number): Array<string> {
        const segments: Array<string> = [];
        let currentSegmentStartIndex = 0;
        let currentDepth = 0;

        for (let index = 0; index < value.length; index += 1) {
            const currentCharacter = value[index];

            if (currentCharacter === "{") {
                currentDepth += 1;
                continue;
            }

            if (currentCharacter === "}") {
                currentDepth = Math.max(0, currentDepth - 1);
                continue;
            }

            if (currentCharacter !== "," || currentDepth !== 0) {
                continue;
            }

            if (maxSegments !== undefined && segments.length >= maxSegments - 1) {
                break;
            }

            segments.push(value.slice(currentSegmentStartIndex, index));
            currentSegmentStartIndex = index + 1;
        }

        segments.push(value.slice(currentSegmentStartIndex));

        return segments;
    }

    /**
     * Extracts ICU selector names from the branch-definition part of a plural,
     * select, or selectordinal block.
     *
     * @param value - Selector definition text
     * @returns Ordered selector list
     */
    #extractIcuSelectors(value: string): Array<string> {
        const selectors: Array<string> = [];
        let index = 0;

        while (index < value.length) {
            while (index < value.length && /\s/.test(value[index])) {
                index += 1;
            }

            const selectorStartIndex = index;

            while (index < value.length && !/\s|\{/.test(value[index])) {
                index += 1;
            }

            const selector = value.slice(selectorStartIndex, index).trim();

            while (index < value.length && /\s/.test(value[index])) {
                index += 1;
            }

            if (!selector || value[index] !== "{") {
                index += 1;
                continue;
            }

            selectors.push(selector);

            let currentDepth = 0;

            while (index < value.length) {
                if (value[index] === "{") {
                    currentDepth += 1;
                } else if (value[index] === "}") {
                    currentDepth -= 1;

                    if (currentDepth === 0) {
                        index += 1;
                        break;
                    }
                }

                index += 1;
            }
        }

        return selectors;
    }

    /**
     * Returns whether two string arrays are exactly equal.
     *
     * @param left - Left array
     * @param right - Right array
     * @returns Whether arrays are equal
     */
    #areStringArraysEqual(left: Array<string>, right: Array<string>): boolean {
        if (left.length !== right.length) {
            return false;
        }

        return left.every((value, index) => value === right[index]);
    }

    /**
     * Formats a token list for human-readable issue messages.
     *
     * @param values - Token list
     * @returns Formatted token list
     */
    #formatTokenList(values: Array<string>): string {
        if (values.length === 0) {
            return "no tokens";
        }

        return values.map((value) => `'${value}'`).join(", ");
    }
}
