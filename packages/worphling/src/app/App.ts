import { omit } from "lodash-es";

import { LocaleDiffCalculator, LocaleStructure, TranslationPluginRegistry, ValidationEngine } from "../domain/index.js";
import { JsonLocaleRepository, RunReportRepository, SnapshotRepository } from "../infrastructure/index.js";
import { TranslationProviderFactory } from "../providers/index.js";
import type {
    AppConfig,
    FlatLocaleFiles,
    LocaleFiles,
    PlanAction,
    ReportFormat,
    RunReport,
    TranslationProviderContract,
} from "../types.js";
import { ExitCode } from "../types.js";

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
     * Validation engine used to collect structured validation issues.
     */
    #validationEngine: ValidationEngine;

    /**
     * Reporter used to build and serialize run reports.
     */
    #runReporter: RunReporter;

    /**
     * Repository used for report file persistence.
     */
    #runReportRepository: RunReportRepository;

    /**
     * Translation executor used for batching, retries, concurrency, and
     * deterministic merge behavior.
     */
    #translationExecutor: TranslationExecutor;

    /**
     * Creates a new Worphling runtime application.
     *
     * @param config - Runtime config and CLI flags
     */
    constructor(config: AppConfig) {
        const localeStructure = new LocaleStructure();
        const localeDiffCalculator = new LocaleDiffCalculator(localeStructure);
        const plugin = new TranslationPluginRegistry().resolve(config.config.plugin.name);
        const translationProvider: TranslationProviderContract = new TranslationProviderFactory().create(config.config, plugin);

        this.#config = config;
        this.#localeRepository = new JsonLocaleRepository(config.config.localesDir, config.config.output);
        this.#snapshotRepository = new SnapshotRepository(localeStructure);
        this.#localeDiffCalculator = localeDiffCalculator;
        this.#runPlanner = new RunPlanner(localeDiffCalculator);
        this.#validationEngine = new ValidationEngine(plugin, localeStructure);
        this.#runReporter = new RunReporter();
        this.#runReportRepository = new RunReportRepository();
        this.#translationExecutor = new TranslationExecutor(translationProvider, config.config.translation, config.config);
    }

    /**
     * Executes the application.
     *
     * @returns Process exit code
     */
    async run(): Promise<ExitCode> {
        const runtimeConfig = this.#config.config;
        const flags = this.#config.flags;
        const ciMode = flags.ci || runtimeConfig.ci.mode;

        const allLocaleFiles = this.#localeRepository.readAll();
        const sourceLocale = runtimeConfig.sourceLocale;
        const sourceLocaleFile = allLocaleFiles[sourceLocale];

        if (!sourceLocaleFile) {
            throw new Error(`Source locale "${sourceLocale}" was not found in "${runtimeConfig.localesDir}".`);
        }

        const allTargetLocaleFiles = omit(allLocaleFiles, sourceLocale) as LocaleFiles;
        const targetLocaleFiles = this.#filterLocales(allTargetLocaleFiles);
        const snapshot = this.#snapshotRepository.load(runtimeConfig.detection.snapshotFile);

        const diffResult = this.#runPlanner.analyze(sourceLocaleFile, targetLocaleFiles, snapshot);
        const plan = this.#runPlanner.createPlan(diffResult, flags.command);
        const executionPolicy = this.#resolveExecutionPolicy(ciMode);

        let updatedTargetLocaleFiles = { ...targetLocaleFiles };
        let translatedKeys: FlatLocaleFiles = {};
        let translatedCount = 0;
        let writtenFileCount = 0;

        if (executionPolicy.executePlan && plan.actions.length > 0) {
            translatedKeys = await this.#translatePlannedEntries(plan.actions);
            translatedCount = this.#countFlatLocaleEntries(translatedKeys);

            if (translatedCount > 0) {
                updatedTargetLocaleFiles = this.#localeDiffCalculator.updateTargetLocales(
                    updatedTargetLocaleFiles,
                    translatedKeys,
                );
            }

            updatedTargetLocaleFiles = this.#applyPlannedExtraKeyRemovals(plan.actions, updatedTargetLocaleFiles);

            const localeFilesToWrite = this.#collectLocaleFilesToWrite(plan.actions, updatedTargetLocaleFiles);

            if (executionPolicy.writeFiles && Object.keys(localeFilesToWrite).length > 0) {
                this.#localeRepository.writeAll(localeFilesToWrite);
                writtenFileCount = Object.keys(localeFilesToWrite).length;
            }

            if (executionPolicy.writeFiles && runtimeConfig.detection.snapshotFile && this.#shouldSaveSnapshot(plan.actions)) {
                this.#snapshotRepository.save(runtimeConfig.detection.snapshotFile, sourceLocale, sourceLocaleFile);
            }
        }

        const issues = this.#validationEngine.validate({
            sourceLocaleFile,
            targetLocaleFiles: updatedTargetLocaleFiles,
            diffResult,
            validationConfig: runtimeConfig.validation,
        });

        const report = this.#runReporter.buildReport({
            command: flags.command,
            sourceLocale,
            targetLocales: Object.keys(targetLocaleFiles),
            diffResult,
            translatedCount,
            writtenFileCount,
            issues,
        });

        this.#emitReport(report, ciMode);

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
     * @param ciMode - Whether CI mode is active
     * @returns Execution policy
     */
    #resolveExecutionPolicy(ciMode: boolean): {
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

        const writeAllowed = flags.write && !flags.dryRun && !ciMode;

        if (ciMode) {
            return {
                executePlan: true,
                writeFiles: false,
                reason: "CI mode is active. Running in non-mutating mode.",
            };
        }

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
        return this.#translationExecutor.execute(actions);
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
     * Snapshot updates are only required when modified source entries were
     * retranslated successfully.
     *
     * @param actions - Ordered plan actions
     * @returns Whether the snapshot should be saved
     */
    #shouldSaveSnapshot(actions: Array<PlanAction>): boolean {
        return actions.some((action) => action.type === "retranslate-modified");
    }

    /**
     * Emits the run report to console and optionally to a report file.
     *
     * @param report - Structured run report
     * @param ciMode - Whether CI mode is active
     */
    #emitReport(report: RunReport, ciMode: boolean): void {
        const flags = this.#config.flags;
        const runtimeConfig = this.#config.config;
        const reportFilePath = flags.reportFile || (ciMode ? runtimeConfig.ci.reportFile : undefined);

        if (flags.command === "report") {
            const consoleReportFormat = this.#resolveReportFormat(flags.reportFormat, undefined, "markdown");
            const content = this.#runReporter.serialize(report, consoleReportFormat);

            console.log(content);
        }

        if (!reportFilePath) {
            return;
        }

        const fileReportFormat = this.#resolveReportFormat(flags.reportFormat, reportFilePath, "json");
        const content = this.#runReporter.serialize(report, fileReportFormat);

        this.#runReportRepository.write(reportFilePath, content);
    }

    /**
     * Resolves the final process exit code from the generated report and the
     * active policy flags.
     *
     * @param report - Structured run report
     * @returns Process exit code
     */
    #resolveExitCode(report: RunReport): ExitCode {
        const flags = this.#config.flags;
        const runtimeConfig = this.#config.config;

        if (this.#hasErrorIssues(report)) {
            return ExitCode.ValidationError;
        }

        if ((flags.failOnWarnings || runtimeConfig.ci.failOnWarnings) && this.#hasWarningIssues(report)) {
            return ExitCode.ValidationError;
        }

        if (report.summary.hasChanges && (flags.failOnChanges || runtimeConfig.ci.failOnChanges)) {
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
