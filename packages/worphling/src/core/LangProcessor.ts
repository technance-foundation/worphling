import { isPlainObject, merge, omit } from "lodash-es";
import { FlatLangFile, FlatLangFiles, LangFile, LangFiles } from "../types";

export class LangProcessor {
    static findMissingKeys(source: LangFile, targets: LangFiles): FlatLangFiles {
        const result: FlatLangFiles = {};

        const flatSource = this.flatten(source);

        for (const [lang, target] of Object.entries(targets)) {
            const flatTarget = this.flatten(target);
            const missingEntries: FlatLangFile = {};

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

    static removeExtraKeys(source: LangFile, target: LangFile): LangFile {
        const flatSource = this.flatten(source);
        const flatTarget = this.flatten(target);

        const keysToRemove = Object.keys(flatTarget).filter((key) => !(key in flatSource));

        const filteredFlatTarget = omit(flatTarget, keysToRemove);

        return this.unflatten(filteredFlatTarget);
    }

    static updateTargetLangs(targetLangs: LangFiles, translatedKeys: FlatLangFiles, sourceLang: LangFile): LangFiles {
        const updatedLangs: LangFiles = {};

        for (const [lang, flatTranslatedKeys] of Object.entries(translatedKeys)) {
            const targetLang = targetLangs[lang] || {};
            const cleanedTargetLang = this.removeExtraKeys(sourceLang, targetLang);
            updatedLangs[lang] = this.updateTargetLang(cleanedTargetLang, flatTranslatedKeys);
        }

        return updatedLangs;
    }

    private static updateTargetLang(targetLang: LangFile, translatedKeys: FlatLangFile): LangFile {
        const unflattenedTranslatedKeys = this.unflatten(translatedKeys);
        return merge({}, targetLang, unflattenedTranslatedKeys);
    }

    private static flatten(obj: LangFile, path: string = "", result: FlatLangFile = {}): FlatLangFile {
        for (const [key, value] of Object.entries(obj)) {
            const newPath = path ? `${path}.${key}` : key;

            if (isPlainObject(value)) {
                this.flatten(value as LangFile, newPath, result);
            } else {
                result[newPath] = value;
            }
        }
        return result;
    }

    private static unflatten(flatObj: FlatLangFile): LangFile {
        const result: LangFile = {};

        for (const [path, value] of Object.entries(flatObj)) {
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
