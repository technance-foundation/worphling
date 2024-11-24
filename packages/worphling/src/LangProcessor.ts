import { isPlainObject, merge } from "lodash-es";

type LangFile = Record<string, any>;

export class LangProcessor {
    static findMissingKeys(source: LangFile, targets: Record<string, LangFile>): Record<string, Record<string, string>> {
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

    static updateTargetLang(targetLang: LangFile, translatedKeys: Record<string, string>): LangFile {
        const unflattenedMissingKeys = this.unflatten(translatedKeys);
        return merge({}, targetLang, unflattenedMissingKeys);
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

    private static unflatten(obj: Record<string, string>): LangFile {
        const result: LangFile = {};

        for (const [path, value] of Object.entries(obj)) {
            const keys = path.split(".");
            let current = result;

            keys.forEach((key, index) => {
                if (index === keys.length - 1) {
                    current[key] = value;
                } else {
                    current[key] = current[key] || {};
                    current = current[key];
                }
            });
        }

        return result;
    }
}
