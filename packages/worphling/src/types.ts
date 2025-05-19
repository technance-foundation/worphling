import OpenAI from "openai";

export interface Config {
    service: {
        name: "OpenAI";
        apiKey: string;
        model?: OpenAI.Chat.ChatModel;
    };
    source: {
        file: string;
        directory: string;
    };
    plugin: `${Plugin}`;
}

export interface Flags {
    isTryingExactLengthEnabled: boolean;
    isSortingEnabled: boolean;
    isModifiedDetectionSkipped: boolean;
    isForceRetranslateAllEnabled: boolean;
}

export type AppConfig = Config & {
    flags: Flags;
};

export enum Plugin {
    NextIntl = "next-intl",
    None = "none",
}

export type LangFile = Record<string, any>;

export type LangFiles = Record<string, LangFile>;

export type FlatLangFile = Record<string, string>;

export type FlatLangFiles = Record<string, FlatLangFile>;
