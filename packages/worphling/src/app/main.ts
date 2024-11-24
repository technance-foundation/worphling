import { omit } from "lodash-es";
import { LangProcessor } from "../LangProcessor";
import { JsonProcessor } from "../JsonProcessor";
import { ConfigLoader } from "./ConfigLoader";
import { handleErrors } from "./handleErrors";
import { ANSI_COLORS } from "../constants";

export async function main() {
    const configLoader = new ConfigLoader();

    try {
        await configLoader.load();
        const config = configLoader.getConfig();
        const data = JsonProcessor.readAll(config.source.directory);
        const sourceKey = JsonProcessor.extractLanguageKey(config.source.file);
        const targets = omit(data, sourceKey);
        const missingKeys = LangProcessor.findMissingKeys(data[sourceKey], targets);

        if (Object.entries(missingKeys).length === 0) {
            console.log(ANSI_COLORS.green, "All target languages are already translated.");
            process.exit(0);
        }

        console.log(missingKeys);
    } catch (error) {
        handleErrors(error);
        process.exit(1);
    }
}
