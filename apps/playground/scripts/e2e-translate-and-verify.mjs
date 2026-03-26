import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Playground root directory.
 */
const PLAYGROUND_DIRECTORY_PATH = process.cwd();

/**
 * Artifacts directory path.
 */
const ARTIFACTS_DIRECTORY_PATH = path.join(
    PLAYGROUND_DIRECTORY_PATH,
    "artifacts",
);

/**
 * Spanish locale file path.
 */
const ES_LOCALE_FILE_PATH = path.join(
    PLAYGROUND_DIRECTORY_PATH,
    "locales",
    "es.json",
);

/**
 * Translate report path.
 */
const TRANSLATE_REPORT_FILE_PATH = path.join(
    ARTIFACTS_DIRECTORY_PATH,
    "e2e-translate-report.json",
);

/**
 * Check report path.
 */
const CHECK_REPORT_FILE_PATH = path.join(
    ARTIFACTS_DIRECTORY_PATH,
    "e2e-check-report.json",
);

ensureOpenAiApiKey();
prepareArtifactsDirectory();

const originalEsLocale = readJsonFile(ES_LOCALE_FILE_PATH);
const originalFlatEsLocale = flattenLocaleObject(originalEsLocale);

assert(
    originalFlatEsLocale["app.auth.login.errors.accountLocked"] === undefined,
    'Expected playground/locales/es.json to start with missing translation key "app.auth.login.errors.accountLocked". Run this e2e only from a clean checkout.',
);

runCommand(
    "pnpm",
    [
        "exec",
        "worphling",
        "translate",
        "--write",
        "--report-file",
        "./artifacts/e2e-translate-report.json",
    ],
    PLAYGROUND_DIRECTORY_PATH,
);

const translateReport = readJsonFile(TRANSLATE_REPORT_FILE_PATH);
const translatedEsLocale = readJsonFile(ES_LOCALE_FILE_PATH);
const translatedFlatEsLocale = flattenLocaleObject(translatedEsLocale);

assert(
    translateReport.summary.command === "translate",
    'Expected translate report command to be "translate".',
);
assert(
    translateReport.summary.translatedCount >= 14,
    `Expected translatedCount to be at least 14, received ${String(translateReport.summary.translatedCount)}.`,
);
assert(
    translateReport.summary.writtenFileCount >= 1,
    `Expected writtenFileCount to be at least 1, received ${String(translateReport.summary.writtenFileCount)}.`,
);

const expectedTranslatedKeys = [
    "app.auth.login.errors.accountLocked",
    "app.auth.login.errors.invalidCredentials",
    "app.auth.login.placeholders.password",
    "app.auth.login.placeholders.username",
    "app.auth.login.title",
    "app.auth.signup.agreements.terms",
    "app.auth.signup.buttons.submit",
    "app.auth.signup.placeholders.email",
    "app.auth.signup.placeholders.password",
    "app.auth.signup.placeholders.username",
    "app.auth.signup.title",
    "app.auth.trade.description",
    "app.auth.trade.status",
    "app.auth.trade.title",
];

for (const key of expectedTranslatedKeys) {
    assert(
        typeof translatedFlatEsLocale[key] === "string" &&
            translatedFlatEsLocale[key].trim().length > 0,
        `Expected translated Spanish key "${key}" to exist and be non-empty after translate.`,
    );
}

assert(
    translatedFlatEsLocale["app.auth.trade.description"].includes(
        "{totalPayment}",
    ),
    'Expected translated ICU message "app.auth.trade.description" to preserve "{totalPayment}".',
);
assert(
    translatedFlatEsLocale["app.auth.trade.description"].includes(
        "{orderMode, select,",
    ),
    'Expected translated ICU message "app.auth.trade.description" to preserve the select structure.',
);
assert(
    translatedFlatEsLocale["app.auth.trade.status"].includes(
        "{status, select,",
    ),
    'Expected translated ICU message "app.auth.trade.status" to preserve the select structure.',
);
assert(
    translatedFlatEsLocale["app.auth.trade.title"].includes("{status, select,"),
    'Expected translated ICU message "app.auth.trade.title" to preserve the select structure.',
);

runCommand(
    "pnpm",
    [
        "exec",
        "worphling",
        "check",
        "--report-file",
        "./artifacts/e2e-check-report.json",
    ],
    PLAYGROUND_DIRECTORY_PATH,
);

const checkReport = readJsonFile(CHECK_REPORT_FILE_PATH);

assert(
    checkReport.summary.command === "check",
    'Expected check report command to be "check".',
);
assert(
    checkReport.summary.missingCount === 0,
    `Expected missingCount to be 0 after translate, received ${String(checkReport.summary.missingCount)}.`,
);
assert(
    checkReport.summary.extraCount === 0,
    `Expected extraCount to be 0 after translate, received ${String(checkReport.summary.extraCount)}.`,
);
assert(
    checkReport.summary.modifiedCount === 0,
    `Expected modifiedCount to be 0 after translate, received ${String(checkReport.summary.modifiedCount)}.`,
);

console.log("[E2E] Playground translate + check verification passed.");

/**
 * Ensures the OpenAI API key is available.
 */
function ensureOpenAiApiKey() {
    assert(
        Boolean(process.env.OPENAI_API_KEY),
        "Missing OPENAI_API_KEY environment variable.",
    );
}

/**
 * Prepares the artifacts directory.
 */
function prepareArtifactsDirectory() {
    fs.mkdirSync(ARTIFACTS_DIRECTORY_PATH, { recursive: true });

    if (fs.existsSync(TRANSLATE_REPORT_FILE_PATH)) {
        fs.rmSync(TRANSLATE_REPORT_FILE_PATH);
    }

    if (fs.existsSync(CHECK_REPORT_FILE_PATH)) {
        fs.rmSync(CHECK_REPORT_FILE_PATH);
    }
}

/**
 * Runs a command and throws on failure.
 *
 * @param {string} command - Command name
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory
 */
function runCommand(command, args, cwd) {
    console.log(`[E2E] Running: ${command} ${args.join(" ")}`);

    const result = spawnSync(command, args, {
        cwd,
        env: process.env,
        stdio: "inherit",
        shell: false,
    });

    assert(result.status === 0, `Command failed: ${command} ${args.join(" ")}`);
}

/**
 * Reads a JSON file.
 *
 * @template T
 * @param {string} filePath - JSON file path
 * @returns {T} Parsed JSON content
 */
function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Flattens a nested locale object into dot-notated keys.
 *
 * @param {Record<string, unknown>} value - Locale object
 * @param {string} [currentPath]
 * @param {Record<string, string>} [result]
 * @returns {Record<string, string>} Flattened locale object
 */
function flattenLocaleObject(value, currentPath = "", result = {}) {
    for (const [key, entryValue] of Object.entries(value)) {
        const nextPath = currentPath ? `${currentPath}.${key}` : key;

        if (typeof entryValue === "string") {
            result[nextPath] = entryValue;
            continue;
        }

        if (isPlainObject(entryValue)) {
            flattenLocaleObject(entryValue, nextPath, result);
        }
    }

    return result;
}

/**
 * Returns whether the provided value is a plain object.
 *
 * @param {unknown} value - Value to test
 * @returns {value is Record<string, unknown>} Whether the value is a plain object
 */
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Throws when the condition is not satisfied.
 *
 * @param {unknown} condition - Condition to evaluate
 * @param {string} message - Error message
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
