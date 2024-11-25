import { JsonProcessor, LangProcessor, Translator } from "../core";
import { Config } from "../types";
import { ANSI_COLORS, SUCCESS_STATUS_CODE } from "../constants";
import { omit } from "lodash-es";

export class App {
    private config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    public async run(): Promise<number> {
        const data = JsonProcessor.readAll(this.config.source.directory);
        const sourceKey = JsonProcessor.extractLanguageKey(this.config.source.file);
        const targets = omit(data, sourceKey);
        const missingLanguages = LangProcessor.findMissingKeys(data[sourceKey], targets);

        if (Object.entries(missingLanguages).length === 0) {
            console.log(ANSI_COLORS.green, "All target languages are already translated.");
            return SUCCESS_STATUS_CODE;
        }

        const translator = new Translator();
        const translated = translator.translate(missingLanguages);
        const updatedTargets = LangProcessor.updateTargetLangs(targets, translated);
        JsonProcessor.writeAll(this.config.source.directory, updatedTargets);
        return SUCCESS_STATUS_CODE;
    }
}
