import { ConfigFileNotFoundError, ConfigLoadError, ConfigValidationError } from "./errors";

export function handleErrors(error: unknown) {
    if (error instanceof ConfigFileNotFoundError) {
        console.error("Config file not found!", error.message);
    } else if (error instanceof ConfigValidationError) {
        console.error("Configuration validation failed:", error.message);
    } else if (error instanceof ConfigLoadError) {
        console.error("Failed to load configuration:", error.message);
    } else if (error instanceof Error) {
        console.error("An unexpected error occurred:", error.message);
    }
}
