export class ConfigValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConfigValidationError";
    }
}

export class ConfigFileNotFoundError extends Error {
    constructor(filePath: string) {
        super(`Couldn't find a configuration file at: ${filePath}`);
        this.name = "ConfigFileNotFoundError";
    }
}

export class ConfigLoadError extends Error {
    constructor(filePath: string, reason: string) {
        super(`Failed to load configuration file at ${filePath}: ${reason}`);
        this.name = "ConfigLoadError";
    }
}
