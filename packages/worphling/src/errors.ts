/**
 * Base class for all Worphling runtime errors.
 *
 * Keeping a shared base error makes it easier for the CLI and future CI/report
 * layers to identify domain errors without relying on fragile string matching.
 */
export class WorphlingError extends Error {
    /**
     * Creates a new Worphling domain error.
     *
     * @param message - Human-readable error message
     */
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

/**
 * Thrown when a configuration file cannot be found.
 */
export class ConfigFileNotFoundError extends WorphlingError {
    /**
     * Absolute path that was expected to exist.
     */
    readonly filePath: string;

    /**
     * Creates a new config-file-not-found error.
     *
     * @param filePath - Missing config file path
     */
    constructor(filePath: string) {
        super(`Couldn't find a configuration file at: ${filePath}`);
        this.filePath = filePath;
    }
}

/**
 * Thrown when a configuration file exists but cannot be loaded.
 */
export class ConfigLoadError extends WorphlingError {
    /**
     * Absolute path of the config file that failed to load.
     */
    readonly filePath: string;

    /**
     * Original failure reason.
     */
    readonly reason: string;

    /**
     * Creates a new config-load error.
     *
     * @param filePath - Config file path
     * @param reason - Underlying failure reason
     */
    constructor(filePath: string, reason: string) {
        super(`Failed to load configuration file at ${filePath}: ${reason}`);
        this.filePath = filePath;
        this.reason = reason;
    }
}

/**
 * Thrown when loaded configuration does not match the expected runtime shape.
 */
export class ConfigValidationError extends WorphlingError {
    /**
     * Creates a new config-validation error.
     *
     * @param message - Validation failure message
     */
    constructor(message: string) {
        super(message);
    }
}

/**
 * Thrown when a configured translation context file cannot be read.
 */
export class TranslationContextReadError extends WorphlingError {
    /**
     * Absolute context file path that failed to be read.
     */
    readonly filePath: string;

    /**
     * Original failure reason.
     */
    readonly reason: string;

    /**
     * Creates a new translation-context-read error.
     *
     * @param filePath - Context file path
     * @param reason - Underlying failure reason
     */
    constructor(filePath: string, reason: string) {
        super(`Failed to read translation context file at ${filePath}: ${reason}`);
        this.filePath = filePath;
        this.reason = reason;
    }
}

/**
 * Thrown when a translation provider response is malformed or incomplete.
 */
export class ProviderResponseValidationError extends WorphlingError {
    /**
     * Creates a new provider-response-validation error.
     *
     * @param message - Validation failure message
     */
    constructor(message: string) {
        super(message);
    }
}

/**
 * Thrown when serialized locale files cannot be read or parsed.
 */
export class LocaleFileReadError extends WorphlingError {
    /**
     * Absolute file path that failed to be read.
     */
    readonly filePath: string;

    /**
     * Original failure reason.
     */
    readonly reason: string;

    /**
     * Creates a new locale-file-read error.
     *
     * @param filePath - Locale file path
     * @param reason - Underlying failure reason
     */
    constructor(filePath: string, reason: string) {
        super(`Failed to read locale file at ${filePath}: ${reason}`);
        this.filePath = filePath;
        this.reason = reason;
    }
}

/**
 * Thrown when serialized locale files cannot be written.
 */
export class LocaleFileWriteError extends WorphlingError {
    /**
     * Absolute file path that failed to be written.
     */
    readonly filePath: string;

    /**
     * Original failure reason.
     */
    readonly reason: string;

    /**
     * Creates a new locale-file-write error.
     *
     * @param filePath - Locale file path
     * @param reason - Underlying failure reason
     */
    constructor(filePath: string, reason: string) {
        super(`Failed to write locale file at ${filePath}: ${reason}`);
        this.filePath = filePath;
        this.reason = reason;
    }
}

/**
 * Thrown when snapshot storage cannot be loaded or saved.
 */
export class SnapshotStorageError extends WorphlingError {
    /**
     * Snapshot file path associated with the error.
     */
    readonly filePath: string;

    /**
     * Original failure reason.
     */
    readonly reason: string;

    /**
     * Creates a new snapshot-storage error.
     *
     * @param filePath - Snapshot file path
     * @param reason - Underlying failure reason
     */
    constructor(filePath: string, reason: string) {
        super(`Failed to access snapshot file at ${filePath}: ${reason}`);
        this.filePath = filePath;
        this.reason = reason;
    }
}

/**
 * Thrown when an unsupported plugin is requested.
 */
export class UnsupportedPluginError extends WorphlingError {
    /**
     * Plugin name provided by the caller.
     */
    readonly pluginName: string;

    /**
     * Creates a new unsupported-plugin error.
     *
     * @param pluginName - Unsupported plugin name
     */
    constructor(pluginName: string) {
        super(`Unsupported plugin "${pluginName}".`);
        this.pluginName = pluginName;
    }
}

/**
 * Thrown when an unsupported translation provider is requested.
 */
export class UnsupportedProviderError extends WorphlingError {
    /**
     * Provider name provided by the caller.
     */
    readonly providerName: string;

    /**
     * Creates a new unsupported-provider error.
     *
     * @param providerName - Unsupported provider name
     */
    constructor(providerName: string) {
        super(`Unsupported translation provider "${providerName}".`);
        this.providerName = providerName;
    }
}
