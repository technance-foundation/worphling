#!/usr/bin/env node

import { App, ConfigLoader } from "../app";
import { ERROR_STATUS_CODE } from "../constants";
import minimist from "minimist";
import { Options } from "../types";
export * from "../types";

const args = minimist(process.argv.slice(2), {
    boolean: ["try-exact-length"],
    default: { "try-exact-length": false },
});

const isTryExactLength = args["try-exact-length"];

if (isTryExactLength) {
    console.log("> Flag --try-exact-length is enabled.");
} else {
    console.log("> Flag --try-exact-length is disabled.");
}

(async () => {
    const configLoader = new ConfigLoader();

    try {
        const options: Options = { isTryExactLength };
        const config = await configLoader.load();
        const cli = new App({ ...config, options });
        const statusCode = await cli.run();
        process.exit(statusCode);
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error:", error.message);
        }
        process.exit(ERROR_STATUS_CODE);
    }
})();
