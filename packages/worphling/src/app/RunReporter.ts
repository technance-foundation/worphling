import type { DiffResult, LocaleIssue, ReportFormat, RunReport, RunSummary } from "../types.js";

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
     * Structured issues collected during validation or execution.
     */
    issues: Array<LocaleIssue>;

    /**
     * Whether provider execution failed during the run.
     */
    hasProviderFailure?: boolean;
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
            hasProviderFailure: input.hasProviderFailure,
        };

        return {
            summary,
            issues: [...input.issues],
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
