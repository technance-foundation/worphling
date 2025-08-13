import { JsonProcessor, LangProcessor, Translator } from "../core";
import { AppConfig, FlatLangFiles } from "../types";
import { ANSI_COLORS, SUCCESS_STATUS_CODE } from "../constants";
import { omit } from "lodash-es";

export class App {
    private config: AppConfig;

    constructor(config: AppConfig) {
        this.config = config;
    }

    public async run(): Promise<number> {
        const data = JsonProcessor.readAll(this.config.source.directory);
        const isSortingEnabled = this.config.flags.isSortingEnabled;
        const sourceKey = JsonProcessor.extractLanguageKey(this.config.source.file);
        const sourceData = data[sourceKey];
        const initialTargets = omit(data, sourceKey);

        const snapshot = JsonProcessor.loadSnapshot(this.config.source.directory);

        const missingKeys = LangProcessor.findMissingKeys(sourceData, initialTargets);

        const modifiedKeysMap: FlatLangFiles = {};
        if (snapshot) {
            const modifiedSourceKeys = LangProcessor.findModifiedKeys(sourceData, snapshot);

            for (const lang of Object.keys(initialTargets)) {
                if (Object.keys(modifiedSourceKeys).length > 0) {
                    modifiedKeysMap[lang] = { ...modifiedSourceKeys };
                }
            }
        }

        const keysToTranslate: FlatLangFiles = {};
        for (const lang of Object.keys({ ...missingKeys, ...modifiedKeysMap })) {
            keysToTranslate[lang] = {
                ...(missingKeys[lang] || {}),
                ...(modifiedKeysMap[lang] || {}),
            };
        }

        // Log information about what we found
        let missingCount = Object.values(missingKeys).reduce((sum, langKeys) => sum + Object.keys(langKeys).length, 0);
        let modifiedCount = Object.values(modifiedKeysMap).reduce((sum, langKeys) => sum + Object.keys(langKeys).length, 0);

        if (missingCount > 0) {
            console.log(ANSI_COLORS.yellow, `Found ${missingCount} missing translations across all languages.`);
        }

        if (modifiedCount > 0) {
            console.log(ANSI_COLORS.yellow, `Found ${modifiedCount} modified keys that need retranslation.`);
        }

        if (Object.entries(keysToTranslate).length === 0) {
            console.log(ANSI_COLORS.green, "All target languages are already translated and up to date.");

            if (isSortingEnabled) {
                console.log(ANSI_COLORS.yellow, "Sorting all files as requested...");
            }
            const allDataToWrite = { ...initialTargets, [sourceKey]: sourceData };
            JsonProcessor.writeAll(this.config.source.directory, allDataToWrite, isSortingEnabled);

            if (!snapshot) {
                JsonProcessor.saveSnapshot(this.config.source.directory, sourceData);
            }

            return SUCCESS_STATUS_CODE;
        }

        const translator = new Translator(this.config);
        const translated = await translator.translate(keysToTranslate);
        const updatedTargets = LangProcessor.updateTargetLangs(initialTargets, translated, sourceData);

        if (isSortingEnabled) {
            console.log(ANSI_COLORS.yellow, "Sorting all files as requested...");
        }

        const allDataToWrite = { ...updatedTargets, [sourceKey]: sourceData };
        JsonProcessor.writeAll(this.config.source.directory, allDataToWrite, isSortingEnabled);

        JsonProcessor.saveSnapshot(this.config.source.directory, sourceData);

        return SUCCESS_STATUS_CODE;
    }
}
