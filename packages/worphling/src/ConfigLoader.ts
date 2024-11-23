import path from "path";
import fs from "fs";
import { Config } from "./types";
import { DEFAULT_CONFIG } from "./constants";

export class ConfigLoader {
    private config: Config;

    constructor() {
        this.config = DEFAULT_CONFIG;
    }

    public getConfig(): Config {
        return this.config;
    }

    public async load(): Promise<Config> {
        const configFilePath = path.resolve("worphling.config.js");

        if (!fs.existsSync(configFilePath)) {
            console.warn("No worphling.config.js found. Using default configuration.");
            this.config = DEFAULT_CONFIG;
            return this.config;
        }

        try {
            const loadedConfig: { default?: Config } = await import(configFilePath);

            this.config = {
                ...DEFAULT_CONFIG,
                ...(loadedConfig.default || loadedConfig),
            } satisfies Config;

            return this.config;
        } catch (error) {
            const message = [
                `Error loading configuration file at ${configFilePath}`,
                error instanceof Error ? error.message : false,
            ]
                .filter(Boolean)
                .join("\n");

            throw new Error(message);
        }
    }
}
