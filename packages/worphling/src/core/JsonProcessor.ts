import fs from "fs";
import path from "path";
import { ANSI_COLORS } from "../constants";

export class JsonProcessor {
    static readAll(directoryPath: string): Record<string, any> {
        const directory = path.resolve(directoryPath);

        if (!fs.existsSync(directory)) {
            throw new Error(`Directory not found: ${directory}`);
        }

        const jsonFiles = this.scan(directory);
        return this.read(directory, jsonFiles);
    }

    static writeAll(directoryPath: string, translations: Record<string, any>): void {
        const directory = path.resolve(directoryPath);

        if (!fs.existsSync(directory)) {
            throw new Error(`Directory not found: ${directory}`);
        }

        for (const [langKey, content] of Object.entries(translations)) {
            const filePath = path.join(directory, `${langKey}.json`);

            try {
                const sortedContent = sortObjectKeysRecursively(content);
                const jsonContent = JSON.stringify(sortedContent, null, 4);
                fs.writeFileSync(filePath, jsonContent, "utf-8");
                console.log(ANSI_COLORS.green, `Success: File written for language "${langKey}" at ${filePath}`);
            } catch (error) {
                throw new Error(`Error writing file: ${filePath}, ${error instanceof Error ? error.message : error}`);
            }
        }
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
