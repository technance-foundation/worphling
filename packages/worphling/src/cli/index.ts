#!/usr/bin/env node

import { App, ConfigLoader } from "../app/index.js";
import {
    ConfigValidationError,
    ProviderResponseValidationError,
    TranslationProviderExecutionError,
    WorphlingError,
} from "../errors.js";
import { ConsoleLogger } from "../infrastructure/index.js";
import type { ExitCode as ExitCodeType } from "../types.js";
import { ExitCode } from "../types.js";

import { Cli } from "./Cli.js";

export * from "../types.js";

/**
 * Executes the Worphling CLI entrypoint.
 *
 * Responsibilities include:
 * - parsing CLI arguments
 * - loading and normalizing config
 * - constructing the runtime app
 * - mapping domain failures to stable process exit codes
 */
(async () => {
    const logger = new ConsoleLogger();

    try {
        const cli = new Cli();
        const configLoader = new ConfigLoader(cli.flags.configPath);
        const config = await configLoader.load();

        const app = new App({
            config,
            flags: cli.flags,
            logger,
        });

        const statusCode = await app.run();
        process.exit(statusCode);
    } catch (error) {
        const statusCode = resolveExitCode(error);

        if (error instanceof Error) {
            logger.error(`Error: ${error.message}`);
        } else {
            logger.error("Error: Unknown error.");
        }

        process.exit(statusCode);
    }
})();

/**
 * Resolves a stable process exit code for a runtime error.
 *
 * @param error - Runtime error thrown during execution
 * @returns Process exit code
 */
function resolveExitCode(error: unknown): ExitCodeType {
    if (error instanceof ConfigValidationError) {
        return ExitCode.ConfigError;
    }

    if (error instanceof TranslationProviderExecutionError || error instanceof ProviderResponseValidationError) {
        return ExitCode.ProviderError;
    }

    if (error instanceof WorphlingError) {
        return ExitCode.Error;
    }

    return ExitCode.Error;
}
