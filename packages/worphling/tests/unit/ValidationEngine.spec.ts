import { describe, expect, it } from "vitest";

import { NoOpTranslationPlugin } from "../../src/domain/NoOpTranslationPlugin.js";
import { ValidationEngine } from "../../src/domain/ValidationEngine.js";
import type { DiffResult, LocaleFile, LocaleIssue, TranslationPluginContract, ValidationConfig } from "../../src/types.js";

/**
 * Default validation config used by validation-engine unit tests.
 */
const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
    preservePlaceholders: true,
    preserveIcuSyntax: true,
    preserveHtmlTags: true,
    failOnExtraKeys: false,
    failOnMissingKeys: false,
    failOnModifiedSource: false,
};

/**
 * Empty diff result used unless a test explicitly wants diff issues too.
 */
const EMPTY_DIFF_RESULT: DiffResult = {
    missing: {},
    extra: {},
    modified: {},
};

describe("ValidationEngine", () => {
    it("does not report placeholder errors for ICU branch literals", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    trade: {
                        status: "{status, select, error {Rejected} success {Verified} loading {Verifying} other {}} open trade",
                        title: "Order {status, select, error {failed} success {placed} loading {placing} other {}}",
                    },
                },
                targetLocaleFiles: {
                    fa: {
                        trade: {
                            status: "{status, select, error {رد شد} success {تأیید شد} loading {در حال تأیید} other {}} معامله باز",
                            title: "سفارش {status, select, error {ناموفق} success {ثبت شد} loading {در حال ثبت} other {}}",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-placeholder")).toHaveLength(0);
        expect(findIssuesByType(issues, "invalid-icu")).toHaveLength(0);
    });

    it("reports placeholder mismatch when a real argument is removed", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    auth: {
                        welcome: "Welcome {name} to {appName}",
                    },
                },
                targetLocaleFiles: {
                    fa: {
                        auth: {
                            welcome: "به برنامه خوش آمدید",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-placeholder")).toEqual([
            expect.objectContaining<Partial<LocaleIssue>>({
                type: "invalid-placeholder",
                locale: "fa",
                key: "auth.welcome",
                severity: "error",
            }),
        ]);
    });

    it("reports placeholder mismatch when a translator invents a new placeholder", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    auth: {
                        welcome: "Welcome {name}",
                    },
                },
                targetLocaleFiles: {
                    ru: {
                        auth: {
                            welcome: "Добро пожаловать {firstName} {lastName}",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-placeholder")).toEqual([
            expect.objectContaining<Partial<LocaleIssue>>({
                type: "invalid-placeholder",
                locale: "ru",
                key: "auth.welcome",
                severity: "error",
            }),
        ]);
    });

    it("accepts equivalent ICU plural structures with translated branch content", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    followers: {
                        count: "You have {count, plural, =0 {no followers yet} =1 {one follower} other {# followers}}.",
                    },
                },
                targetLocaleFiles: {
                    es: {
                        followers: {
                            count: "Tienes {count, plural, =0 {ningún seguidor todavía} =1 {un seguidor} other {# seguidores}}.",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-icu")).toHaveLength(0);
        expect(findIssuesByType(issues, "invalid-placeholder")).toHaveLength(0);
    });

    it("reports ICU mismatch when plural option keys change", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    followers: {
                        count: "You have {count, plural, =0 {no followers yet} =1 {one follower} other {# followers}}.",
                    },
                },
                targetLocaleFiles: {
                    es: {
                        followers: {
                            count: "Tienes {count, plural, one {un seguidor} other {# seguidores}}.",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-icu")).toEqual([
            expect.objectContaining<Partial<LocaleIssue>>({
                type: "invalid-icu",
                locale: "es",
                key: "followers.count",
                severity: "error",
            }),
        ]);
    });

    it("reports ICU mismatch when the argument name changes", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    price: {
                        summary:
                            "{totalPayment} USDT at {orderMode, select, limit {{price}} market {at current} other {}} market price",
                    },
                },
                targetLocaleFiles: {
                    fa: {
                        price: {
                            summary: "{amount} USDT در {orderMode, select, limit {{price}} market {قیمت فعلی} other {}}",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-icu")).toHaveLength(1);
        expect(findIssuesByType(issues, "invalid-placeholder")).toHaveLength(1);
    });

    it("reports invalid ICU when the target message is syntactically broken", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    auth: {
                        title: "Order {status, select, error {failed} success {placed} loading {placing} other {}}",
                    },
                },
                targetLocaleFiles: {
                    fa: {
                        auth: {
                            title: "سفارش {status, select, error {ناموفق} success {ثبت شد} loading {در حال ثبت} other {}",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-icu")).toEqual([
            expect.objectContaining<Partial<LocaleIssue>>({
                type: "invalid-icu",
                locale: "fa",
                key: "auth.title",
                severity: "error",
            }),
        ]);
    });

    it("accepts nested rich-text tags when structure is preserved", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    profile: {
                        greeting: "Hello <bold>{name}</bold>, open <link>your <italic>profile</italic></link>.",
                    },
                },
                targetLocaleFiles: {
                    fa: {
                        profile: {
                            greeting: "سلام <bold>{name}</bold>، <link><italic>پروفایل</italic> شما</link> را باز کنید.",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-tag")).toHaveLength(0);
        expect(findIssuesByType(issues, "invalid-placeholder")).toHaveLength(0);
        expect(findIssuesByType(issues, "invalid-icu")).toHaveLength(0);
    });

    it("reports tag mismatch when a rich-text tag is removed", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    profile: {
                        greeting: "Hello <bold>{name}</bold>",
                    },
                },
                targetLocaleFiles: {
                    ru: {
                        profile: {
                            greeting: "Привет {name}",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-tag")).toEqual([
            expect.objectContaining<Partial<LocaleIssue>>({
                type: "invalid-tag",
                locale: "ru",
                key: "profile.greeting",
                severity: "error",
            }),
        ]);
    });

    it("reports tag mismatch when the tag name changes", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    profile: {
                        greeting: "Hello <bold>{name}</bold>",
                    },
                },
                targetLocaleFiles: {
                    es: {
                        profile: {
                            greeting: "Hola <strong>{name}</strong>",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-tag")).toHaveLength(1);
    });

    it("respects validation flags and skips disabled checks", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    trade: {
                        title: "Order {status, select, error {failed} success {placed} loading {placing} other {}}",
                    },
                },
                targetLocaleFiles: {
                    fa: {
                        trade: {
                            title: "سفارش ثبت شد",
                        },
                    },
                },
                validationConfig: {
                    ...DEFAULT_VALIDATION_CONFIG,
                    preservePlaceholders: false,
                    preserveIcuSyntax: false,
                    preserveHtmlTags: false,
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-placeholder")).toHaveLength(0);
        expect(findIssuesByType(issues, "invalid-icu")).toHaveLength(0);
        expect(findIssuesByType(issues, "invalid-tag")).toHaveLength(0);
    });

    it("applies plugin validation overrides on top of base config", () => {
        const plugin = createPlugin({
            getValidationOverrides(): Partial<ValidationConfig> {
                return {
                    preserveHtmlTags: true,
                };
            },
        });

        const issues = createValidationEngine(plugin).validate(
            createInput({
                sourceLocaleFile: {
                    profile: {
                        greeting: "Hello <bold>{name}</bold>",
                    },
                },
                targetLocaleFiles: {
                    fa: {
                        profile: {
                            greeting: "سلام {name}",
                        },
                    },
                },
                validationConfig: {
                    ...DEFAULT_VALIDATION_CONFIG,
                    preservePlaceholders: false,
                    preserveIcuSyntax: false,
                    preserveHtmlTags: false,
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-tag")).toHaveLength(1);
    });

    it("emits diff issues with the configured severities", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    app: {
                        title: "Hello",
                    },
                },
                targetLocaleFiles: {
                    fa: {
                        app: {
                            title: "سلام",
                        },
                    },
                },
                diffResult: {
                    missing: {
                        fa: {
                            "app.subtitle": "Welcome",
                        },
                    },
                    extra: {
                        fa: {
                            "app.legacy": "Old value",
                        },
                    },
                    modified: {
                        fa: {
                            "app.title": "Hello v2",
                        },
                    },
                },
                validationConfig: {
                    ...DEFAULT_VALIDATION_CONFIG,
                    failOnMissingKeys: true,
                    failOnExtraKeys: false,
                    failOnModifiedSource: true,
                },
            }),
        );

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining<Partial<LocaleIssue>>({
                    type: "missing",
                    severity: "error",
                    locale: "fa",
                    key: "app.subtitle",
                }),
                expect.objectContaining<Partial<LocaleIssue>>({
                    type: "extra",
                    severity: "warning",
                    locale: "fa",
                    key: "app.legacy",
                }),
                expect.objectContaining<Partial<LocaleIssue>>({
                    type: "modified",
                    severity: "error",
                    locale: "fa",
                    key: "app.title",
                }),
            ]),
        );
    });

    it("sorts issues deterministically by locale, key, type, and message", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    zeta: "Hello {name}",
                    alpha: "Welcome <bold>{name}</bold>",
                },
                targetLocaleFiles: {
                    ru: {
                        zeta: "Привет",
                        alpha: "Добро пожаловать {name}",
                    },
                    fa: {
                        zeta: "سلام",
                        alpha: "خوش آمدید {name}",
                    },
                },
            }),
        );

        const sortedPairs = issues.map((issue) => `${issue.locale}:${issue.key}:${issue.type}`);

        expect(sortedPairs).toEqual([...sortedPairs].sort((left, right) => left.localeCompare(right)));
    });

    it("handles deeply nested mixed ICU, placeholders, and tags correctly", () => {
        const issues = createValidationEngine().validate(
            createInput({
                sourceLocaleFile: {
                    notifications: {
                        summary:
                            "<link>{name}</link> sent {count, plural, =0 {no messages} =1 {one message} other {# messages}} on {createdAt, date, medium}",
                    },
                },
                targetLocaleFiles: {
                    es: {
                        notifications: {
                            summary:
                                "<link>{name}</link> envió {count, plural, =0 {ningún mensaje} =1 {un mensaje} other {# mensajes}} el {createdAt, date, medium}",
                        },
                    },
                },
            }),
        );

        expect(findIssuesByType(issues, "invalid-placeholder")).toHaveLength(0);
        expect(findIssuesByType(issues, "invalid-icu")).toHaveLength(0);
        expect(findIssuesByType(issues, "invalid-tag")).toHaveLength(0);
    });
});

/**
 * Creates a validation engine for tests.
 *
 * @param plugin - Optional plugin override
 * @returns Validation engine instance
 */
function createValidationEngine(plugin: TranslationPluginContract = new NoOpTranslationPlugin()): ValidationEngine {
    return new ValidationEngine(plugin);
}

/**
 * Creates test input for the validation engine with sensible defaults.
 *
 * @param overrides - Partial input override
 * @returns Full validation engine input
 */
function createInput(overrides: {
    sourceLocaleFile: LocaleFile;
    targetLocaleFiles: Record<string, LocaleFile>;
    diffResult?: DiffResult;
    validationConfig?: ValidationConfig;
}) {
    return {
        sourceLocaleFile: overrides.sourceLocaleFile,
        targetLocaleFiles: overrides.targetLocaleFiles,
        diffResult: overrides.diffResult || EMPTY_DIFF_RESULT,
        validationConfig: overrides.validationConfig || DEFAULT_VALIDATION_CONFIG,
    };
}

/**
 * Returns only issues of the requested type.
 *
 * @param issues - Issue list
 * @param type - Issue type
 * @returns Filtered issues
 */
function findIssuesByType(issues: Array<LocaleIssue>, type: LocaleIssue["type"]): Array<LocaleIssue> {
    return issues.filter((issue) => issue.type === type);
}

/**
 * Creates a test plugin with overridable behavior.
 *
 * @param overrides - Plugin overrides
 * @returns Translation plugin
 */
function createPlugin(overrides?: { getValidationOverrides?: () => Partial<ValidationConfig> }): TranslationPluginContract {
    return {
        name: "none",
        getPromptContext() {
            return {
                additionalInstructions: [],
                exampleInput: "{}",
                exampleOutput: "{}",
            };
        },
        getValidationOverrides() {
            return overrides?.getValidationOverrides?.() || {};
        },
    };
}
