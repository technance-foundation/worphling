import fs from "node:fs";
import path from "node:path";

import { LocaleFileWriteError } from "../errors.js";

/**
 * Repository responsible for persisting serialized run reports.
 */
export class RunReportRepository {
    /**
     * Writes a serialized report file to disk.
     *
     * @param reportFilePath - Report file path
     * @param content - Serialized report content
     * @throws {LocaleFileWriteError} When the report cannot be written
     */
    write(reportFilePath: string, content: string): void {
        const resolvedReportFilePath = path.resolve(reportFilePath);

        try {
            const reportDirectoryPath = path.dirname(resolvedReportFilePath);

            if (!fs.existsSync(reportDirectoryPath)) {
                fs.mkdirSync(reportDirectoryPath, { recursive: true });
            }

            fs.writeFileSync(resolvedReportFilePath, content, "utf-8");
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new LocaleFileWriteError(resolvedReportFilePath, reason);
        }
    }
}
