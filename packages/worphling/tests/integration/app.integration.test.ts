import { assert, test } from "vitest";

import type { RunReport } from "../../src/types.js";
import { ExitCode } from "../../src/types.js";

import { createIntegrationWorkspace } from "./createIntegrationWorkspace.js";

test("check returns ValidationError when missing keys are configured as errors", async () => {
    const workspace = createIntegrationWorkspace({
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
        const exitCode = await workspace.run({
            command: "check",
        });

        assert.equal(exitCode, ExitCode.ValidationError);
    } finally {
        workspace.cleanup();
    }
});

test("fix removes extra keys and writes using the configured filePattern extension", async () => {
    const workspace = createIntegrationWorkspace({
        config: {
            filePattern: "*.jsonc",
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
            },
            fa: {
                greeting: "سلام",
                obsolete: "remove me",
            },
        },
    });

    try {
        const exitCode = await workspace.run({
            command: "fix",
            write: true,
        });

        assert.equal(exitCode, ExitCode.Success);

        const fixedLocale = workspace.readLocale("fa");

        assert.deepEqual(fixedLocale, {
            greeting: "سلام",
        });
    } finally {
        workspace.cleanup();
    }
});

test("ci mode writes a JSON report file for a non-report command", async () => {
    const workspace = createIntegrationWorkspace({
        config: {
            ci: {
                mode: true,
                reportFile: undefined,
                failOnChanges: false,
                failOnWarnings: false,
            },
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
        const exitCode = await workspace.run({
            command: "check",
            ci: true,
            reportFile: workspace.reportFilePath,
        });

        assert.equal(exitCode, ExitCode.Success);

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(report.summary.command, "check");
        assert.equal(report.summary.sourceLocale, "en");
        assert.equal(report.summary.missingCount, 1);
        assert.equal(report.summary.extraCount, 0);
        assert.equal(report.summary.modifiedCount, 0);
        assert.equal(report.summary.hasChanges, true);
    } finally {
        workspace.cleanup();
    }
});

test("git-diff strategy does not report modified keys from snapshot state", async () => {
    const workspace = createIntegrationWorkspace({
        config: {
            detection: {
                strategy: "git-diff",
                snapshotFile: undefined,
            },
            validation: {
                preservePlaceholders: false,
                preserveIcuSyntax: false,
                preserveHtmlTags: false,
                failOnExtraKeys: false,
                failOnMissingKeys: false,
                failOnModifiedSource: true,
            },
            ci: {
                mode: false,
                reportFile: undefined,
                failOnChanges: false,
                failOnWarnings: false,
            },
        },
        locales: {
            en: {
                greeting: "Hello v2",
            },
            fa: {
                greeting: "سلام",
            },
        },
    });

    try {
        const exitCode = await workspace.run({
            command: "check",
            reportFile: workspace.reportFilePath,
        });

        assert.equal(exitCode, ExitCode.Success);

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(report.summary.modifiedCount, 0);
        assert.equal(
            report.issues.some((issue) => issue.type === "modified"),
            false,
        );
    } finally {
        workspace.cleanup();
    }
});

test("report command writes markdown when the report file path ends with .md", async () => {
    const workspace = createIntegrationWorkspace({
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

    const markdownReportPath = `${workspace.rootDirectoryPath}/artifacts/worphling-report.md`;

    try {
        const exitCode = await workspace.run({
            command: "report",
            reportFile: markdownReportPath,
        });

        assert.equal(exitCode, ExitCode.Success);

        const markdownContent = await import("node:fs/promises").then((fs) => fs.readFile(markdownReportPath, "utf-8"));

        assert.match(markdownContent, /# Worphling Run Report/);
        assert.match(markdownContent, /## Summary/);
        assert.match(markdownContent, /## Issues/);
    } finally {
        workspace.cleanup();
    }
});
