import minimist from "minimist";
import { Flags } from "../types";

export class Cli {
    public flags: Flags;

    constructor() {
        this.flags = this.detectFlags();
    }

    private detectFlags(): Flags {
        const args = minimist(process.argv.slice(2), {
            boolean: ["try-exact-length"],
            default: { "try-exact-length": false },
        });

        const isTryingExactLengthEnabled = args["try-exact-length"];

        return { isTryingExactLengthEnabled };
    }
}
