import { omit } from "lodash-es";
import { LangProcessor } from "../LangProcessor";
import { JsonProcessor } from "../JsonProcessor";
import { ConfigLoader } from "./ConfigLoader";
import { ANSI_COLORS } from "../constants";
import { Translator } from "../Translator";

export async function main() {
    const configLoader = new ConfigLoader();

    try {
        await configLoader.load();
        const config = configLoader.getConfig();
        const data = JsonProcessor.readAll(config.source.directory);
        const sourceKey = JsonProcessor.extractLanguageKey(config.source.file);
        const targets = omit(data, sourceKey);
        const missingLanguages = LangProcessor.findMissingKeys(data[sourceKey], targets);

        if (Object.entries(missingLanguages).length === 0) {
            console.log(ANSI_COLORS.green, "All target languages are already translated.");
            process.exit(0);
        }

        const translator = new Translator();
        const translated = translator.translate(missingLanguages);
        const updatedTargets = LangProcessor.updateTargetLangs(targets, translated);
        JsonProcessor.writeAll(config.source.directory, updatedTargets);
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error:", error.message);
        }
        process.exit(1);
    }
}
