import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LangProcessor } from "../../src/core";
import { LangFile, LangFiles } from "../../src/types";

describe("Remove all extra keys", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it("removes extra keys across languages, preserves valid keys, and logs the total (plural)", () => {
        const source: LangFile = {
            common: { hello: "Hello", logout: "Logout" },
            home: { title: "Home" },
        };

        const targets: LangFiles = {
            en: {
                common: { hello: "Hello", logout: "Logout", unused: "REMOVE_ME" },
                home: { title: "Home" },
                extraRoot: "REMOVE_ME_TOO",
            },
            de: {
                common: { hello: "Hallo", logout: "Abmelden" },
                home: { title: "Startseite", subtitle: "REMOVE_ME" },
            },
        };

        const targetsBefore = structuredClone(targets);

        const cleaned = LangProcessor.removeAllExtraKeys(source, targets);

        expect(targets).toEqual(targetsBefore);

        expect(cleaned.en).toEqual({
            common: { hello: "Hello", logout: "Logout" },
            home: { title: "Home" },
        });
        expect(cleaned.de).toEqual({
            common: { hello: "Hallo", logout: "Abmelden" },
            home: { title: "Startseite" },
        });

        expect(logSpy).toHaveBeenCalledTimes(1);
        const [colorArg, messageArg] = logSpy.mock.calls[0];
        expect(typeof colorArg).toBe("string");
        expect(messageArg).toBe("Removed 3 extra translation keys across all languages.");
    });

    it("does not log when there are no extra keys (singular/plural edge)", () => {
        const source: LangFile = {
            common: { hello: "Hello" },
            home: { title: "Home" },
        };
        const targets: LangFiles = {
            en: { common: { hello: "Hello" }, home: { title: "Home" } },
            fr: { common: { hello: "Bonjour" }, home: { title: "Accueil" } },
        };

        const cleaned = LangProcessor.removeAllExtraKeys(source, targets);

        expect(cleaned).toEqual(targets);

        expect(logSpy).not.toHaveBeenCalled();
    });

    it("logs with singular 'key' when exactly one key is removed", () => {
        const source: LangFile = {
            common: { hello: "Hello" },
        };
        const targets: LangFiles = {
            en: { common: { hello: "Hello", extra: "1" } }, // exactly one extra
        };

        LangProcessor.removeAllExtraKeys(source, targets);

        expect(logSpy).toHaveBeenCalledTimes(1);
        const [, messageArg] = logSpy.mock.calls[0];
        expect(messageArg).toBe("Removed 1 extra translation key across all languages.");
    });
});
