export interface Config {
    service: {
        name: "OpenAI";
        apiKey: string;
        model?: string;
    };
    source: {
        file: string;
        directory: string;
    };
}

export type LangFile = Record<string, any>;

export type LangFiles = Record<string, LangFile>;

export type FlatLangFile = Record<string, string>;

export type FlatLangFiles = Record<string, Record<string, string>>;
