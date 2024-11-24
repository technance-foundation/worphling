import { JsonReader } from "../JsonReader";
import { ConfigLoader } from "./ConfigLoader";
import { handleErrors } from "./handleErrors";

export async function main() {
    const configLoader = new ConfigLoader();

    try {
        await configLoader.load();
        const config = configLoader.getConfig();
        const data = JsonReader.readAll(config.source.directory);
        console.log(data);
    } catch (error) {
        handleErrors(error);
        process.exit(1);
    }
}
