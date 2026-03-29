// @ts-check
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
}

/** @type {import('@technance/worphling').Config} */
const config = {
    // --- Core ---
    sourceLocale: "en",
    localesDir: "./locales",
    filePattern: "*.json",

    // --- AI Provider ---
    provider: {
        name: "openai",
        apiKey,
        model: "gpt-5.1-2025-11-13",
        temperature: 0,
    },

    // --- Plugin ---
    plugin: {
        name: "none",
    },

    // --- Snapshot ---
    snapshot: {
        file: "./.worphling/.worphling-snapshot.json",
    },

    // --- Output formatting ---
    output: {
        sortKeys: true,
        preserveIndentation: 2,
        trailingNewline: true,
    },

    // --- Validation ---
    validation: {
        preservePlaceholders: true,
        preserveIcuSyntax: true,
        preserveHtmlTags: true,
        failOnMissingKeys: false,
        failOnExtraKeys: false,
        failOnModifiedSource: false,
    },

    // --- Translation behavior ---
    translation: {
        batchSize: 50,
        concurrency: 2,
        maxRetries: 2,
        exactLength: false,
    },

    // --- Reporting / failure behavior ---
    runtime: {
        reportFile: "./.worphling/worphling-report.json",
        failOnChanges: false,
        failOnWarnings: false,
    },
};

export default config;
