import fs from "node:fs";
import path from "node:path";

import { LocaleStructure } from "../domain/LocaleStructure.js";
import { SnapshotStorageError } from "../errors.js";
import type { LocaleFile, SnapshotFile } from "../types.js";

/**
 * Repository responsible for loading and saving source snapshots used for
 * source-change detection.
 */
export class SnapshotRepository {
    /**
     * Locale structure helper used for flattening snapshot content.
     */
    #localeStructure: LocaleStructure;

    /**
     * Creates a new snapshot repository.
     *
     * @param localeStructure - Optional locale structure helper
     */
    constructor(localeStructure?: LocaleStructure) {
        this.#localeStructure = localeStructure || new LocaleStructure();
    }

    /**
     * Loads a previously stored source snapshot.
     *
     * When no snapshot file path is provided, or when the file does not exist,
     * the method returns `null`.
     *
     * @param snapshotFilePath - Snapshot file path
     * @returns Flattened source snapshot entries, or `null`
     * @throws {SnapshotStorageError} When the snapshot exists but cannot be read
     */
    load(snapshotFilePath?: string): Record<string, string> | null {
        if (!snapshotFilePath) {
            return null;
        }

        const resolvedSnapshotPath = path.resolve(snapshotFilePath);

        if (!fs.existsSync(resolvedSnapshotPath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(resolvedSnapshotPath, "utf-8");
            const parsedSnapshot = JSON.parse(content) as SnapshotFile;

            return parsedSnapshot.entries;
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new SnapshotStorageError(resolvedSnapshotPath, reason);
        }
    }

    /**
     * Saves a source-locale snapshot for later change detection.
     *
     * @param snapshotFilePath - Snapshot file path
     * @param sourceLocale - Source locale associated with the snapshot
     * @param content - Source locale content
     * @throws {SnapshotStorageError} When the snapshot cannot be written
     */
    save(snapshotFilePath: string, sourceLocale: string, content: LocaleFile): void {
        const resolvedSnapshotPath = path.resolve(snapshotFilePath);

        try {
            const snapshotDirectoryPath = path.dirname(resolvedSnapshotPath);

            if (!fs.existsSync(snapshotDirectoryPath)) {
                fs.mkdirSync(snapshotDirectoryPath, { recursive: true });
            }

            const snapshot: SnapshotFile = {
                sourceLocale,
                entries: this.#localeStructure.flatten(content),
            };

            fs.writeFileSync(resolvedSnapshotPath, `${JSON.stringify(snapshot, null, 4)}\n`, "utf-8");
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new SnapshotStorageError(resolvedSnapshotPath, reason);
        }
    }
}
