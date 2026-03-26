import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { App, ConfigLoader } from "../../src/app/index.js";
import type { CliFlags, Config, LocaleFile } from "../../src/types.js";

/**
 * Input for creating an isolated integration-test workspace.
 */
interface CreateIntegrationWorkspaceInput {
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
 * Runtime handle for an isolated integration-test workspace.
 */
export interface IntegrationWorkspace {
    /**
     * Root temporary directory for the workspace.
     */
    rootDirectoryPath: string;

    /**
     * Locales directory path used by the generated config.
     */
    localesDirectoryPath: string;

    /**
     * Config file path used by the generated config loader.
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
     * Runs the application with the provided CLI flag overrides.
     *
     * @param flags - Partial CLI flags
     * @returns Process exit code returned by `App.run()`
     */
    run(flags?: Partial<CliFlags>): Promise<number>;

    /**
     * Reads and parses a locale file from disk.
     *
     * @param locale - Locale code
     * @returns Parsed locale file
     */
    readLocale(locale: string): LocaleFile;

    /**
     * Reads and parses a JSON file from disk.
     *
     * @param filePath - JSON file path
     * @returns Parsed JSON value
     */
    readJsonFile<T>(filePath: string): T;

    /**
     * Writes a raw JSON file to disk.
     *
     * @param filePath - Target file path
     * @param value - JSON value to serialize
     */
    writeJsonFile(filePath: string, value: unknown): void;

    /**
     * Removes the temporary workspace.
     */
    cleanup(): void;
}

/**
 * Creates an isolated on-disk workspace for end-to-end integration tests.
 *
 * This helper intentionally exercises:
 * - `ConfigLoader`
 * - `App`
 * - repository filesystem behavior
 * - command semantics and exit-code behavior
 *
 * It does not call any domain classes directly.
 *
 * @param input - Workspace setup input
 * @returns Integration workspace handle
 */
export function createIntegrationWorkspace(input: CreateIntegrationWorkspaceInput = {}): IntegrationWorkspace {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "worphling-integration-"));
    const localesDirectoryPath = path.join(rootDirectoryPath, "locales");
    const snapshotFilePath = path.join(rootDirectoryPath, ".worphling-snapshot.json");
    const reportFilePath = path.join(rootDirectoryPath, "artifacts", "worphling-report.json");
    const configFilePath = path.join(rootDirectoryPath, "worphling.config.mjs");

    fs.mkdirSync(localesDirectoryPath, { recursive: true });

    const baseConfig: Config = {
        sourceLocale: "en",
        localesDir: localesDirectoryPath,
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
            snapshotFile: snapshotFilePath,
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
            reportFile: reportFilePath,
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
            greeting: "Hello",
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

        async run(flags: Partial<CliFlags> = {}): Promise<number> {
            const configLoader = new ConfigLoader(configFilePath);
            const resolvedConfig = await configLoader.load();

            const app = new App({
                config: resolvedConfig,
                flags: {
                    command: "check",
                    dryRun: false,
                    write: false,
                    ci: false,
                    failOnChanges: false,
                    failOnWarnings: false,
                    ...flags,
                },
            });

            return app.run();
        },

        readLocale(locale: string): LocaleFile {
            const filePath = path.join(localesDirectoryPath, `${locale}${fileExtension}`);
            return JSON.parse(fs.readFileSync(filePath, "utf-8")) as LocaleFile;
        },

        readJsonFile<T>(filePath: string): T {
            return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
        },

        writeJsonFile(filePath: string, value: unknown): void {
            const directoryPath = path.dirname(filePath);

            if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath, { recursive: true });
            }

            fs.writeFileSync(filePath, `${JSON.stringify(value, null, 4)}\n`, "utf-8");
        },

        cleanup(): void {
            fs.rmSync(rootDirectoryPath, { recursive: true, force: true });
        },
    };
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
