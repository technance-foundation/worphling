import { assert, test } from "vitest";

import type { RunReport } from "../../src/types.js";
import { ExitCode } from "../../src/types.js";

import { createCliIntegrationWorkspace } from "./createCliIntegrationWorkspace.js";

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

        const localeFile = workspace.readLocale("fa");

        assert.deepEqual(localeFile, {
            greeting: "سلام",
        });

        assert.match(result.stdout, /Success: File written for locale "fa"/);
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

        const markdownContent = workspace.readTextFile(markdownReportPath);

        assert.match(markdownContent, /# Worphling Run Report/);
        assert.match(markdownContent, /## Summary/);
        assert.match(markdownContent, /## Issues/);
        assert.match(result.stdout, /# Worphling Run Report/);
    } finally {
        workspace.cleanup();
    }
});

test("cli check in CI mode writes a JSON report file", async () => {
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
        const result = await workspace.runCli(["check", "--ci", "--report-file", workspace.reportFilePath]);

        assert.equal(result.exitCode, ExitCode.Success);

        const report = workspace.readJsonFile<RunReport>(workspace.reportFilePath);

        assert.equal(report.summary.command, "check");
        assert.equal(report.summary.missingCount, 1);
        assert.equal(report.summary.hasChanges, true);
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

        const localeFile = workspace.readLocale("fa");

        assert.deepEqual(localeFile, {
            greeting: "سلام",
        });
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
