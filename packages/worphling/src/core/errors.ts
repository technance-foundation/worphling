export class TranslatorError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TranslatorError";
    }
}
