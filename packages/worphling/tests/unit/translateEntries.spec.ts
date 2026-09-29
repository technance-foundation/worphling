import { beforeEach, describe, expect, it, vi } from "vitest";

import { translateEntries } from "../../src/app/translateEntries.js";
import { ConfigValidationError } from "../../src/errors.js";
import type { FlatLocaleFile, TranslationBatch, TranslationBatchResult, TranslationProviderContract } from "../../src/types.js";

const { createCompletion } = vi.hoisted(() => ({ createCompletion: vi.fn() }));

vi.mock("openai", () => ({
    OpenAI: class {
        chat = { completions: { create: createCompletion } };
    },
}));

/**
 * Fake provider plus the batches it received.
 */
interface FakeProvider {
    provider: TranslationProviderContract;
    batches: Array<TranslationBatch>;
}

/**
 * Creates a hand-written provider that records every batch it receives.
 *
 * @param translate - Function producing the translated entries for a batch
 * @returns Fake provider and its recorded batches
 */
function createFakeProvider(translate: (batch: TranslationBatch) => FlatLocaleFile): FakeProvider {
    const batches: Array<TranslationBatch> = [];

    return {
        batches,
        provider: {
            name: "openai",
            async translate(batch: TranslationBatch): Promise<TranslationBatchResult> {
                batches.push(batch);

                return { locale: batch.locale, entries: translate(batch) };
            },
        },
    };
}

/**
 * Creates a fake provider that answers from a fixed key-to-translation map.
 *
 * @param translations - Fixed translations keyed by source key
 * @returns Fake provider and its recorded batches
 */
function createMappedProvider(translations: FlatLocaleFile): FakeProvider {
    return createFakeProvider((batch) => {
        const entries: FlatLocaleFile = {};

        for (const entry of batch.entries) {
            entries[entry.key] = translations[entry.key] ?? "";
        }

        return entries;
    });
}

describe("translateEntries", () => {
    beforeEach(() => {
        createCompletion.mockReset();
    });

    it("returns translations and reports a dropped rich-text tag as invalid-tag with the next-intl plugin", async () => {
        const { provider } = createMappedProvider({
            greeting: "سلام {name}",
            cta: "راهنما را بخوانید",
        });

        const result = await translateEntries({
            provider,
            plugin: "next-intl",
            sourceLocale: "en",
            targetLocale: "fa",
            entries: {
                greeting: "Hello {name}",
                cta: "Read <link>the guide</link>",
            },
        });

        expect(result.translations).toEqual({
            greeting: "سلام {name}",
            cta: "راهنما را بخوانید",
        });
        // The ICU structure check also reports the dropped tag, so filter by type.
        const tagIssues = result.issues.filter((issue) => issue.type === "invalid-tag");

        expect(tagIssues).toHaveLength(1);
        expect(tagIssues[0]).toMatchObject({
            type: "invalid-tag",
            key: "cta",
            locale: "fa",
            severity: "error",
        });
        expect(result.issues.every((issue) => issue.key === "cta")).toBe(true);
    });

    it("leaves omitted and empty-string translations out and reports them as missing", async () => {
        const { provider } = createMappedProvider({ kept: "نگه داشته شد", empty: "" });

        const result = await translateEntries({
            provider,
            plugin: "none",
            sourceLocale: "en",
            targetLocale: "fa",
            entries: { kept: "Kept", empty: "Empty", omitted: "Omitted" },
        });

        expect(result.translations).toEqual({ kept: "نگه داشته شد" });
        expect(result.issues.filter((issue) => issue.type === "missing").map((issue) => issue.key)).toEqual(
            expect.arrayContaining(["empty", "omitted"]),
        );
        expect(result.issues.filter((issue) => issue.type === "missing")).toHaveLength(2);
    });

    it("returns provider-error and missing issues when the provider always throws", async () => {
        const calls: Array<TranslationBatch> = [];
        const provider: TranslationProviderContract = {
            name: "openai",
            async translate(batch: TranslationBatch): Promise<TranslationBatchResult> {
                calls.push(batch);
                throw new Error("boom");
            },
        };

        const result = await translateEntries({
            provider,
            plugin: "none",
            sourceLocale: "en",
            targetLocale: "fa",
            entries: { a: "A", b: "B" },
            translation: { maxRetries: 0 },
        });

        expect(calls).toHaveLength(1);
        expect(result.translations).toEqual({});
        expect(result.issues.filter((issue) => issue.type === "missing").map((issue) => issue.key)).toEqual(
            expect.arrayContaining(["a", "b"]),
        );
        expect(result.issues.at(-1)).toMatchObject({
            type: "provider-error",
            severity: "error",
            locale: "fa",
            key: "translation-execution",
        });
    });

    it("returns an empty result without calling the provider when entries are empty", async () => {
        const { provider, batches } = createMappedProvider({});

        const result = await translateEntries({
            provider,
            plugin: "none",
            sourceLocale: "en",
            targetLocale: "fa",
            entries: {},
        });

        expect(result).toEqual({ translations: {}, issues: [] });
        expect(batches).toHaveLength(0);
    });

    it("splits entries into batches according to batchSize", async () => {
        const { provider, batches } = createMappedProvider({ a: "الف", b: "ب" });

        const result = await translateEntries({
            provider,
            plugin: "none",
            sourceLocale: "en",
            targetLocale: "fa",
            entries: { a: "A", b: "B" },
            translation: { batchSize: 1, concurrency: 1 },
        });

        expect(batches).toHaveLength(2);
        expect(batches.map((batch) => batch.entries.length)).toEqual([1, 1]);
        expect(batches.every((batch) => batch.locale === "fa")).toBe(true);
        expect(result.translations).toEqual({ a: "الف", b: "ب" });
        expect(result.issues).toEqual([]);
    });

    it("throws ConfigValidationError for invalid input", async () => {
        const { provider } = createMappedProvider({});
        const base = { provider, plugin: "none" as const, sourceLocale: "en", targetLocale: "fa", entries: { a: "A" } };

        await expect(translateEntries({ ...base, targetLocale: "en" })).rejects.toBeInstanceOf(ConfigValidationError);
        await expect(translateEntries({ ...base, translation: { batchSize: 0 } })).rejects.toBeInstanceOf(ConfigValidationError);
    });

    it("rejects a blank OpenAI API key before sending any request", async () => {
        const base = { plugin: "none" as const, sourceLocale: "en", targetLocale: "fa", entries: { a: "A" } };

        await expect(translateEntries({ ...base, provider: { name: "openai", apiKey: "" } })).rejects.toBeInstanceOf(
            ConfigValidationError,
        );
        await expect(translateEntries({ ...base, provider: { name: "openai", apiKey: "   " } })).rejects.toBeInstanceOf(
            ConfigValidationError,
        );
        expect(createCompletion).not.toHaveBeenCalled();
    });

    it("wires the openai provider config and inline context into the request", async () => {
        createCompletion.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ fa: { greeting: "سلام" } }) } }],
        });

        const result = await translateEntries({
            provider: { name: "openai", apiKey: "test-key" },
            plugin: "none",
            sourceLocale: "en",
            targetLocale: "fa",
            entries: { greeting: "Hello" },
            context: "Use a formal tone.",
        });

        expect(result.translations).toEqual({ greeting: "سلام" });
        expect(result.issues).toEqual([]);
        expect(createCompletion).toHaveBeenCalledTimes(1);

        const body = createCompletion.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
        const systemMessage = body.messages.find((message) => message.role === "system");

        expect(systemMessage?.content).toContain("Additional translation instructions:\nUse a formal tone.");
    });
});
