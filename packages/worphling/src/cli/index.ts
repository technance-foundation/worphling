#!/usr/bin/env node

import { App, ConfigLoader } from "../app";
import { ERROR_STATUS_CODE } from "../constants";

export * from "../types";

(async () => {
    const configLoader = new ConfigLoader();

    try {
        const config = await configLoader.load();
        const cli = new App(config);
        const statusCode = await cli.run();
        process.exit(statusCode);
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error:", error.message);
        }
        process.exit(ERROR_STATUS_CODE);
    }
})();
