import { ConfigLoader } from "./ConfigLoader";
import { handleErrors } from "./handleErrors";

export async function main() {
    const configLoader = new ConfigLoader();

    try {
        await configLoader.load();
        const config = configLoader.getConfig();
        console.log("Loaded configuration:", config);
    } catch (error) {
        handleErrors(error);
        process.exit(1);
    }
}
