#!/usr/bin/env node
import { ConfigLoader } from "./ConfigLoader";
import { ConfigFileNotFoundError, ConfigLoadError, ConfigValidationError } from "./errors";

(async () => {
    const configLoader = new ConfigLoader();

    try {
        await configLoader.load();
        const config = configLoader.getConfig();
        console.log("Loaded configuration:", config);
    } catch (error) {
        if (error instanceof ConfigFileNotFoundError) {
            console.error("Config file not found!", error.message);
        } else if (error instanceof ConfigValidationError) {
            console.error("Configuration validation failed:", error.message);
        } else if (error instanceof ConfigLoadError) {
            console.error("Failed to load configuration:", error.message);
        } else if (error instanceof Error) {
            console.error("An unexpected error occurred:", error.message);
        }
        process.exit(1);
    }
})();

export * from "./types";
