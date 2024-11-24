export interface Config {
    apiKey: string;
    service: string;
    source: {
        file: string;
        directory: string;
    };
}
