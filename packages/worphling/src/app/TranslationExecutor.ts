import { TranslationProviderExecutionError } from "../errors.js";
import type {
    FlatLocaleFile,
    FlatLocaleFiles,
    Logger,
    PlanAction,
    ResolvedConfig,
    TranslationBatch,
    TranslationBatchResult,
    TranslationConfig,
    TranslationProviderContract,
} from "../types.js";

/**
 * Planned translation batch with deterministic ordering metadata.
 */
interface PlannedTranslationBatch {
    /**
     * Stable locale for the batch.
     */
    locale: string;

    /**
     * Stable batch index within the locale.
     */
    batchIndex: number;

    /**
     * Provider-facing translation batch.
     */
    batch: TranslationBatch;
}

/**
 * Completed batch result paired with its deterministic batch metadata.
 */
interface CompletedTranslationBatch {
    /**
     * Original planned batch metadata.
     */
    plannedBatch: PlannedTranslationBatch;

    /**
     * Provider result for the batch.
     */
    result: TranslationBatchResult;
}

/**
 * Executes translation plan actions using configured batching, concurrency,
 * retries, and deterministic merge behavior.
 */
export class TranslationExecutor {
    /**
     * Runtime logger used for execution messages.
     */
    #logger: Logger;

    /**
     * Translation provider used for batch execution.
     */
    #provider: TranslationProviderContract;

    /**
     * Translation execution config.
     */
    #translationConfig: TranslationConfig;

    /**
     * Fully resolved runtime config passed to the provider.
     */
    #runtimeConfig: ResolvedConfig;

    /**
     * Creates a new translation executor.
     *
     * @param provider - Translation provider
     * @param translationConfig - Translation execution config
     * @param runtimeConfig - Fully resolved runtime config
     * @param logger - Runtime logger
     */
    constructor(
        provider: TranslationProviderContract,
        translationConfig: TranslationConfig,
        runtimeConfig: ResolvedConfig,
        logger: Logger,
    ) {
        this.#provider = provider;
        this.#translationConfig = translationConfig;
        this.#runtimeConfig = runtimeConfig;
        this.#logger = logger;
    }

    /**
     * Executes all translation-relevant plan actions and returns deterministically
     * merged translated entries grouped by locale.
     *
     * The execution log intentionally includes batch sizing and provider context
     * so timeout and provider-failure incidents can be diagnosed more easily in
     * real-world runs.
     *
     * @param actions - Ordered plan actions
     * @returns Translated flat locale entries grouped by locale
     */
    async execute(actions: Array<PlanAction>): Promise<FlatLocaleFiles> {
        const plannedBatches = this.#buildBatches(actions);

        if (plannedBatches.length === 0) {
            return {};
        }

        this.#logger.info(
            `Executing ${plannedBatches.length} translation batch${plannedBatches.length > 1 ? "es" : ""} with concurrency ${this.#translationConfig.concurrency}.`,
        );

        const completedBatches = await this.#executeBatches(plannedBatches);

        return this.#mergeCompletedBatches(completedBatches);
    }

    /**
     * Builds deterministic translation batches from plan actions.
     *
     * @param actions - Ordered plan actions
     * @returns Planned translation batches
     */
    #buildBatches(actions: Array<PlanAction>): Array<PlannedTranslationBatch> {
        const entriesByLocale: Record<string, FlatLocaleFile> = {};

        for (const action of actions) {
            if (action.type !== "translate-missing" && action.type !== "retranslate-modified") {
                continue;
            }

            entriesByLocale[action.locale] = {
                ...(entriesByLocale[action.locale] || {}),
                ...action.entries,
            };
        }

        const plannedBatches: Array<PlannedTranslationBatch> = [];
        const sortedLocales = Object.keys(entriesByLocale).sort();

        for (const locale of sortedLocales) {
            const sortedEntries = Object.entries(entriesByLocale[locale])
                .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
                .map(([key, source]) => ({
                    key,
                    source,
                }));

            const chunks = this.#chunkEntries(sortedEntries, this.#translationConfig.batchSize);

            for (const [batchIndex, chunk] of chunks.entries()) {
                plannedBatches.push({
                    locale,
                    batchIndex,
                    batch: {
                        locale,
                        entries: chunk,
                    },
                });
            }
        }

        return plannedBatches;
    }

    /**
     * Splits translation entries into deterministic fixed-size chunks.
     *
     * @param entries - Translation entries
     * @param batchSize - Maximum batch size
     * @returns Chunked entries
     */
    #chunkEntries(entries: TranslationBatch["entries"], batchSize: number): Array<TranslationBatch["entries"]> {
        const chunks: Array<TranslationBatch["entries"]> = [];

        for (let index = 0; index < entries.length; index += batchSize) {
            chunks.push(entries.slice(index, index + batchSize));
        }

        return chunks;
    }

    /**
     * Executes all planned batches with bounded concurrency.
     *
     * @param plannedBatches - Planned translation batches
     * @returns Completed batch results
     */
    async #executeBatches(plannedBatches: Array<PlannedTranslationBatch>): Promise<Array<CompletedTranslationBatch>> {
        const completedBatches: Array<CompletedTranslationBatch> = [];
        const workerCount = Math.min(this.#translationConfig.concurrency, plannedBatches.length);
        let nextBatchIndex = 0;

        const runWorker = async (): Promise<void> => {
            while (true) {
                const currentBatch = plannedBatches[nextBatchIndex];

                if (!currentBatch) {
                    return;
                }

                nextBatchIndex += 1;

                const result = await this.#executeBatchWithRetries(currentBatch);

                completedBatches.push({
                    plannedBatch: currentBatch,
                    result,
                });
            }
        };

        await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

        return completedBatches;
    }

    /**
     * Executes a single batch with retry handling and diagnostic logging.
     *
     * Logged diagnostics include:
     * - provider and model
     * - locale and batch number
     * - entry count
     * - approximate source character count
     * - first and last key in the batch
     * - per-attempt duration
     * - normalized error details
     *
     * @param plannedBatch - Planned translation batch
     * @returns Completed batch result
     */
    async #executeBatchWithRetries(plannedBatch: PlannedTranslationBatch): Promise<TranslationBatchResult> {
        const maximumAttempts = this.#translationConfig.maxRetries + 1;
        const model = this.#runtimeConfig.provider.model;
        const entryCount = plannedBatch.batch.entries.length;
        const approximateCharacterCount = this.#getBatchCharacterCount(plannedBatch.batch);
        const keyRange = this.#summarizeBatchKeys(plannedBatch.batch);

        let currentAttempt = 0;
        let lastError: unknown;

        while (currentAttempt < maximumAttempts) {
            currentAttempt += 1;

            const startedAt = Date.now();

            this.#logger.info(
                `Translating locale "${plannedBatch.locale}" batch ${plannedBatch.batchIndex + 1}, attempt ${currentAttempt} of ${maximumAttempts}. Provider="${this.#provider.name}", model="${model}", entries=${entryCount}, approxChars=${approximateCharacterCount}, keys=${keyRange}.`,
            );

            try {
                const result = await this.#provider.translate(plannedBatch.batch, this.#runtimeConfig);
                const durationMs = Date.now() - startedAt;

                this.#logger.success(
                    `Translated locale "${plannedBatch.locale}" batch ${plannedBatch.batchIndex + 1} in ${durationMs}ms.`,
                );

                return result;
            } catch (error) {
                lastError = error;

                const durationMs = Date.now() - startedAt;
                const hasRemainingAttempts = currentAttempt < maximumAttempts;
                const formattedError = this.#formatErrorDetails(error);

                if (!hasRemainingAttempts) {
                    this.#logger.error(
                        `Translation failed for locale "${plannedBatch.locale}" batch ${plannedBatch.batchIndex + 1} after ${durationMs}ms. ${formattedError}`,
                    );

                    break;
                }

                this.#logger.warn(
                    `Retrying locale "${plannedBatch.locale}" batch ${plannedBatch.batchIndex + 1} after ${durationMs}ms due to failure: ${formattedError}`,
                );
            }
        }

        throw new TranslationProviderExecutionError(
            this.#provider.name,
            `Locale "${plannedBatch.locale}" batch ${plannedBatch.batchIndex + 1} failed after ${maximumAttempts} attempt${maximumAttempts > 1 ? "s" : ""}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
            plannedBatch.locale,
            plannedBatch.batchIndex,
        );
    }

    /**
     * Merges completed batch results deterministically by locale, batch index,
     * and entry key.
     *
     * @param completedBatches - Completed translation batches
     * @returns Merged translated entries grouped by locale
     */
    #mergeCompletedBatches(completedBatches: Array<CompletedTranslationBatch>): FlatLocaleFiles {
        const mergedResults: FlatLocaleFiles = {};
        const sortedCompletedBatches = completedBatches.slice().sort((left, right) => {
            const localeComparison = left.plannedBatch.locale.localeCompare(right.plannedBatch.locale);

            if (localeComparison !== 0) {
                return localeComparison;
            }

            return left.plannedBatch.batchIndex - right.plannedBatch.batchIndex;
        });

        for (const completedBatch of sortedCompletedBatches) {
            const locale = completedBatch.result.locale;
            const sortedEntries = Object.fromEntries(
                Object.entries(completedBatch.result.entries).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
            );

            mergedResults[locale] = {
                ...(mergedResults[locale] || {}),
                ...sortedEntries,
            };
        }

        return mergedResults;
    }

    /**
     * Returns an approximate character count for a provider batch.
     *
     * This is not a token count. It is a lightweight diagnostic estimate used
     * for troubleshooting oversized translation requests.
     *
     * @param batch - Translation batch
     * @returns Approximate character count
     */
    #getBatchCharacterCount(batch: TranslationBatch): number {
        return batch.entries.reduce((total, entry) => total + entry.key.length + entry.source.length, 0);
    }

    /**
     * Returns a stable summary of the first and last key in a batch.
     *
     * @param batch - Translation batch
     * @returns Human-readable key range
     */
    #summarizeBatchKeys(batch: TranslationBatch): string {
        if (batch.entries.length === 0) {
            return "n/a";
        }

        const firstKey = batch.entries[0]?.key || "n/a";
        const lastKey = batch.entries[batch.entries.length - 1]?.key || "n/a";

        return firstKey === lastKey ? firstKey : `${firstKey} -> ${lastKey}`;
    }

    /**
     * Formats an unknown provider error into a more useful diagnostic string.
     *
     * The formatter attempts to surface common SDK and transport metadata such
     * as error name, code, status, type, and nested cause details when present.
     *
     * @param error - Unknown thrown error
     * @returns Human-readable diagnostic summary
     */
    #formatErrorDetails(error: unknown): string {
        if (!(error instanceof Error)) {
            return String(error);
        }

        const details: Array<string> = [`name=${error.name}`, `message=${error.message}`];

        const errorWithMetadata = error as Error & {
            code?: string;
            status?: number;
            type?: string;
            cause?: unknown;
        };

        if (errorWithMetadata.code) {
            details.push(`code=${errorWithMetadata.code}`);
        }

        if (typeof errorWithMetadata.status === "number") {
            details.push(`status=${errorWithMetadata.status}`);
        }

        if (errorWithMetadata.type) {
            details.push(`type=${errorWithMetadata.type}`);
        }

        if (errorWithMetadata.cause instanceof Error) {
            details.push(`cause=${errorWithMetadata.cause.name}: ${errorWithMetadata.cause.message}`);
        }

        return details.join(", ");
    }
}
