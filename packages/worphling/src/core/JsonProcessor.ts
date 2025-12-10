import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ANSI_COLORS } from "../constants";

export class JsonProcessor {
    static readAll(directoryPath: string): Record<string, any> {
        const directory = path.resolve(directoryPath);

        if (!fs.existsSync(directory)) {
            throw new Error(`Directory not found: ${directory}`);
        }

        const jsonFiles = JsonProcessor.scan(directory);
        return JsonProcessor.read(directory, jsonFiles);
    }

    static writeAll(directoryPath: string, translations: Record<string, any>, isSortingEnabled: boolean): void {
        const directory = path.resolve(directoryPath);

        if (!fs.existsSync(directory)) {
            throw new Error(`Directory not found: ${directory}`);
        }

        for (const [langKey, content] of Object.entries(translations)) {
            const filePath = path.join(directory, `${langKey}.json`);

            try {
                const contentToWrite = isSortingEnabled ? sortObjectKeysRecursively(content) : content;
                const jsonContent = JSON.stringify(contentToWrite, null, 4);
                fs.writeFileSync(filePath, `${jsonContent}\n`, "utf-8");
                console.log(ANSI_COLORS.green, `Success: File written for language "${langKey}" at ${filePath}`);
            } catch (error) {
                throw new Error(`Error writing file: ${filePath}, ${error instanceof Error ? error.message : error}`);
            }
        }
    }

    static saveSnapshot(directoryPath: string, content: any): void {
        const snapshotPath = JsonProcessor.getSnapshotPath(directoryPath);

        try {
            const snapshotDir = path.dirname(snapshotPath);
            if (!fs.existsSync(snapshotDir)) {
                fs.mkdirSync(snapshotDir, { recursive: true });
            }

            const jsonContent = JSON.stringify(content, null, 4);
            fs.writeFileSync(snapshotPath, `${jsonContent}\n`, "utf-8");
        } catch (error) {
            console.warn(
                ANSI_COLORS.yellow,
                `Warning: Failed to save snapshot: ${error instanceof Error ? error.message : error}`,
            );
        }
    }

    static loadSnapshot(directoryPath: string): any | null {
        const snapshotPath = JsonProcessor.getSnapshotPath(directoryPath);

        if (!fs.existsSync(snapshotPath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(snapshotPath, "utf-8");
            return JSON.parse(content);
        } catch (error) {
            console.warn(
                ANSI_COLORS.yellow,
                `Warning: Failed to load snapshot: ${error instanceof Error ? error.message : error}`,
            );
            return null;
        }
    }

    private static getSnapshotPath(directoryPath: string): string {
        const directory = path.resolve(directoryPath);

        const hash = crypto.createHash("md5").update(directory).digest("hex").substring(0, 8);

        let nodeModulesPath = JsonProcessor.findNodeModules(directory);

        if (!nodeModulesPath) {
            nodeModulesPath = path.join(directory, "../node_modules");
        }

        const snapshotDir = path.join(nodeModulesPath, ".worphling");
        const snapshotFileName = `snapshot-${hash}.json`;

        return path.join(snapshotDir, snapshotFileName);
    }

    private static findNodeModules(startPath: string): string | null {
        let currentPath = startPath;

        while (currentPath !== path.dirname(currentPath)) {
            const nodeModulesPath = path.join(currentPath, "node_modules");
            if (fs.existsSync(nodeModulesPath)) {
                return nodeModulesPath;
            }
            currentPath = path.dirname(currentPath);
        }

        return null;
    }

    private static scan(directory: string): string[] {
        return fs.readdirSync(directory).filter((file) => file.endsWith(".json"));
    }

    private static read(directory: string, files: string[]): Record<string, any> {
        const result: Record<string, any> = {};

        for (const file of files) {
            const filePath = path.join(directory, file);

            try {
                const content = fs.readFileSync(filePath, "utf-8");
                const parsed = JSON.parse(content);
                const key = JsonProcessor.extractLanguageKey(filePath);
                result[key] = parsed;
            } catch (error) {
                throw new Error(`Error reading or parsing file: ${filePath}, ${error instanceof Error ? error.message : error}`);
            }
        }

        return result;
    }

    static extractLanguageKey(filePath: string): string {
        return path.basename(filePath, ".json");
    }
}

function sortObjectKeysRecursively(obj: any) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        return obj;
    }
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: Record<string, any> = {};
    for (const key of sortedKeys) {
        sortedObj[key] = sortObjectKeysRecursively(obj[key]);
    }
    return sortedObj;
}
