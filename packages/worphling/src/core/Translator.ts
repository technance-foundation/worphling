import { OpenAI } from "openai";
import { FlatLangFiles, AppConfig, Flags } from "../types";
import { EXAMPLE_INPUT, EXAMPLE_NEXT_INTL_INPUT, EXAMPLE_NEXT_INTL_OUTPUT, EXAMPLE_OUTPUT } from "./examples";

export class Translator {
    private client: OpenAI;
    private model: string;
    private flags: Flags;

    constructor({ service, flags }: AppConfig) {
        const { apiKey, model = "gpt-4o-2024-11-20" } = service;
        this.client = new OpenAI({ apiKey });
        this.model = model;
        this.flags = flags;
    }

    async translate(missingKeys: FlatLangFiles): Promise<FlatLangFiles> {
        const responseText = await this.fetchTranslations(missingKeys);
        return this.parseTranslations(responseText, missingKeys);
    }

    private async fetchTranslations(missingKeys: FlatLangFiles): Promise<string> {
        const { isNextIntlEnabled, isTryingExactLengthEnabled } = this.flags;

        const response = await this.client.chat.completions.create({
            model: this.model,
            response_format: {
                type: "json_object",
            },
            messages: [
                {
                    role: "system",
                    content: `
                    You are a translation assistant. Translate the following keys and texts into their specified languages.
                    Always respond with valid JSON format matching the input structure.
                    Example input: ${isNextIntlEnabled ? EXAMPLE_NEXT_INTL_INPUT : EXAMPLE_INPUT}
                    Example output: ${isNextIntlEnabled ? EXAMPLE_NEXT_INTL_OUTPUT : EXAMPLE_OUTPUT}
                    Make sure to not include the response in \`\`\`json block. Your response must be a parse-able json format.
                    ${isTryingExactLengthEnabled && "Translated responses must not exceed the length of their input."}    
                `,
                },
                {
                    role: "user",
                    content: `${JSON.stringify(missingKeys, null, 2)}`,
                },
            ],
            temperature: 0,
        });

        const json = response.choices[0]?.message?.content;
        return json || "{}";
    }

    private parseTranslations(responseText: string, originalKeys: FlatLangFiles): FlatLangFiles {
        try {
            const parsedResponse = JSON.parse(responseText);
            const translatedKeys: FlatLangFiles = {};

            for (const lang in originalKeys) {
                translatedKeys[lang] = parsedResponse[lang] || {};
            }

            return translatedKeys;
        } catch (error) {
            console.error("Failed to parse translation response:", error);
            throw new Error("Translation response was not valid JSON.");
        }
    }
}
