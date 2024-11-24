//@ts-check
/** @type {import('@invexa/worphling').Config} */
const config = {
    apiKey: "your-api-key",
    service: "openai",
    source: {
        file: "./locales/en.json",
        directory: "./locales",
    },
};

export default config;
