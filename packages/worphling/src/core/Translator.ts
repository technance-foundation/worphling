import { OpenAI } from "openai";
import { FlatLangFiles, FlatLangFile, Config } from "../types";

export class Translator {
    private client: OpenAI;
    private model: OpenAI.Chat.ChatModel;

    constructor({ apiKey, name, model = "gpt-4" }: Config["service"]) {
        this.client = new OpenAI({ apiKey, project: name });
        this.model = model;
    }

    private async translator(text: string, lang: string): Promise<string | null> {
        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: `You will be provided with a sentence in English, and your task is to translate it into this locale ${lang}.`,
                    },
                    {
                        role: "user",
                        content: text,
                    },
                ],
                temperature: 0.7,
            });
            return completion.choices[0].message.content;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            console.error(message);
            throw error;
        }
    }

    async translate(missingKeys: FlatLangFiles): Promise<FlatLangFiles> {
        const translatedKeys: FlatLangFiles = {};

        for (const [lang, keys] of Object.entries(missingKeys)) {
            const translatedLangKeys: FlatLangFile = {};

            for (const [key, text] of Object.entries(keys)) {
                const translatedText = await this.translator(text, lang);
                translatedLangKeys[key] = translatedText ?? text;
            }

            translatedKeys[lang] = translatedLangKeys;
        }

        return translatedKeys;
    }
}
