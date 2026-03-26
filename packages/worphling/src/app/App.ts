import { omit } from "lodash-es";

import { ANSI_COLORS } from "../constants.js";
import { LocaleDiffCalculator, LocaleStructure } from "../domain/index.js";
import { JsonLocaleRepository, RunReportRepository, SnapshotRepository } from "../infrastructure/index.js";
import { Translator } from "../providers/index.js";
import type { AppConfig, FlatLocaleFiles, LocaleFiles, PlanAction, ReportFormat, RunReport } from "../types.js";
import { ExitCode } from "../types.js";

import { RunPlanner } from "./RunPlanner.js";
import { RunReporter } from "./RunReporter.js";

/**
 * Main Worphling application runtime.
 *
 * This class orchestrates:
 * - reading locale files
 * - identifying source and target locales
 * - building the diff and execution plan
 * - invoking the translation provider when needed
 * - writing updated locale files
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

        this.#config = config;
        this.#localeRepository = new JsonLocaleRepository(config.config.localesDir, config.config.output);
        this.#snapshotRepository = new SnapshotRepository(localeStructure);
        this.#localeDiffCalculator = localeDiffCalculator;
        this.#runPlanner = new RunPlanner(localeDiffCalculator);
        this.#runReporter = new RunReporter();
        this.#runReportRepository = new RunReportRepository();
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

        const missingCount = this.#countFlatLocaleEntries(diffResult.missing);
        const extraCount = this.#countFlatLocaleEntries(diffResult.extra);
        const modifiedCount = this.#countFlatLocaleEntries(diffResult.modified);

        this.#logDetectedChanges(missingCount, extraCount, modifiedCount);

        let updatedTargetLocaleFiles = { ...targetLocaleFiles };
        let translatedKeys: FlatLocaleFiles = {};
        let translatedCount = 0;
        let writtenFileCount = 0;

        if (plan.actions.length === 0) {
            console.log(ANSI_COLORS.green, "All target languages are already translated and up to date.");

            if (runtimeConfig.output.sortKeys && flags.command !== "check" && flags.command !== "report") {
                console.log(ANSI_COLORS.yellow, "Sorting all files as requested...");
            }

            if (!flags.dryRun && flags.command !== "check" && flags.command !== "report") {
                const filesToWrite: LocaleFiles = {
                    ...updatedTargetLocaleFiles,
                    [sourceLocale]: sourceLocaleFile,
                };

                this.#localeRepository.writeAll(filesToWrite);
                writtenFileCount = Object.keys(filesToWrite).length;
            }

            if (!snapshot && runtimeConfig.detection.snapshotFile && !flags.dryRun) {
                this.#snapshotRepository.save(runtimeConfig.detection.snapshotFile, sourceLocale, sourceLocaleFile);
            }
        } else if (flags.command !== "check" && flags.command !== "report") {
            translatedKeys = await this.#translatePlannedEntries(plan.actions);
            translatedCount = this.#countFlatLocaleEntries(translatedKeys);

            if (translatedCount > 0) {
                updatedTargetLocaleFiles = this.#localeDiffCalculator.updateTargetLocales(
                    updatedTargetLocaleFiles,
                    translatedKeys,
                );
            }

            updatedTargetLocaleFiles = this.#applyPlannedExtraKeyRemovals(plan.actions, updatedTargetLocaleFiles);

            if (runtimeConfig.output.sortKeys) {
                console.log(ANSI_COLORS.yellow, "Sorting all files as requested...");
            }

            if (!flags.dryRun) {
                const filesToWrite: LocaleFiles = {
                    ...updatedTargetLocaleFiles,
                    [sourceLocale]: sourceLocaleFile,
                };

                this.#localeRepository.writeAll(filesToWrite);
                writtenFileCount = Object.keys(filesToWrite).length;

                if (runtimeConfig.detection.snapshotFile) {
                    this.#snapshotRepository.save(runtimeConfig.detection.snapshotFile, sourceLocale, sourceLocaleFile);
                }
            }
        }

        const report = this.#runReporter.buildReport({
            command: flags.command,
            sourceLocale,
            targetLocales: Object.keys(targetLocaleFiles),
            diffResult,
            translatedCount,
            writtenFileCount,
        });

        this.#emitReport(report, ciMode);

        if (report.summary.hasChanges && (flags.failOnChanges || runtimeConfig.ci.failOnChanges)) {
            return ExitCode.ChangesDetected;
        }

        return ExitCode.Success;
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
     * Logs detected diff counts in a stable order.
     *
     * @param missingCount - Total missing key count
     * @param extraCount - Total extra key count
     * @param modifiedCount - Total modified key count
     */
    #logDetectedChanges(missingCount: number, extraCount: number, modifiedCount: number): void {
        if (missingCount > 0) {
            console.log(ANSI_COLORS.yellow, `Found ${missingCount} missing translations across all languages.`);
        }

        if (extraCount > 0) {
            console.log(
                ANSI_COLORS.yellow,
                `Found ${extraCount} extra translation key${extraCount > 1 ? "s" : ""} across all languages.`,
            );
        }

        if (modifiedCount > 0) {
            console.log(ANSI_COLORS.yellow, `Found ${modifiedCount} modified keys that need retranslation.`);
        }
    }

    /**
     * Translates all entries requested by the current plan.
     *
     * @param actions - Ordered plan actions
     * @returns Translated flat locale entries grouped by locale
     */
    async #translatePlannedEntries(actions: Array<PlanAction>): Promise<FlatLocaleFiles> {
        const keysToTranslate: FlatLocaleFiles = {};

        for (const action of actions) {
            if (action.type !== "translate-missing" && action.type !== "retranslate-modified") {
                continue;
            }

            keysToTranslate[action.locale] = {
                ...(keysToTranslate[action.locale] || {}),
                ...action.entries,
            };
        }

        if (!Object.keys(keysToTranslate).length) {
            return {};
        }

        const translator = new Translator(this.#config.config);

        return translator.translateAll(keysToTranslate);
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
        console.log(ANSI_COLORS.green, `Success: Report written to ${reportFilePath}`);
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
