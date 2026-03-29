import { omit } from "lodash-es";

import { LocaleDiffCalculator, LocaleStructure, TranslationPluginRegistry, ValidationEngine } from "../domain/index.js";
import { TranslationProviderExecutionError } from "../errors.js";
import { ConsoleLogger, JsonLocaleRepository, RunReportRepository, SnapshotRepository } from "../infrastructure/index.js";
import { TranslationProviderFactory } from "../providers/index.js";
import type {
    AppConfig,
    FlatLocaleFiles,
    LocaleFiles,
    LocaleIssue,
    Logger,
    PlanAction,
    ReportFormat,
    RunReport,
    TranslationPluginContract,
} from "../types.js";
import { ExitCode } from "../types.js";

import { RunConsoleReporter } from "./RunConsoleReporter.js";
import { RunPlanner } from "./RunPlanner.js";
import { RunReporter } from "./RunReporter.js";
import { TranslationExecutor } from "./TranslationExecutor.js";

/**
 * Main Worphling application runtime.
 *
 * This class orchestrates:
 * - reading locale files
 * - identifying source and target locales
 * - building the diff and execution plan
 * - invoking the translation provider when policy allows
 * - writing updated locale files
 * - validating the effective locale state
 * - producing structured run reports
 */
export class App {
    /**
     * Runtime configuration and CLI flags for the current invocation.
     */
    #config: AppConfig;

    /**
     * Runtime logger used across the application.
     */
    #logger: Logger;

    /**
     * Locale file repository used for filesystem access.
     */
    #localeRepository: JsonLocaleRepository;

    /**
     * Snapshot repository used for source snapshot persistence.
     */
    #snapshotRepository: SnapshotRepository;

    /**
     * Locale diff calculator used for diffing and merging locale state.
     */
    #localeDiffCalculator: LocaleDiffCalculator;

    /**
     * Planner used to build structured diffs and ordered actions.
     */
    #runPlanner: RunPlanner;

    /**
     * Active translation plugin.
     *
     * This is resolved eagerly because validation behavior may depend on the
     * selected plugin even when no translation work is needed.
     */
    #plugin: TranslationPluginContract;

    /**
     * Validation engine used to collect structured validation issues.
     */
    #validationEngine: ValidationEngine;

    /**
     * Translation executor used for batching, retries, concurrency, and
     * deterministic merge behavior.
     *
     * This is initialized lazily only when the execution plan contains
     * translation actions.
     */
    #translationExecutor: TranslationExecutor | null;

    /**
     * Human-facing console reporter for runtime logs.
     */
    #runConsoleReporter: RunConsoleReporter;

    /**
     * Reporter used to build and serialize run reports.
     */
    #runReporter: RunReporter;

    /**
     * Repository used for report file persistence.
     */
    #runReportRepository: RunReportRepository;

    /**
     * Creates a new Worphling runtime application.
     *
     * @param config - Runtime config and CLI flags
     */
    constructor(config: AppConfig) {
        const localeStructure = new LocaleStructure();
        const localeDiffCalculator = new LocaleDiffCalculator(localeStructure);
        const logger = config.logger || new ConsoleLogger();
        const plugin = new TranslationPluginRegistry().resolve(config.config.plugin.name);

        this.#config = config;
        this.#logger = logger;
        this.#plugin = plugin;
        this.#localeRepository = new JsonLocaleRepository(
            config.config.localesDir,
            config.config.filePattern,
            config.config.output,
            logger,
        );
        this.#snapshotRepository = new SnapshotRepository(localeStructure);
        this.#localeDiffCalculator = localeDiffCalculator;
        this.#runPlanner = new RunPlanner(localeDiffCalculator);
        this.#validationEngine = new ValidationEngine(plugin, localeStructure);
        this.#runConsoleReporter = new RunConsoleReporter(logger);
        this.#runReporter = new RunReporter();
        this.#runReportRepository = new RunReportRepository();
        this.#translationExecutor = null;
    }

    /**
     * Executes the application.
     *
     * @returns Process exit code
     */
    async run(): Promise<ExitCode> {
        const runtimeConfig = this.#config.config;
        const flags = this.#config.flags;

        const allLocaleFiles = this.#localeRepository.readAll();
        const sourceLocale = runtimeConfig.sourceLocale;
        const sourceLocaleFile = allLocaleFiles[sourceLocale];

        if (!sourceLocaleFile) {
            throw new Error(`Source locale "${sourceLocale}" was not found in "${runtimeConfig.localesDir}".`);
        }

        const allTargetLocaleFiles = omit(allLocaleFiles, sourceLocale) as LocaleFiles;
        const targetLocaleFiles = this.#filterLocales(allTargetLocaleFiles);
        const snapshot = this.#snapshotRepository.load(runtimeConfig.snapshot.file);

        const diffResult = this.#runPlanner.analyze(sourceLocaleFile, targetLocaleFiles, snapshot);
        const plan = this.#runPlanner.createPlan(diffResult, flags.command);
        const executionPolicy = this.#resolveExecutionPolicy();
        const requiresTranslation = this.#planRequiresTranslation(plan.actions);
        const shouldBootstrapSnapshot = executionPolicy.writeFiles && snapshot === null;

        this.#runConsoleReporter.logDetectedChanges(diffResult);
        this.#runConsoleReporter.logExecutionMode(executionPolicy);

        let updatedTargetLocaleFiles = { ...targetLocaleFiles };
        let translatedKeys: FlatLocaleFiles = {};
        let translatedCount = 0;
        let writtenFileCount = 0;
        let providerIssues: Array<LocaleIssue> = [];

        if (executionPolicy.executePlan && (plan.actions.length > 0 || shouldBootstrapSnapshot)) {
            try {
                if (requiresTranslation) {
                    this.#initializeTranslationExecutor();
                    translatedKeys = await this.#translatePlannedEntries(plan.actions);
                    translatedCount = this.#countFlatLocaleEntries(translatedKeys);

                    if (translatedCount > 0) {
                        updatedTargetLocaleFiles = this.#localeDiffCalculator.updateTargetLocales(
                            updatedTargetLocaleFiles,
                            translatedKeys,
                        );
                    }
                }

                updatedTargetLocaleFiles = this.#applyPlannedExtraKeyRemovals(plan.actions, updatedTargetLocaleFiles);

                const localeFilesToWrite = this.#collectLocaleFilesToWrite(plan.actions, updatedTargetLocaleFiles);

                if (executionPolicy.writeFiles && Object.keys(localeFilesToWrite).length > 0) {
                    this.#localeRepository.writeAll(localeFilesToWrite);
                    writtenFileCount = Object.keys(localeFilesToWrite).length;
                }

                if (executionPolicy.writeFiles && (snapshot === null || this.#shouldSaveSnapshot(plan.actions, snapshot))) {
                    this.#snapshotRepository.save(runtimeConfig.snapshot.file, sourceLocale, sourceLocaleFile);
                }
            } catch (error) {
                if (error instanceof TranslationProviderExecutionError) {
                    providerIssues = [
                        {
                            type: "provider-error",
                            severity: "error",
                            locale: "global",
                            key: "translation-execution",
                            message: error.message,
                        },
                    ];
                } else {
                    throw error;
                }
            }
        }

        const issues = [
            ...this.#validationEngine.validate({
                sourceLocaleFile,
                targetLocaleFiles: updatedTargetLocaleFiles,
                diffResult,
                validationConfig: runtimeConfig.validation,
            }),
            ...providerIssues,
        ];

        const report = this.#runReporter.buildReport({
            command: flags.command,
            sourceLocale,
            targetLocales: Object.keys(targetLocaleFiles),
            diffResult,
            translatedCount,
            writtenFileCount,
            issues,
            hasProviderFailure: providerIssues.length > 0,
        });

        this.#emitReport(report);

        return this.#resolveExitCode(report);
    }

    /**
     * Filters target locales using the optional CLI locale filter.
     *
     * @param locales - All available target locale files
     * @returns Filtered target locale files
     */
    #filterLocales(locales: LocaleFiles): LocaleFiles {
        const selectedLocales = this.#config.flags.locales;

        if (!selectedLocales?.length) {
            return locales;
        }

        return Object.fromEntries(Object.entries(locales).filter(([locale]) => selectedLocales.includes(locale)));
    }

    /**
     * Resolves whether the current command is allowed to execute planned
     * mutations and write files.
     *
     * @returns Execution policy
     */
    #resolveExecutionPolicy(): {
        executePlan: boolean;
        writeFiles: boolean;
        reason?: string;
    } {
        const flags = this.#config.flags;

        if (flags.command === "check" || flags.command === "report") {
            return {
                executePlan: false,
                writeFiles: false,
                reason: "Running in analysis mode.",
            };
        }

        const writeAllowed = flags.write && !flags.dryRun;

        if (flags.dryRun) {
            return {
                executePlan: true,
                writeFiles: false,
                reason: "Dry-run mode is active. Changes will not be written.",
            };
        }

        if (!flags.write) {
            return {
                executePlan: false,
                writeFiles: false,
                reason: "Run with --write to apply planned locale changes.",
            };
        }

        return {
            executePlan: true,
            writeFiles: writeAllowed,
        };
    }

    /**
     * Translates all entries requested by the current plan.
     *
     * @param actions - Ordered plan actions
     * @returns Translated flat locale entries grouped by locale
     */
    async #translatePlannedEntries(actions: Array<PlanAction>): Promise<FlatLocaleFiles> {
        if (!this.#translationExecutor) {
            throw new Error("Translation executor was not initialized.");
        }

        return this.#translationExecutor.execute(actions);
    }

    /**
     * Returns whether the current plan includes translation work.
     *
     * @param actions - Ordered plan actions
     * @returns Whether translation is required
     */
    #planRequiresTranslation(actions: Array<PlanAction>): boolean {
        return actions.some((action) => action.type === "translate-missing" || action.type === "retranslate-modified");
    }

    /**
     * Lazily initializes the translation executor.
     *
     * Provider setup is deferred until translation work is actually required so
     * commands such as `check`, `report`, and pure cleanup runs do not require a
     * provider configuration or API key.
     */
    #initializeTranslationExecutor(): void {
        if (this.#translationExecutor) {
            return;
        }

        const translationProvider = new TranslationProviderFactory().create(this.#config.config, this.#plugin, this.#logger);

        this.#translationExecutor = new TranslationExecutor(
            translationProvider,
            this.#config.config.translation,
            this.#config.config,
            this.#logger,
        );
    }

    /**
     * Applies all extra-key removal actions requested by the current plan.
     *
     * @param actions - Ordered plan actions
     * @param targetLocaleFiles - Current target locale files
     * @returns Updated target locale files
     */
    #applyPlannedExtraKeyRemovals(actions: Array<PlanAction>, targetLocaleFiles: LocaleFiles): LocaleFiles {
        const updatedTargetLocaleFiles: LocaleFiles = { ...targetLocaleFiles };

        for (const action of actions) {
            if (action.type !== "remove-extra-keys") {
                continue;
            }

            const currentTargetLocaleFile = updatedTargetLocaleFiles[action.locale] || {};
            updatedTargetLocaleFiles[action.locale] = this.#localeDiffCalculator.removeExtraKeys(
                currentTargetLocaleFile,
                action.entries,
            );
        }

        return updatedTargetLocaleFiles;
    }

    /**
     * Collects the locale files that should be written for the current plan.
     *
     * Only locales explicitly scheduled with `write-locale-file` are included.
     *
     * @param actions - Ordered plan actions
     * @param targetLocaleFiles - Updated target locale files
     * @returns Locale files to write
     */
    #collectLocaleFilesToWrite(actions: Array<PlanAction>, targetLocaleFiles: LocaleFiles): LocaleFiles {
        const localesToWrite = [
            ...new Set(
                actions
                    .filter(
                        (action): action is Extract<PlanAction, { type: "write-locale-file" }> =>
                            action.type === "write-locale-file",
                    )
                    .map((action) => action.locale),
            ),
        ].sort();

        const localeFilesToWrite: LocaleFiles = {};

        for (const locale of localesToWrite) {
            const localeFile = targetLocaleFiles[locale];

            if (localeFile) {
                localeFilesToWrite[locale] = localeFile;
            }
        }

        return localeFilesToWrite;
    }

    /**
     * Returns whether the source snapshot should be updated after execution.
     *
     * Snapshot persistence defines the baseline for future modified-key detection.
     *
     * This helper only decides whether an action-based write should advance the
     * snapshot. The caller is still responsible for enforcing write-mode guards
     * and zero-action bootstrap behavior.
     *
     * Snapshot is saved when:
     * - missing keys were translated (`translate-missing`)
     * - modified keys were retranslated (`retranslate-modified`)
     * - no previous snapshot exists and extra keys were removed during initial
     *   bootstrap (`remove-extra-keys`)
     *
     * Snapshot is NOT saved when:
     * - only extra keys were removed and a snapshot already exists
     *
     * @param actions - Ordered plan actions
     * @param snapshot - Previously loaded snapshot, or null when none exists
     * @returns Whether the snapshot should be saved after a mutating run
     */
    #shouldSaveSnapshot(actions: Array<PlanAction>, snapshot: Record<string, string> | null): boolean {
        const hasTranslationWork = actions.some(
            (action) => action.type === "translate-missing" || action.type === "retranslate-modified",
        );

        const isBootstrap = snapshot === null;
        const hasCleanupOnly = actions.some((action) => action.type === "remove-extra-keys");

        return hasTranslationWork || (isBootstrap && hasCleanupOnly);
    }

    /**
     * Emits the run report to console and optionally to a report file.
     *
     * CLI flags take precedence over config-level runtime defaults.
     *
     * @param report - Structured run report
     */
    #emitReport(report: RunReport): void {
        const flags = this.#config.flags;
        const runtimeConfig = this.#config.config;
        const reportFilePath = flags.reportFile ?? runtimeConfig.runtime.reportFile;

        if (flags.command === "report") {
            const consoleReportFormat = this.#resolveReportFormat(flags.reportFormat, undefined, "markdown");
            const content = this.#runReporter.serialize(report, consoleReportFormat);

            this.#logger.info(content.trimEnd());
        }

        if (!reportFilePath) {
            return;
        }

        const fileReportFormat = this.#resolveReportFormat(flags.reportFormat, reportFilePath, "json");
        const content = this.#runReporter.serialize(report, fileReportFormat);

        this.#runReportRepository.write(reportFilePath, content);
        this.#runConsoleReporter.logReportWritten(reportFilePath);
    }

    /**
     * Resolves the final process exit code from the generated report and the
     * active policy flags.
     *
     * CLI flags take precedence over config-level runtime defaults.
     *
     * @param report - Structured run report
     * @returns Process exit code
     */
    #resolveExitCode(report: RunReport): ExitCode {
        const flags = this.#config.flags;
        const runtimeConfig = this.#config.config;
        const failOnWarnings = flags.failOnWarnings ?? runtimeConfig.runtime.failOnWarnings;
        const failOnChanges = flags.failOnChanges ?? runtimeConfig.runtime.failOnChanges;

        if (report.issues.some((issue) => issue.type === "provider-error")) {
            return ExitCode.ProviderError;
        }

        if (this.#hasErrorIssues(report)) {
            return ExitCode.ValidationError;
        }

        if (failOnWarnings && this.#hasWarningIssues(report)) {
            return ExitCode.ValidationError;
        }

        if (failOnChanges && report.summary.hasChanges) {
            return ExitCode.ChangesDetected;
        }

        return ExitCode.Success;
    }

    /**
     * Returns whether the report contains at least one error-severity issue.
     *
     * @param report - Structured run report
     * @returns Whether error issues exist
     */
    #hasErrorIssues(report: RunReport): boolean {
        return report.issues.some((issue) => issue.severity === "error");
    }

    /**
     * Returns whether the report contains at least one warning-severity issue.
     *
     * @param report - Structured run report
     * @returns Whether warning issues exist
     */
    #hasWarningIssues(report: RunReport): boolean {
        return report.issues.some((issue) => issue.severity === "warning");
    }

    /**
     * Resolves the report format from CLI flags, file path, and default fallback.
     *
     * @param explicitFormat - Explicit CLI report format
     * @param reportFilePath - Optional output file path
     * @param defaultFormat - Default format when no stronger signal exists
     * @returns Resolved report format
     */
    #resolveReportFormat(
        explicitFormat: ReportFormat | undefined,
        reportFilePath: string | undefined,
        defaultFormat: ReportFormat,
    ): ReportFormat {
        if (explicitFormat) {
            return explicitFormat;
        }

        if (reportFilePath?.endsWith(".md") || reportFilePath?.endsWith(".markdown")) {
            return "markdown";
        }

        return defaultFormat;
    }

    /**
     * Counts the total number of flat translation entries across all locales.
     *
     * @param localeFiles - Flat locale files grouped by locale
     * @returns Total entry count
     */
    #countFlatLocaleEntries(localeFiles: FlatLocaleFiles): number {
        return Object.values(localeFiles).reduce((total, entries) => total + Object.keys(entries).length, 0);
    }
}
