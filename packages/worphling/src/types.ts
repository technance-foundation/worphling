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
    flags: Flags;
}

export interface Flags {
    isTryExactLength: boolean;
}

export type LangFile = Record<string, any>;

export type LangFiles = Record<string, LangFile>;

export type FlatLangFile = Record<string, string>;

export type FlatLangFiles = Record<string, FlatLangFile>;
