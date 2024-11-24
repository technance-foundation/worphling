import { isPlainObject } from "lodash-es";

type LangFile = Record<string, any>;

export class Analyzer {
    static compare(source: LangFile, targets: Record<string, LangFile>): Record<string, Record<string, string>> {
        const result: Record<string, Record<string, string>> = {};

        const flatSource = this.flatten(source);

        for (const [lang, target] of Object.entries(targets)) {
            const flatTarget = this.flatten(target);
            const missingEntries: Record<string, string> = {};

            for (const [key, value] of Object.entries(flatSource)) {
                if (!(key in flatTarget)) {
                    missingEntries[key] = value;
                }
            }

            if (Object.keys(missingEntries).length > 0) {
                result[lang] = missingEntries;
            }
        }

        return result;
    }

    private static flatten(obj: Record<string, any>, path: string = "", result: Record<string, any> = {}): Record<string, any> {
        for (const [key, value] of Object.entries(obj)) {
            const newPath = path ? `${path}.${key}` : key;

            if (isPlainObject(value)) {
                this.flatten(value as Record<string, any>, newPath, result);
            } else {
                result[newPath] = value;
            }
        }
        return result;
    }
}
