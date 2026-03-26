import { ANSI_COLORS } from "../constants.js";
import { TranslationProviderExecutionError } from "../errors.js";
import type {
    FlatLocaleFile,
    FlatLocaleFiles,
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
     */
    constructor(provider: TranslationProviderContract, translationConfig: TranslationConfig, runtimeConfig: ResolvedConfig) {
        this.#provider = provider;
        this.#translationConfig = translationConfig;
        this.#runtimeConfig = runtimeConfig;
    }

    /**
     * Executes all translation-relevant plan actions and returns deterministically
     * merged translated entries grouped by locale.
     *
     * @param actions - Ordered plan actions
     * @returns Translated flat locale entries grouped by locale
     */
    async execute(actions: Array<PlanAction>): Promise<FlatLocaleFiles> {
        const plannedBatches = this.#buildBatches(actions);

        if (plannedBatches.length === 0) {
            return {};
        }

        console.log(
            ANSI_COLORS.yellow,
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
     * Executes a single batch with retry handling.
     *
     * @param plannedBatch - Planned translation batch
     * @returns Completed batch result
     */
    async #executeBatchWithRetries(plannedBatch: PlannedTranslationBatch): Promise<TranslationBatchResult> {
        const maximumAttempts = this.#translationConfig.maxRetries + 1;
        let currentAttempt = 0;
        let lastError: unknown;

        while (currentAttempt < maximumAttempts) {
            currentAttempt += 1;

            try {
                if (maximumAttempts > 1) {
                    console.log(
                        ANSI_COLORS.yellow,
                        `Translating locale "${plannedBatch.locale}" batch ${plannedBatch.batchIndex + 1}, attempt ${currentAttempt} of ${maximumAttempts}.`,
                    );
                }

                return await this.#provider.translate(plannedBatch.batch, this.#runtimeConfig);
            } catch (error) {
                lastError = error;

                const hasRemainingAttempts = currentAttempt < maximumAttempts;
                const reason = error instanceof Error ? error.message : String(error);

                if (!hasRemainingAttempts) {
                    break;
                }

                console.log(
                    ANSI_COLORS.yellow,
                    `Retrying locale "${plannedBatch.locale}" batch ${plannedBatch.batchIndex + 1} after failure: ${reason}`,
                );
            }
        }

        throw new TranslationProviderExecutionError(
            this.#provider.name,
            `Locale "${plannedBatch.locale}" batch ${plannedBatch.batchIndex + 1} failed after ${maximumAttempts} attempt${maximumAttempts > 1 ? "s" : ""}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
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
}
