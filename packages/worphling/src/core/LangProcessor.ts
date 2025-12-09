import { isPlainObject, merge, omit } from "lodash-es";

import { ANSI_COLORS } from "../constants";
import type { FlatLangFile, FlatLangFiles, LangFile, LangFiles } from "../types";

export class LangProcessor {
    static findMissingKeys(source: LangFile, targets: LangFiles): FlatLangFiles {
        const result: FlatLangFiles = {};

        const flatSource = LangProcessor.flatten(source);

        for (const [lang, target] of Object.entries(targets)) {
            const flatTarget = LangProcessor.flatten(target);
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

    static findModifiedKeys(currentSource: LangFile, snapshot: LangFile | null): FlatLangFile {
        if (!snapshot) {
            return {};
        }

        const result: FlatLangFile = {};

        const flatCurrentSource = LangProcessor.flatten(currentSource);
        const flatSnapshot = LangProcessor.flatten(snapshot);

        for (const [key, value] of Object.entries(flatCurrentSource)) {
            if (key in flatSnapshot && flatSnapshot[key] !== value) {
                result[key] = value;
            }
        }

        return result;
    }

    static getAllSourceKeys(source: LangFile): FlatLangFile {
        return LangProcessor.flatten(source);
    }

    static removeAllExtraKeys(source: LangFile, targets: LangFiles): LangFiles {
        const cleanedTargetsLangs: LangFiles = {};
        let totalKeysRemoved = 0;

        for (const [lang, target] of Object.entries(targets)) {
            const flatSource = LangProcessor.flatten(source);
            const flatTarget = LangProcessor.flatten(target);

            const keysToRemove = Object.keys(flatTarget).filter((key) => !(key in flatSource));

            totalKeysRemoved += keysToRemove.length;

            const filteredFlatTarget = omit(flatTarget, keysToRemove);

            cleanedTargetsLangs[lang] = LangProcessor.unflatten(filteredFlatTarget);
        }

        if (totalKeysRemoved > 0) {
            console.log(
                ANSI_COLORS.yellow,
                `Removed ${totalKeysRemoved} extra translation key${totalKeysRemoved > 1 ? "s" : ""} across all languages.`,
            );
        }

        return cleanedTargetsLangs;
    }

    static updateTargetLangs(targetLangs: LangFiles, translatedKeys: FlatLangFiles): LangFiles {
        const updatedLangs: LangFiles = {};

        for (const [lang, flatTranslatedKeys] of Object.entries(translatedKeys)) {
            const targetLang = targetLangs[lang] || {};
            updatedLangs[lang] = LangProcessor.updateTargetLang(targetLang, flatTranslatedKeys);
        }

        return updatedLangs;
    }

    private static updateTargetLang(targetLang: LangFile, translatedKeys: FlatLangFile): LangFile {
        const unflattenedTranslatedKeys = LangProcessor.unflatten(translatedKeys);
        return merge({}, targetLang, unflattenedTranslatedKeys);
    }

    private static flatten(obj: LangFile, path: string = "", result: FlatLangFile = {}): FlatLangFile {
        for (const [key, value] of Object.entries(obj)) {
            const newPath = path ? `${path}.${key}` : key;

            if (isPlainObject(value)) {
                LangProcessor.flatten(value as LangFile, newPath, result);
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
