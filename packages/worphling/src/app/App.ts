import { JsonProcessor, LangProcessor, Translator } from "../core";
import { AppConfig } from "../types";
import { ANSI_COLORS, SUCCESS_STATUS_CODE } from "../constants";
import { omit } from "lodash-es";

export class App {
    private config: AppConfig;

    constructor(config: AppConfig) {
        this.config = config;
    }

    public async run(): Promise<number> {
        const data = JsonProcessor.readAll(this.config.source.directory);
        const sourceKey = JsonProcessor.extractLanguageKey(this.config.source.file);
        const targets = omit(data, sourceKey);
        const missingKeys = LangProcessor.findMissingKeys(data[sourceKey], targets);

        if (Object.entries(missingKeys).length === 0) {
            console.log(ANSI_COLORS.green, "All target languages are already translated.");
            return SUCCESS_STATUS_CODE;
        }

        const translator = new Translator(this.config);
        const translated = await translator.translate(missingKeys);
        const updatedTargets = LangProcessor.updateTargetLangs(targets, translated, data[sourceKey]);
        JsonProcessor.writeAll(this.config.source.directory, updatedTargets);
        return SUCCESS_STATUS_CODE;
    }
}
