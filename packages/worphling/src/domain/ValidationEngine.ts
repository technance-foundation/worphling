import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

import type { DiffResult, LocaleFile, LocaleFiles, LocaleIssue, TranslationPluginContract, ValidationConfig } from "../types.js";

import { LocaleStructure } from "./LocaleStructure.js";

/**
 * Minimal FormatJS ICU AST node shape used by the validation engine.
 */
interface IcuAstNode {
    /**
     * FormatJS node type discriminator.
     */
    type: number;

    /**
     * Node-associated value such as an argument name or tag name.
     */
    value?: unknown;

    /**
     * Nested child nodes for tag-like structures.
     */
    children?: Array<unknown>;

    /**
     * ICU options for select/plural-style nodes.
     */
    options?: Record<string, { value?: Array<unknown> }>;
}

/**
 * Parsed ICU token signature model used for structural comparison.
 */
interface IcuStructureSignature {
    /**
     * Stable node kind.
     */
    type: string;

    /**
     * Argument name associated with the ICU node when relevant.
     */
    value?: string;

    /**
     * Option keys for select/plural-like nodes.
     */
    options?: Array<string>;

    /**
     * Nested child signatures.
     */
    children?: Array<IcuStructureSignature>;
}

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
 *
 * ICU-aware validation is considered core Worphling behavior. Plugins only add
 * framework-specific validation overrides on top of the base config.
 */
export class ValidationEngine {
    /**
     * Active translation plugin.
     */
    #plugin: TranslationPluginContract;

    /**
     * Locale structure helper used for flattening locale files.
     */
    #localeStructure: LocaleStructure;

    /**
     * Creates a new validation engine.
     *
     * @param plugin - Active translation plugin
     * @param localeStructure - Optional locale structure helper
     */
    constructor(plugin: TranslationPluginContract, localeStructure?: LocaleStructure) {
        this.#plugin = plugin;
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
        const effectiveValidationConfig: ValidationConfig = {
            ...input.validationConfig,
            ...this.#plugin.getValidationOverrides(),
        };
        const flatSourceLocaleFile = this.#localeStructure.flatten(input.sourceLocaleFile);

        issues.push(
            ...this.#buildDiffIssues(
                input.diffResult.missing,
                "missing",
                effectiveValidationConfig.failOnMissingKeys ? "error" : "warning",
                "Missing translation entry.",
            ),
        );
        issues.push(
            ...this.#buildDiffIssues(
                input.diffResult.extra,
                "extra",
                effectiveValidationConfig.failOnExtraKeys ? "error" : "warning",
                "Extra translation entry not present in source locale.",
            ),
        );
        issues.push(
            ...this.#buildDiffIssues(
                input.diffResult.modified,
                "modified",
                effectiveValidationConfig.failOnModifiedSource ? "error" : "warning",
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

                if (effectiveValidationConfig.preservePlaceholders) {
                    const placeholderIssue = this.#validatePlaceholders(locale, key, sourceValue, targetValue);

                    if (placeholderIssue) {
                        issues.push(placeholderIssue);
                    }
                }

                if (effectiveValidationConfig.preserveIcuSyntax) {
                    const icuIssue = this.#validateIcuSyntax(locale, key, sourceValue, targetValue);

                    if (icuIssue) {
                        issues.push(icuIssue);
                    }
                }

                if (effectiveValidationConfig.preserveHtmlTags) {
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
     * Placeholder extraction is AST-based so ICU branch literals such as
     * `{Rejected}` are not incorrectly treated as placeholders.
     *
     * @param locale - Target locale
     * @param key - Translation key
     * @param sourceValue - Source message
     * @param targetValue - Target message
     * @returns Validation issue when placeholders do not match
     */
    #validatePlaceholders(locale: string, key: string, sourceValue: string, targetValue: string): LocaleIssue | null {
        const sourceParseResult = this.#tryParseIcuMessage(sourceValue);
        const targetParseResult = this.#tryParseIcuMessage(targetValue);

        if (!sourceParseResult.ok || !targetParseResult.ok) {
            return null;
        }

        const sourcePlaceholders = this.#extractPlaceholderTokensFromAst(sourceParseResult.ast);
        const targetPlaceholders = this.#extractPlaceholderTokensFromAst(targetParseResult.ast);

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
     * Parsing failures are reported as ICU validation errors. When both messages
     * parse successfully, their normalized structural signatures are compared.
     *
     * @param locale - Target locale
     * @param key - Translation key
     * @param sourceValue - Source message
     * @param targetValue - Target message
     * @returns Validation issue when ICU structure does not match
     */
    #validateIcuSyntax(locale: string, key: string, sourceValue: string, targetValue: string): LocaleIssue | null {
        const sourceParseResult = this.#tryParseIcuMessage(sourceValue);

        if (!sourceParseResult.ok) {
            return {
                type: "invalid-icu",
                severity: "error",
                locale,
                key,
                message: `Source ICU message could not be parsed: ${sourceParseResult.reason}`,
                sourceValue,
                targetValue,
            };
        }

        const targetParseResult = this.#tryParseIcuMessage(targetValue);

        if (!targetParseResult.ok) {
            return {
                type: "invalid-icu",
                severity: "error",
                locale,
                key,
                message: `Target ICU message could not be parsed: ${targetParseResult.reason}`,
                sourceValue,
                targetValue,
            };
        }

        const sourceSignature = this.#buildIcuStructureSignature(sourceParseResult.ast);
        const targetSignature = this.#buildIcuStructureSignature(targetParseResult.ast);

        if (JSON.stringify(sourceSignature) === JSON.stringify(targetSignature)) {
            return null;
        }

        return {
            type: "invalid-icu",
            severity: "error",
            locale,
            key,
            message: `ICU structure mismatch. Expected ${this.#formatStructureSignature(sourceSignature)}, received ${this.#formatStructureSignature(targetSignature)}.`,
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
        const sourceParseResult = this.#tryParseIcuMessage(sourceValue);
        const targetParseResult = this.#tryParseIcuMessage(targetValue);

        if (!sourceParseResult.ok || !targetParseResult.ok) {
            return null;
        }

        const sourceTags = this.#extractHtmlTagTokensFromAst(sourceParseResult.ast);
        const targetTags = this.#extractHtmlTagTokensFromAst(targetParseResult.ast);

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
     * Parses an ICU message and returns either an AST or a human-readable error.
     *
     * @param value - Message text
     * @returns Parse result
     */
    #tryParseIcuMessage(value: string): { ok: true; ast: Array<unknown> } | { ok: false; reason: string } {
        try {
            return {
                ok: true,
                ast: parse(value),
            };
        } catch (error) {
            return {
                ok: false,
                reason: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Extracts placeholder tokens from an ICU AST.
     *
     * This includes plain arguments as well as arguments used by plural/select
     * nodes and nested argument references inside option branches.
     *
     * @param ast - Parsed ICU AST
     * @returns Sorted placeholder token list
     */
    #extractPlaceholderTokensFromAst(ast: Array<unknown>): Array<string> {
        const placeholders = new Set<string>();

        this.#collectPlaceholderTokensFromAst(ast, placeholders);

        return [...placeholders].sort();
    }

    /**
     * Recursively collects placeholder tokens from an ICU AST.
     *
     * @param ast - Parsed ICU AST
     * @param placeholders - Mutable placeholder accumulator
     */
    #collectPlaceholderTokensFromAst(ast: Array<unknown>, placeholders: Set<string>): void {
        for (const node of ast) {
            if (!this.#isAstNode(node)) {
                continue;
            }

            if (typeof node.value === "string" && this.#nodeCarriesArgumentValue(node.type)) {
                placeholders.add(node.value);
            }

            if (this.#hasOptions(node)) {
                for (const option of Object.values(node.options)) {
                    if (option && Array.isArray(option.value)) {
                        this.#collectPlaceholderTokensFromAst(option.value, placeholders);
                    }
                }
            }

            if (Array.isArray(node.children)) {
                this.#collectPlaceholderTokensFromAst(node.children, placeholders);
            }
        }
    }

    /**
     * Extracts normalized HTML-like tag tokens from an ICU AST.
     *
     * Examples:
     * - `open:bold`
     * - `close:bold`
     *
     * @param ast - Parsed ICU AST
     * @returns Ordered tag token list
     */
    #extractHtmlTagTokensFromAst(ast: Array<unknown>): Array<string> {
        const tokens: Array<string> = [];

        this.#collectHtmlTagTokensFromAst(ast, tokens);

        return tokens;
    }

    /**
     * Recursively collects HTML-like tag tokens from an ICU AST.
     *
     * @param ast - Parsed ICU AST
     * @param tokens - Mutable tag token accumulator
     */
    #collectHtmlTagTokensFromAst(ast: Array<unknown>, tokens: Array<string>): void {
        for (const node of ast) {
            if (!this.#isAstNode(node)) {
                continue;
            }

            if (node.type === TYPE.tag && typeof node.value === "string") {
                tokens.push(`open:${node.value}`);

                if (Array.isArray(node.children)) {
                    this.#collectHtmlTagTokensFromAst(node.children, tokens);
                }

                tokens.push(`close:${node.value}`);
                continue;
            }

            if (this.#hasOptions(node)) {
                for (const option of Object.values(node.options)) {
                    if (option && Array.isArray(option.value)) {
                        this.#collectHtmlTagTokensFromAst(option.value, tokens);
                    }
                }
            }

            if (Array.isArray(node.children)) {
                this.#collectHtmlTagTokensFromAst(node.children, tokens);
            }
        }
    }

    /**
     * Builds a normalized structural signature for a parsed ICU AST.
     *
     * The signature is intentionally limited to structure that should remain
     * stable across translations:
     * - node kind
     * - argument name
     * - plural/select option keys
     * - nested child structure
     *
     * @param ast - Parsed ICU AST
     * @returns Structural signature
     */
    #buildIcuStructureSignature(ast: Array<unknown>): Array<IcuStructureSignature> {
        return ast
            .map((node) => this.#buildIcuNodeSignature(node))
            .filter((signature): signature is IcuStructureSignature => signature !== null);
    }

    /**
     * Builds a structural signature for a single ICU AST node.
     *
     * @param node - Parsed ICU AST node
     * @returns Node signature, or `null` for nodes irrelevant to validation
     */
    #buildIcuNodeSignature(node: unknown): IcuStructureSignature | null {
        if (!this.#isAstNode(node)) {
            return null;
        }

        if (node.type === TYPE.literal) {
            return null;
        }

        if (node.type === TYPE.pound) {
            return {
                type: "pound",
            };
        }

        if (node.type === TYPE.tag) {
            return {
                type: "tag",
                value: typeof node.value === "string" ? node.value : undefined,
                children: Array.isArray(node.children) ? this.#buildIcuStructureSignature(node.children) : [],
            };
        }

        if (this.#hasOptions(node)) {
            const optionKeys = Object.keys(node.options).sort();
            const optionChildren = optionKeys.flatMap((optionKey) => {
                const option = node.options[optionKey];

                return option && Array.isArray(option.value) ? this.#buildIcuStructureSignature(option.value) : [];
            });

            return {
                type: this.#normalizeAstNodeType(node.type),
                value: typeof node.value === "string" ? node.value : undefined,
                options: optionKeys,
                children: optionChildren,
            };
        }

        return {
            type: this.#normalizeAstNodeType(node.type),
            value: typeof node.value === "string" ? node.value : undefined,
            children: Array.isArray(node.children) ? this.#buildIcuStructureSignature(node.children) : undefined,
        };
    }

    /**
     * Returns whether the provided AST node type represents an argument-bearing
     * placeholder reference.
     *
     * @param nodeType - FormatJS AST node type
     * @returns Whether the node carries an argument name
     */
    #nodeCarriesArgumentValue(nodeType: number): boolean {
        return (
            nodeType === TYPE.argument ||
            nodeType === TYPE.number ||
            nodeType === TYPE.date ||
            nodeType === TYPE.time ||
            nodeType === TYPE.select ||
            nodeType === TYPE.plural
        );
    }

    /**
     * Normalizes a FormatJS AST node type into a stable string used in issue
     * messages and signature comparison.
     *
     * @param nodeType - FormatJS AST node type
     * @returns Stable node type name
     */
    #normalizeAstNodeType(nodeType: number): string {
        switch (nodeType) {
            case TYPE.argument:
                return "argument";
            case TYPE.number:
                return "number";
            case TYPE.date:
                return "date";
            case TYPE.time:
                return "time";
            case TYPE.select:
                return "select";
            case TYPE.plural:
                return "plural";
            case TYPE.tag:
                return "tag";
            case TYPE.pound:
                return "pound";
            case TYPE.literal:
                return "literal";
            default:
                return `unknown:${String(nodeType)}`;
        }
    }

    /**
     * Returns whether the provided value looks like a FormatJS AST node.
     *
     * @param value - Value to test
     * @returns Whether the value is an AST node
     */
    #isAstNode(value: unknown): value is IcuAstNode {
        return typeof value === "object" && value !== null && "type" in value && typeof value.type === "number";
    }

    /**
     * Returns whether the provided AST node exposes ICU options.
     *
     * @param node - Parsed ICU AST node
     * @returns Whether the node has options
     */
    #hasOptions(node: IcuAstNode): node is IcuAstNode & { options: Record<string, { value?: Array<unknown> }> } {
        return typeof node.options === "object" && node.options !== null;
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

    /**
     * Formats an ICU structural signature for issue messages.
     *
     * @param signature - Structural signature
     * @returns Formatted signature
     */
    #formatStructureSignature(signature: Array<IcuStructureSignature>): string {
        return JSON.stringify(signature);
    }
}
