#!/usr/bin/env node

import { App, ConfigLoader } from "../app";
import { ERROR_STATUS_CODE } from "../constants";

import { Cli } from "./Cli";

export * from "../types";

(async () => {
    const cli = new Cli();
    const configLoader = new ConfigLoader();

    try {
        const config = await configLoader.load();
        const app = new App({ ...config, flags: cli.flags });
        const statusCode = await app.run();
        process.exit(statusCode);
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error:", error.message);
        }
        process.exit(ERROR_STATUS_CODE);
    }
})();
