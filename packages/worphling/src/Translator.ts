import { FlatLangFiles, FlatLangFile } from "./types";

export class Translator {
    translate(missingKeys: FlatLangFiles): FlatLangFiles {
        console.warn("This is for testing purposes. Replace with actual implementation.");

        const translatedKeys: FlatLangFiles = {};

        for (const [lang, keys] of Object.entries(missingKeys)) {
            const translatedLangKeys: FlatLangFile = {};

            for (const [key, text] of Object.entries(keys)) {
                translatedLangKeys[key] = `Translated: (${text})`;
            }

            translatedKeys[lang] = translatedLangKeys;
        }

        return translatedKeys;
    }
}
