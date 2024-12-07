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
    plugin: Plugin;
}

export interface Flags {
    isTryingExactLengthEnabled: boolean;
}

export type AppConfig = Config & {
    flags: Flags;
};

export type Plugin = Record<"nextIntl", boolean>;

export type LangFile = Record<string, any>;

export type LangFiles = Record<string, LangFile>;

export type FlatLangFile = Record<string, string>;

export type FlatLangFiles = Record<string, FlatLangFile>;
