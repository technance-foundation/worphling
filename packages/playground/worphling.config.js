//@ts-check
/** @type {import('@invexa/worphling').Config} */
const config = {
    apiKey: "your-api-key",
    service: "openai",
    sourceFile: "./locales/en.json",
    outputDir: "./locales",
    languages: ["es", "fr", "de"],
    sourceLanguage: "en",
};

export default config;
