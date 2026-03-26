import type { DiffResult, LocaleIssue, ReportFormat, RunReport, RunSummary, ValidationConfig } from "../types.js";

/**
 * Input required to build a structured run report.
 */
interface RunReportBuildInput {
    /**
     * Command executed for the run.
     */
    command: RunSummary["command"];

    /**
     * Source locale used for the run.
     */
    sourceLocale: string;

    /**
     * Target locales included in the run.
     */
    targetLocales: Array<string>;

    /**
     * Structured diff result for the run.
     */
    diffResult: DiffResult;

    /**
     * Total number of translated keys during execution.
     */
    translatedCount: number;

    /**
     * Total number of files written during execution.
     */
    writtenFileCount: number;

    /**
     * Validation behavior used to classify current diff issues.
     */
    validationConfig: ValidationConfig;
}

/**
 * Builds and serializes structured run reports.
 *
 * The reporting layer is intentionally pure and deterministic so it can later
 * be reused by CI and tests without filesystem coupling.
 */
export class RunReporter {
    /**
     * Builds the structured run report.
     *
     * @param input - Report build input
     * @returns Structured run report
     */
    buildReport(input: RunReportBuildInput): RunReport {
        const issues = this.#buildIssues(input.diffResult, input.validationConfig);

        const summary: RunSummary = {
            command: input.command,
            sourceLocale: input.sourceLocale,
            targetLocales: [...input.targetLocales].sort(),
            missingCount: this.#countFlatLocaleEntries(input.diffResult.missing),
            extraCount: this.#countFlatLocaleEntries(input.diffResult.extra),
            modifiedCount: this.#countFlatLocaleEntries(input.diffResult.modified),
            translatedCount: input.translatedCount,
            writtenFileCount: input.writtenFileCount,
            hasChanges:
                this.#countFlatLocaleEntries(input.diffResult.missing) > 0 ||
                this.#countFlatLocaleEntries(input.diffResult.extra) > 0 ||
                this.#countFlatLocaleEntries(input.diffResult.modified) > 0,
        };

        return {
            summary,
            issues,
        };
    }

    /**
     * Serializes the provided run report.
     *
     * @param report - Structured run report
     * @param format - Output format
     * @returns Serialized report content
     */
    serialize(report: RunReport, format: ReportFormat): string {
        if (format === "markdown") {
            return this.#serializeMarkdown(report);
        }

        return `${JSON.stringify(report, null, 2)}\n`;
    }

    /**
     * Builds structured issues from the current diff state.
     *
     * This intentionally uses the already-declared issue model so current CI and
     * reporting behavior can rely on explicit severity even before the full
     * validation engine is introduced.
     *
     * @param diffResult - Structured diff result
     * @param validationConfig - Validation behavior configuration
     * @returns Deterministically ordered issues
     */
    #buildIssues(diffResult: DiffResult, validationConfig: ValidationConfig): Array<LocaleIssue> {
        const issues: Array<LocaleIssue> = [];

        issues.push(
            ...this.#buildDiffIssues(
                diffResult.missing,
                "missing",
                validationConfig.failOnMissingKeys ? "error" : "warning",
                "Missing translation entry.",
            ),
        );

        issues.push(
            ...this.#buildDiffIssues(
                diffResult.extra,
                "extra",
                validationConfig.failOnExtraKeys ? "error" : "warning",
                "Extra translation entry not present in source locale.",
            ),
        );

        issues.push(
            ...this.#buildDiffIssues(
                diffResult.modified,
                "modified",
                validationConfig.failOnModifiedSource ? "error" : "warning",
                "Source translation changed and requires retranslation.",
            ),
        );

        return issues.sort((left, right) => {
            const localeComparison = left.locale.localeCompare(right.locale);

            if (localeComparison !== 0) {
                return localeComparison;
            }

            const keyComparison = left.key.localeCompare(right.key);

            if (keyComparison !== 0) {
                return keyComparison;
            }

            return left.type.localeCompare(right.type);
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
     * Serializes the report as markdown.
     *
     * @param report - Structured run report
     * @returns Markdown report
     */
    #serializeMarkdown(report: RunReport): string {
        const { summary, issues } = report;

        const lines = [
            "# Worphling Run Report",
            "",
            "## Summary",
            "",
            `- Command: \`${summary.command}\``,
            `- Source locale: \`${summary.sourceLocale}\``,
            `- Target locales: ${summary.targetLocales.length > 0 ? summary.targetLocales.map((locale) => `\`${locale}\``).join(", ") : "None"}`,
            `- Missing keys: ${summary.missingCount}`,
            `- Extra keys: ${summary.extraCount}`,
            `- Modified keys: ${summary.modifiedCount}`,
            `- Translated keys: ${summary.translatedCount}`,
            `- Written files: ${summary.writtenFileCount}`,
            `- Has changes: ${summary.hasChanges ? "Yes" : "No"}`,
            "",
            "## Issues",
            "",
        ];

        if (issues.length === 0) {
            lines.push("No issues recorded.");
            lines.push("");

            return `${lines.join("\n")}\n`;
        }

        lines.push("| Severity | Type | Locale | Key | Message |");
        lines.push("| --- | --- | --- | --- | --- |");

        for (const issue of issues) {
            lines.push(
                `| ${issue.severity} | ${issue.type} | \`${issue.locale}\` | \`${issue.key}\` | ${this.#escapeMarkdownTableCell(issue.message)} |`,
            );
        }

        lines.push("");

        return `${lines.join("\n")}\n`;
    }

    /**
     * Escapes markdown table cell content.
     *
     * @param value - Raw cell value
     * @returns Escaped cell value
     */
    #escapeMarkdownTableCell(value: string): string {
        return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
    }

    /**
     * Counts the total number of flat translation entries across all locales.
     *
     * @param localeFiles - Flat locale files grouped by locale
     * @returns Total entry count
     */
    #countFlatLocaleEntries(localeFiles: Record<string, Record<string, string>>): number {
        return Object.values(localeFiles).reduce((total, entries) => total + Object.keys(entries).length, 0);
    }
}
