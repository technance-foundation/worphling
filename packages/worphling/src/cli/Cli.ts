import minimist from "minimist";
import { Flags } from "../types";

export class Cli {
    public flags: Flags;

    constructor() {
        this.flags = this.detectFlags();
    }

    private detectFlags(): Flags {
        const args = minimist(process.argv.slice(2), {
            boolean: ["try-exact-length", "next-intl"],
            default: { "try-exact-length": false, "next-intl": false },
        });

        const isTryingExactLengthEnabled = args["try-exact-length"];
        const isNextIntlEnabled = args["next-intl"];

        return { isTryingExactLengthEnabled, isNextIntlEnabled };
    }
}
