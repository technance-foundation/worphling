//@ts-check
/** @type {import('@invexa/worphling').Config} */
const config = {
    service: {
        apiKey: "API_KEY",
        name: "OpenAI",
    },
    source: {
        file: "./locales/en.json",
        directory: "./locales",
    },
};

export default config;
