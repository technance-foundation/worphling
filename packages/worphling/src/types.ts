import OpenAI from "openai";

export interface Config {
    service: {
        name: "OpenAI";
        apiKey: string;
        model?: OpenAI.Chat.ChatModel;
        options?: Options;
    };
    source: {
        file: string;
        directory: string;
    };
    options?: Options;
}

export interface Options {
    isTryExactLength: boolean;
}

export type LangFile = Record<string, any>;

export type LangFiles = Record<string, LangFile>;

export type FlatLangFile = Record<string, string>;

export type FlatLangFiles = Record<string, FlatLangFile>;
