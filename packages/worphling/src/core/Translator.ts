import { OpenAI } from "openai";
import { FlatLangFiles, FlatLangFile, Config, OpenAiMessage } from "../types";
import { DEFAULT_OPEN_AI_MODEL } from "../constants";
import { TranslatorError } from "./errors";

export class Translator {
    private openAiClient: OpenAI;
    private model: OpenAI.Chat.ChatModel;

    constructor({ apiKey, name, model = DEFAULT_OPEN_AI_MODEL }: Config["service"]) {
        this.openAiClient = new OpenAI({ apiKey, project: name });
        this.model = model;
    }

    private generateConfigMessage(lang: string): OpenAiMessage {
        return {
            role: "system",
            content: `You will be provided with a sentence in English, and your task is to translate it into this locale ${lang}.`,
        };
    }

    private async translator(text: string, lang: string): Promise<string | null> {
        try {
            const completion = await this.openAiClient.chat.completions.create({
                model: this.model,
                messages: [
                    this.generateConfigMessage(lang),
                    {
                        role: "user",
                        content: text,
                    },
                ],
                temperature: 0.7,
                top_p: 1,
            });
            return completion.choices[0].message.content;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            throw new TranslatorError(message);
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
