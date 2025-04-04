import minimist from "minimist";
import { Flags } from "../types";

export class Cli {
    public flags: Flags;

    constructor() {
        this.flags = this.detectFlags();
    }

    private detectFlags(): Flags {
        const args = minimist(process.argv.slice(2), {
            boolean: ["try-exact-length", "with-sorting"],
            default: { "try-exact-length": false, "with-sorting": false },
        });

        const isTryingExactLengthEnabled = args["try-exact-length"];
        const isSortingEnabled = args["with-sorting"];

        return { isTryingExactLengthEnabled, isSortingEnabled };
    }
}
