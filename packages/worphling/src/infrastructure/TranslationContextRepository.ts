import fs from "node:fs";
import path from "node:path";

import { TranslationContextReadError } from "../errors.js";

/**
 * Repository responsible for reading optional translation context instructions
 * from disk.
 *
 * Responsibilities include:
 * - resolving the configured context file path
 * - reading its textual contents
 * - normalizing line endings deterministically
 */
export class TranslationContextRepository {
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
     * Normalizes raw context file content for deterministic prompt construction.
     *
     * This method:
     * - normalizes Windows line endings to `\n`
     * - trims leading and trailing whitespace
     *
     * @param content - Raw file contents
     * @returns Normalized content
     */
    #normalize(content: string): string {
        return content.replace(/\r\n/g, "\n").trim();
    }
}
