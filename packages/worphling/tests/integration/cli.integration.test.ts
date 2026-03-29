import fs from "node:fs";
import { assert, test } from "vitest";

import type { RunReport } from "../../src/types.js";
import { ExitCode } from "../../src/types.js";

import { createCliIntegrationWorkspace } from "./createCliIntegrationWorkspace.js";

test("cli shows help when no command is provided", async () => {
    const workspace = createCliIntegrationWorkspace({
        config: {
            validation: {
                preservePlaceholders: false,
                preserveIcuSyntax: false,
                preserveHtmlTags: false,
                failOnExtraKeys: false,
                failOnMissingKeys: true,
                failOnModifiedSource: false,
            },
        },
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    try {
        const result = await workspace.runCli([]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Worphling/i);
        assert.match(result.stdout, /Commands/i);
        assert.match(result.stdout, /check/i);
        assert.match(result.stdout, /translate/i);
        assert.match(result.stdout, /fix/i);
        assert.match(result.stdout, /sync/i);
        assert.match(result.stdout, /report/i);
        assert.notMatch(result.stdout, /Found 1 missing translations across all languages\./);
        assert.equal(fs.existsSync(workspace.reportFilePath), false);
    } finally {
        workspace.cleanup();
    }
});

test("cli --config uses an explicit config file path", async () => {
    const workspace = createCliIntegrationWorkspace({
        config: {
            validation: {
                preservePlaceholders: false,
                preserveIcuSyntax: false,
                preserveHtmlTags: false,
                failOnExtraKeys: false,
                failOnMissingKeys: true,
                failOnModifiedSource: false,
            },
        },
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    const defaultConfigPath = pathJoin(workspace.rootDirectoryPath, "worphling.config.mjs");
    const customConfigPath = pathJoin(workspace.rootDirectoryPath, "custom.worphling.config.mjs");

    try {
        fs.renameSync(defaultConfigPath, customConfigPath);

        const result = await workspace.runCli(["check", "--config", customConfigPath, "--report-file", workspace.reportFilePath]);

        assert.equal(result.exitCode, ExitCode.ValidationError);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 missing translations across all languages\./);

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(report.summary.command, "check");
        assert.equal(report.summary.missingCount, 1);
    } finally {
        workspace.cleanup();
    }
});

test("cli check exits with ValidationError when missing keys are configured as errors", async () => {
    const workspace = createCliIntegrationWorkspace({
        config: {
            validation: {
                preservePlaceholders: false,
                preserveIcuSyntax: false,
                preserveHtmlTags: false,
                failOnExtraKeys: false,
                failOnMissingKeys: true,
                failOnModifiedSource: false,
            },
        },
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    try {
        const result = await workspace.runCli(["check", "--report-file", workspace.reportFilePath]);

        assert.equal(result.exitCode, ExitCode.ValidationError);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 missing translations across all languages\./);
        assert.match(result.stdout, /Running in analysis mode\./);
        assert.match(result.stdout, /Success: Report written to /);

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(report.summary.command, "check");
        assert.equal(report.summary.missingCount, 1);
        assert.equal(report.summary.hasChanges, true);
        assert.equal(
            report.issues.some((issue) => issue.type === "missing" && issue.severity === "error"),
            true,
        );
    } finally {
        workspace.cleanup();
    }
});

test("cli check --fail-on-changes returns ChangesDetected when changes exist", async () => {
    const workspace = createCliIntegrationWorkspace({
        config: {
            validation: {
                preservePlaceholders: false,
                preserveIcuSyntax: false,
                preserveHtmlTags: false,
                failOnExtraKeys: false,
                failOnMissingKeys: false,
                failOnModifiedSource: false,
            },
        },
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    try {
        const result = await workspace.runCli(["check", "--fail-on-changes", "--report-file", workspace.reportFilePath]);

        assert.equal(result.exitCode, ExitCode.ChangesDetected);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 missing translations across all languages\./);

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(report.summary.hasChanges, true);
        assert.equal(report.summary.missingCount, 1);
    } finally {
        workspace.cleanup();
    }
});

test("cli check --fail-on-warnings returns ValidationError for warning issues", async () => {
    const workspace = createCliIntegrationWorkspace({
        config: {
            validation: {
                preservePlaceholders: false,
                preserveIcuSyntax: false,
                preserveHtmlTags: false,
                failOnExtraKeys: false,
                failOnMissingKeys: false,
                failOnModifiedSource: false,
            },
        },
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    try {
        const result = await workspace.runCli(["check", "--fail-on-warnings", "--report-file", workspace.reportFilePath]);

        assert.equal(result.exitCode, ExitCode.ValidationError);
        assert.equal(result.stderr, "");

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(
            report.issues.some((issue) => issue.severity === "warning"),
            true,
        );
    } finally {
        workspace.cleanup();
    }
});

test("cli check --locales limits analysis to selected locales", async () => {
    const workspace = createCliIntegrationWorkspace({
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
            es: {
                greeting: "Hola",
            },
        },
    });

    try {
        const result = await workspace.runCli(["check", "--locales", "fa", "--report-file", workspace.reportFilePath]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 missing translations across all languages\./);

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.deepEqual(report.summary.targetLocales, ["fa"]);
        assert.equal(report.summary.missingCount, 1);
        assert.equal(
            report.issues.every((issue) => issue.locale === "fa"),
            true,
        );
    } finally {
        workspace.cleanup();
    }
});

test("cli check writes a JSON report file from runtime config", async () => {
    const workspace = createCliIntegrationWorkspace({
        config: {
            runtime: {
                reportFile: "./artifacts/worphling-report.json",
                failOnChanges: false,
                failOnWarnings: false,
            },
        },
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    try {
        const result = await workspace.runCli(["check"]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 missing translations across all languages\./);
        assert.match(result.stdout, /Running in analysis mode\./);
        assert.match(result.stdout, /Success: Report written to /);

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(report.summary.command, "check");
        assert.equal(report.summary.missingCount, 1);
        assert.equal(report.summary.hasChanges, true);
    } finally {
        workspace.cleanup();
    }
});

test("cli fix --write removes extra keys from disk", async () => {
    const workspace = createCliIntegrationWorkspace({
        locales: {
            en: {
                greeting: "Hello",
            },
            fa: {
                greeting: "سلام",
                obsolete: "remove me",
            },
        },
    });

    try {
        const result = await workspace.runCli(["fix", "--write"]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 extra translation key across all languages\./);
        assert.match(result.stdout, /Applying planned locale changes\.\.\./);
        assert.match(result.stdout, /Success: File written for locale "fa"/);

        const localeFile = workspace.readLocale("fa");

        assert.deepEqual(localeFile, {
            greeting: "سلام",
        });
    } finally {
        workspace.cleanup();
    }
});

test("cli fix without --write does not modify disk and shows write guidance", async () => {
    const workspace = createCliIntegrationWorkspace({
        locales: {
            en: {
                greeting: "Hello",
            },
            fa: {
                greeting: "سلام",
                obsolete: "remove me",
            },
        },
    });

    try {
        const result = await workspace.runCli(["fix"]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 extra translation key across all languages\./);
        assert.match(result.stdout, /Run with --write to apply planned locale changes\./);
        assert.notMatch(result.stdout, /Success: File written for locale "fa"/);

        const localeFile = workspace.readLocale("fa");

        assert.deepEqual(localeFile, {
            greeting: "سلام",
            obsolete: "remove me",
        });
    } finally {
        workspace.cleanup();
    }
});

test("cli sync --write removes extra keys when no translation work is needed", async () => {
    const workspace = createCliIntegrationWorkspace({
        locales: {
            en: {
                greeting: "Hello",
            },
            fa: {
                greeting: "سلام",
                obsolete: "remove me",
            },
        },
    });

    try {
        const result = await workspace.runCli(["sync", "--write"]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 extra translation key across all languages\./);
        assert.match(result.stdout, /Applying planned locale changes\.\.\./);
        assert.match(result.stdout, /Success: File written for locale "fa"/);

        const localeFile = workspace.readLocale("fa");

        assert.deepEqual(localeFile, {
            greeting: "سلام",
        });
    } finally {
        workspace.cleanup();
    }
});

test("cli sync --dry-run does not modify disk", async () => {
    const workspace = createCliIntegrationWorkspace({
        locales: {
            en: {
                greeting: "Hello",
            },
            fa: {
                greeting: "سلام",
                obsolete: "remove me",
            },
        },
    });

    try {
        const result = await workspace.runCli(["sync", "--dry-run", "--report-file", workspace.reportFilePath]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 extra translation key across all languages\./);
        assert.match(result.stdout, /Dry-run mode is active\. Changes will not be written\./);
        assert.notMatch(result.stdout, /Success: File written for locale "fa"/);

        const localeFile = workspace.readLocale("fa");

        assert.deepEqual(localeFile, {
            greeting: "سلام",
            obsolete: "remove me",
        });

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(report.summary.command, "sync");
        assert.equal(report.summary.extraCount, 1);
        assert.equal(report.summary.writtenFileCount, 0);
    } finally {
        workspace.cleanup();
    }
});

test("cli report writes markdown when report file ends with .md", async () => {
    const workspace = createCliIntegrationWorkspace({
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    const markdownReportPath = pathJoin(workspace.rootDirectoryPath, "artifacts", "cli-report.md");

    try {
        const result = await workspace.runCli(["report", "--report-file", markdownReportPath]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 missing translations across all languages\./);
        assert.match(result.stdout, /Running in analysis mode\./);
        assert.match(result.stdout, /# Worphling Run Report/);
        assert.match(result.stdout, /## Summary/);
        assert.match(result.stdout, /## Issues/);
        assert.match(result.stdout, /Success: Report written to /);

        const markdownContent = workspace.readTextFile(markdownReportPath);

        assert.match(markdownContent, /# Worphling Run Report/);
        assert.match(markdownContent, /## Summary/);
        assert.match(markdownContent, /## Issues/);
    } finally {
        workspace.cleanup();
    }
});

test("cli report --report-format json overrides markdown file extension", async () => {
    const workspace = createCliIntegrationWorkspace({
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    const markdownNamedReportPath = pathJoin(workspace.rootDirectoryPath, "artifacts", "override-report.md");

    try {
        const result = await workspace.runCli(["report", "--report-format", "json", "--report-file", markdownNamedReportPath]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /"summary":/);

        const report = workspace.readJsonFile<RunReport>(markdownNamedReportPath);

        assert.equal(report.summary.command, "report");
        assert.equal(report.summary.missingCount, 1);
    } finally {
        workspace.cleanup();
    }
});

test("cli report --report-format markdown overrides json default for file output", async () => {
    const workspace = createCliIntegrationWorkspace({
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    const plainTextReportPath = pathJoin(workspace.rootDirectoryPath, "artifacts", "override-report.txt");

    try {
        const result = await workspace.runCli(["report", "--report-format", "markdown", "--report-file", plainTextReportPath]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /# Worphling Run Report/);

        const markdownContent = workspace.readTextFile(plainTextReportPath);

        assert.match(markdownContent, /# Worphling Run Report/);
        assert.match(markdownContent, /## Summary/);
    } finally {
        workspace.cleanup();
    }
});

test("cli translate without --write remains non-mutating and does not require provider execution", async () => {
    const workspace = createCliIntegrationWorkspace({
        locales: {
            en: {
                greeting: "Hello",
                farewell: "Goodbye",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    try {
        const result = await workspace.runCli(["translate", "--report-file", workspace.reportFilePath]);

        assert.equal(result.exitCode, ExitCode.Success);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Found 1 missing translations across all languages\./);
        assert.match(result.stdout, /Run with --write to apply planned locale changes\./);

        const localeFile = workspace.readLocale("fa");

        assert.deepEqual(localeFile, {
            greeting: "سلام",
        });

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(report.summary.command, "translate");
        assert.equal(report.summary.missingCount, 1);
        assert.equal(report.summary.translatedCount, 0);
        assert.equal(report.summary.writtenFileCount, 0);
    } finally {
        workspace.cleanup();
    }
});

/**
 * Joins path segments for test-owned artifact paths.
 *
 * @param segments - Path segments
 * @returns Joined path
 */
function pathJoin(...segments: Array<string>): string {
    return segments.join("/").replace(/\/+/g, "/");
}
