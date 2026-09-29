import fs from "node:fs";
import path from "node:path";

import { TranslationContextReadError } from "../errors.js";
import type { TranslationConfig } from "../types.js";

/**
 * Repository responsible for resolving optional translation context
 * instructions from inline config text and from disk.
 *
 * Responsibilities include:
 * - resolving the configured context file path
 * - reading its textual contents
 * - merging file and inline context in a stable order
 * - normalizing line endings deterministically
 */
export class TranslationContextRepository {
    /**
     * Resolves the effective translation context for a translation config.
     *
     * The context file content comes first, followed by the inline `context`
     * text. Empty or whitespace-only parts are ignored.
     *
     * @param translationConfig - Translation config carrying `contextFile` and/or `context`
     * @returns Merged, normalized context instructions, or `undefined`
     * @throws {TranslationContextReadError} When the configured file cannot be read
     */
    resolve(translationConfig: Pick<TranslationConfig, "context" | "contextFile">): string | undefined {
        const fileContext = this.read(translationConfig.contextFile);
        const inlineContext = translationConfig.context ? this.#normalize(translationConfig.context) : undefined;

        return [fileContext, inlineContext].filter(Boolean).join("\n\n") || undefined;
    }

    /**
     * Reads the configured translation context file.
     *
     * When no context file is configured, the method returns `undefined`.
     *
     * Empty files are treated as absent context and also return `undefined`.
     *
     * @param contextFilePath - Optional configured context file path
     * @returns Normalized context instructions, or `undefined`
     * @throws {TranslationContextReadError} When the configured file cannot be read
     */
    read(contextFilePath?: string): string | undefined {
        if (!contextFilePath) {
            return undefined;
        }

        const resolvedContextFilePath = path.resolve(contextFilePath);

        if (!fs.existsSync(resolvedContextFilePath)) {
            throw new TranslationContextReadError(resolvedContextFilePath, "File not found.");
        }

        try {
            const content = fs.readFileSync(resolvedContextFilePath, "utf-8");
            const normalizedContent = this.#normalize(content);

            return normalizedContent || undefined;
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new TranslationContextReadError(resolvedContextFilePath, reason);
        }
    }

    /**
     * Normalizes raw context content for deterministic prompt construction.
     *
     * This method:
     * - normalizes Windows line endings to `\n`
     * - trims leading and trailing whitespace
     *
     * @param content - Raw context content
     * @returns Normalized content
     */
    #normalize(content: string): string {
        return content.replace(/\r\n/g, "\n").trim();
    }
}
