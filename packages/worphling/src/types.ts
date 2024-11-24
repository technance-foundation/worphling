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
