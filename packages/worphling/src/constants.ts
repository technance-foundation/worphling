import OpenAI from "openai";

export const ANSI_COLORS = {
    green: "\x1b[32m%s\x1b[0m",
    red: "\x1b[31m%s\x1b[0m",
    yellow: "\x1b[33m%s\x1b[0m",
};

export const SUCCESS_STATUS_CODE = 0;

export const ERROR_STATUS_CODE = 1;

export const DEFAULT_OPEN_AI_MODEL: OpenAI.Chat.ChatModel = "gpt-4";
