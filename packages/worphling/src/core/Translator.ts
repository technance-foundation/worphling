import { OpenAI } from "openai";
import { FlatLangFiles, Flags, AppConfig } from "../types";

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
        const exampleInput = `
            {
              "es": {
                "app.auth.login.buttons.forgotPassword": "Forgot Password?",
                "landing.errors.404.message": "The page you're looking for doesn't exist.",
                "landing.errors.404.title": "Page Not Found",
                "landing.errors.500.message": "Something went wrong. Please try again later.",
                "landing.errors.500.title": "Server Error"
              },
              "fa": {
                "app.auth.login.errors.accountLocked": "Account locked. Contact support."
              },
              "ru": {
                "app.errors.500.message": "Something went wrong. Please try again later.",
                "app.errors.500.title": "Server Error"
              }
            }
        `;
        const exampleOutput = `
            {
              "es": {
                "app.auth.login.buttons.forgotPassword": "¿Olvidaste tu contraseña?",
                "landing.errors.404.message": "La página que estás buscando no existe.",
                "landing.errors.404.title": "Página no encontrada",
                "landing.errors.500.message": "Algo salió mal. Por favor, inténtalo de nuevo más tarde.",
                "landing.errors.500.title": "Error del servidor"
              },
              "fa": {
                "app.auth.login.errors.accountLocked": "حساب شما قفل شده است. با پشتیبانی تماس بگیرید."
              },
              "ru": {
                "app.errors.500.message": "Что-то пошло не так. Пожалуйста, попробуйте позже.",
                "app.errors.500.title": "Ошибка сервера"
              }
            }
        `;

        const isTryExactLength = this.flags.isTryExactLength;

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
                    Example input: ${exampleInput}
                    Example output: ${exampleOutput}
                    Make sure to not include the response in \`\`\`json block. Your response must be a parse-able json format.
                    ${isTryExactLength && "Translated responses must not exceed the length of their input."}    
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
