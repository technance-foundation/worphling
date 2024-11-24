import fs from "fs";
import path from "path";

export class JsonReader {
    static readAll(directoryPath: string): Record<string, any> {
        const directory = path.resolve(directoryPath);

        if (!fs.existsSync(directory)) {
            throw new Error(`Directory not found: ${directory}`);
        }

        const jsonFiles = this.scan(directory);
        return this.read(directory, jsonFiles);
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
                const key = JsonReader.extractLanguageKey(filePath);
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
