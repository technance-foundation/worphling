import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { TranslationContextRepository } from "../../src/infrastructure/TranslationContextRepository.js";

/**
 * Temporary directories created by a test, removed after each test.
 */
const temporaryDirectories: Array<string> = [];

/**
 * Writes a context file into a fresh temporary directory.
 *
 * @param content - File content
 * @returns Absolute file path
 */
function createContextFile(content: string): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "worphling-context-"));

    temporaryDirectories.push(directory);

    const filePath = path.join(directory, "context.md");

    fs.writeFileSync(filePath, content, "utf-8");

    return filePath;
}

describe("TranslationContextRepository.resolve", () => {
    afterEach(() => {
        for (const directory of temporaryDirectories.splice(0)) {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });

    it("returns normalized inline context when only inline context is configured", () => {
        expect(new TranslationContextRepository().resolve({ context: "  Use a formal tone.\r\n" })).toBe("Use a formal tone.");
    });

    it("returns file context when only a context file is configured", () => {
        const contextFile = createContextFile("Glossary: cart = سبد\r\n");

        expect(new TranslationContextRepository().resolve({ contextFile })).toBe("Glossary: cart = سبد");
    });

    it("puts file context first, then a blank line, then inline context", () => {
        const contextFile = createContextFile("From file\r\nsecond line\r\n");

        expect(new TranslationContextRepository().resolve({ contextFile, context: "\r\nInline text  " })).toBe(
            "From file\nsecond line\n\nInline text",
        );
    });

    it("returns undefined for whitespace-only inline context", () => {
        expect(new TranslationContextRepository().resolve({ context: "  \r\n\t " })).toBeUndefined();
    });

    it("returns undefined when nothing is configured", () => {
        expect(new TranslationContextRepository().resolve({})).toBeUndefined();
    });
});
