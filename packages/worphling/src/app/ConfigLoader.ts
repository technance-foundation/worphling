import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";
import { Config } from "../types";
import { ConfigValidationError, ConfigFileNotFoundError, ConfigLoadError } from "../errors";

const extensions = [".mjs", ".js"];

export class ConfigLoader {
    private config: Config | null;

    constructor() {
        this.config = null;
    }

    public getConfig(): Config {
        if (!this.config) {
            throw new ConfigValidationError(
                "Configuration has not been loaded. Please ensure a valid configuration file is present.",
            );
        }
        return this.config;
    }

    public async load(): Promise<Config> {
        const configFilePath = this.resolveConfigFile("worphling.config");

        if (!fs.existsSync(configFilePath)) {
            throw new ConfigFileNotFoundError(configFilePath);
        }

        try {
            const configFileUrl = pathToFileURL(configFilePath).href;
            const loadedConfig: { default: Config } = await import(configFileUrl);
            const config = loadedConfig.default || loadedConfig;

            this.validate(config);
            this.config = config;
            return this.config;
        } catch (error) {
            if (error instanceof ConfigValidationError) {
                throw error;
            }
            const reason = error instanceof Error ? error.message : "Unknown error";
            throw new ConfigLoadError(configFilePath, reason);
        }
    }

    private resolveConfigFile(baseName: string): string {
        for (const extension of extensions) {
            const filePath = path.resolve(`${baseName}${extension}`);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }
        throw new Error(`Config file not found. Searched for: ${extensions.map((ext) => `${baseName}${ext}`).join(", ")}`);
    }

    private validate(config: Partial<Config>): void {
        const requiredKeys: (keyof Config)[] = ["service", "source"];

        for (const key of requiredKeys) {
            if (!config[key]) {
                throw new ConfigValidationError(`Invalid configuration: Missing required key "${key}".`);
            }
        }
    }
}
