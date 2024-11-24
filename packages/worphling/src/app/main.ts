import { omit } from "lodash-es";
import { Analyzer } from "../Analyzer";
import { JsonReader } from "../JsonReader";
import { ConfigLoader } from "./ConfigLoader";
import { handleErrors } from "./handleErrors";
import { ANSI_COLORS } from "../constants";

export async function main() {
    const configLoader = new ConfigLoader();

    try {
        await configLoader.load();
        const config = configLoader.getConfig();
        const data = JsonReader.readAll(config.source.directory);
        const sourceKey = JsonReader.extractLanguageKey(config.source.file);
        const targets = omit(data, sourceKey);
        const result = Analyzer.compare(data[sourceKey], targets);

        if (Object.entries(result).length === 0) {
            console.log(ANSI_COLORS.green, "All target languages are already translated.");
            process.exit(0);
        }

        console.log(result);
    } catch (error) {
        handleErrors(error);
        process.exit(1);
    }
}
