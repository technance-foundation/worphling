import { ConfigLoader } from "./ConfigLoader";
import { App } from "./App";
import { ERROR_STATUS_CODE } from "../constants";

export async function main() {
    const configLoader = new ConfigLoader();

    try {
        const config = await configLoader.load();
        const app = new App(config);
        const statusCode = await app.run();
        process.exit(statusCode);
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error:", error.message);
        }
        process.exit(ERROR_STATUS_CODE);
    }
}
