import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { Config, LocaleFile } from "../../src/types.js";

const execFileAsync = promisify(execFile);

/**
 * Input for creating a CLI integration-test workspace.
 */
interface CreateCliIntegrationWorkspaceInput {
    /**
     * Partial config overrides for the generated runtime config.
     */
    config?: Partial<Config>;

    /**
     * Locale file contents keyed by locale code.
     */
    locales?: Record<string, LocaleFile>;
}

/**
 * Result returned from executing the CLI.
 */
export interface CliExecutionResult {
    /**
     * Process exit code.
     */
    exitCode: number;

    /**
     * Captured standard output.
     */
    stdout: string;

    /**
     * Captured standard error.
     */
    stderr: string;
}

/**
 * Runtime handle for a CLI integration-test workspace.
 */
export interface CliIntegrationWorkspace {
    /**
     * Root temporary directory for the workspace.
     */
    rootDirectoryPath: string;

    /**
     * Locales directory path used by the generated config.
     */
    localesDirectoryPath: string;

    /**
     * Config file path written into the workspace.
     */
    configFilePath: string;

    /**
     * Snapshot file path used by the generated config.
     */
    snapshotFilePath: string;

    /**
     * CI report file path used by the generated config.
     */
    reportFilePath: string;

    /**
     * Executes the built CLI with the provided arguments from the workspace cwd.
     *
     * @param args - CLI arguments
     * @returns Captured CLI execution result
     */
    runCli(args: Array<string>): Promise<CliExecutionResult>;

    /**
     * Reads and parses a locale file from disk.
     *
     * @param locale - Locale code
     * @returns Parsed locale file
     */
    readLocale(locale: string): LocaleFile;

    /**
     * Reads a file from disk as UTF-8 text.
     *
     * @param filePath - File path
     * @returns File content
     */
    readTextFile(filePath: string): string;

    /**
     * Reads and parses a JSON file from disk.
     *
     * @param filePath - JSON file path
     * @returns Parsed JSON value
     */
    readJsonFile<T>(filePath: string): T;

    /**
     * Removes the temporary workspace.
     */
    cleanup(): void;
}

/**
 * Cached build promise so the CLI artifact is built only once per test run.
 */
let builtCliPromise: Promise<string> | null = null;

/**
 * Creates an isolated workspace for CLI process integration tests.
 *
 * This helper exercises the actual built CLI entrypoint while keeping the
 * filesystem isolated per test.
 *
 * @param input - Workspace setup input
 * @returns CLI integration workspace
 */
export function createCliIntegrationWorkspace(input: CreateCliIntegrationWorkspaceInput = {}): CliIntegrationWorkspace {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "worphling-cli-integration-"));
    const localesDirectoryPath = path.join(rootDirectoryPath, "locales");
    const snapshotFilePath = path.join(rootDirectoryPath, ".worphling-snapshot.json");
    const reportFilePath = path.join(rootDirectoryPath, "artifacts", "worphling-report.json");
    const configFilePath = path.join(rootDirectoryPath, "worphling.config.mjs");

    fs.mkdirSync(localesDirectoryPath, { recursive: true });

    const baseConfig: Config = {
        sourceLocale: "en",
        localesDir: "./locales",
        filePattern: "*.json",
        provider: {
            name: "openai",
            apiKey: "test-api-key",
            model: "gpt-5.1-2025-11-13",
            temperature: 0,
        },
        plugin: {
            name: "none",
        },
        detection: {
            strategy: "snapshot",
            snapshotFile: "./.worphling-snapshot.json",
        },
        output: {
            sortKeys: true,
            preserveIndentation: 4,
            trailingNewline: true,
        },
        validation: {
            preservePlaceholders: false,
            preserveIcuSyntax: false,
            preserveHtmlTags: false,
            failOnExtraKeys: false,
            failOnMissingKeys: false,
            failOnModifiedSource: false,
        },
        translation: {
            batchSize: 50,
            maxRetries: 0,
            concurrency: 1,
            exactLength: false,
        },
        ci: {
            mode: false,
            reportFile: "./artifacts/worphling-report.json",
            failOnChanges: false,
            failOnWarnings: false,
        },
    };

    const mergedConfig: Config = {
        ...baseConfig,
        ...input.config,
        provider: {
            ...baseConfig.provider,
            ...input.config?.provider,
        },
        plugin: {
            ...baseConfig.plugin,
            ...input.config?.plugin,
        },
        detection: {
            ...baseConfig.detection,
            ...input.config?.detection,
        },
        output: {
            ...baseConfig.output,
            ...input.config?.output,
        },
        validation: {
            ...baseConfig.validation,
            ...input.config?.validation,
        },
        translation: {
            ...baseConfig.translation,
            ...input.config?.translation,
        },
        ci: {
            ...baseConfig.ci,
            ...input.config?.ci,
        },
    };

    const fileExtension = extractFileExtensionFromPattern(mergedConfig.filePattern);
    const locales = input.locales || {
        en: {
            greeting: "Hello",
        },
        fa: {
            greeting: "سلام",
        },
    };

    for (const [locale, content] of Object.entries(locales)) {
        const filePath = path.join(localesDirectoryPath, `${locale}${fileExtension}`);
        fs.writeFileSync(filePath, `${JSON.stringify(content, null, 4)}\n`, "utf-8");
    }

    fs.writeFileSync(configFilePath, `export default ${JSON.stringify(mergedConfig, null, 4)};\n`, "utf-8");

    return {
        rootDirectoryPath,
        localesDirectoryPath,
        configFilePath,
        snapshotFilePath,
        reportFilePath,

        async runCli(args: Array<string>): Promise<CliExecutionResult> {
            const cliEntryPath = await ensureBuiltCliAvailable();

            try {
                const result = await execFileAsync("node", [cliEntryPath, ...args], {
                    cwd: rootDirectoryPath,
                    env: {
                        ...process.env,
                    },
                });

                return {
                    exitCode: 0,
                    stdout: result.stdout,
                    stderr: result.stderr,
                };
            } catch (error) {
                const executionError = error as NodeJS.ErrnoException & {
                    code?: number;
                    stdout?: string;
                    stderr?: string;
                };

                return {
                    exitCode: typeof executionError.code === "number" ? executionError.code : 1,
                    stdout: executionError.stdout || "",
                    stderr: executionError.stderr || "",
                };
            }
        },

        readLocale(locale: string): LocaleFile {
            const filePath = path.join(localesDirectoryPath, `${locale}${fileExtension}`);
            return JSON.parse(fs.readFileSync(filePath, "utf-8")) as LocaleFile;
        },

        readTextFile(filePath: string): string {
            return fs.readFileSync(filePath, "utf-8");
        },

        readJsonFile<T>(filePath: string): T {
            return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
        },

        cleanup(): void {
            fs.rmSync(rootDirectoryPath, { recursive: true, force: true });
        },
    };
}

/**
 * Ensures the built CLI artifact exists and returns its absolute path.
 *
 * The build is executed once and then cached for the remainder of the test run.
 *
 * @returns Absolute path to the built CLI entrypoint
 */
async function ensureBuiltCliAvailable(): Promise<string> {
    if (!builtCliPromise) {
        builtCliPromise = buildCliAndResolveEntryPath();
    }

    return builtCliPromise;
}

/**
 * Builds the package CLI and resolves the emitted entrypoint path.
 *
 * @returns Absolute path to the built CLI entrypoint
 */
async function buildCliAndResolveEntryPath(): Promise<string> {
    const currentFilePath = fileURLToPath(import.meta.url);
    const currentDirectoryPath = path.dirname(currentFilePath);
    const packageDirectoryPath = path.resolve(currentDirectoryPath, "..", "..");
    const builtCliPath = path.join(packageDirectoryPath, "dist", "index.mjs");

    await runPnpmCommand(["build"], packageDirectoryPath);

    if (!fs.existsSync(builtCliPath)) {
        throw new Error(`Built CLI entrypoint was not found at "${builtCliPath}".`);
    }

    return builtCliPath;
}

/**
 * Runs pnpm in a cross-platform way.
 *
 * On Windows, pnpm is exposed as a `.cmd` shim and must be executed through
 * `cmd.exe`. On Unix-like systems it can be executed directly.
 *
 * @param args - pnpm arguments
 * @param cwd - Working directory
 * @returns Completed process result
 */
async function runPnpmCommand(
    args: Array<string>,
    cwd: string,
): Promise<{
    stdout: string;
    stderr: string;
}> {
    if (process.platform === "win32") {
        return execFileAsync("cmd.exe", ["/d", "/s", "/c", "pnpm", ...args], {
            cwd,
            env: {
                ...process.env,
            },
        });
    }

    return execFileAsync("pnpm", args, {
        cwd,
        env: {
            ...process.env,
        },
    });
}

/**
 * Extracts a file extension from a suffix-style locale file pattern.
 *
 * @param filePattern - Configured file pattern
 * @returns File extension including the leading dot
 */
function extractFileExtensionFromPattern(filePattern: string): string {
    if (!filePattern.startsWith("*.") || filePattern.length <= 2) {
        throw new Error(`Unsupported test file pattern "${filePattern}".`);
    }

    return filePattern.slice(1);
}
