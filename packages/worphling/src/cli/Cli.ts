import minimist from "minimist";
import { Flags } from "../types";
import { ANSI_COLORS } from "../constants";

export class Cli {
    public flags: Flags = { isTryExactLength: false };

    constructor() {
        this.flags = this.detectFlags();
    }

    private detectFlags(): Flags {
        const args = minimist(process.argv.slice(2), {
            boolean: ["try-exact-length"],
            default: { "try-exact-length": false },
        });

        const isTryExactLength = args["try-exact-length"];

        console.log(
            ANSI_COLORS[isTryExactLength ? "green" : "yellow"],
            `> Flag --try-exact-length is ${isTryExactLength ? "enabled" : "disabled"}.`
        );

        return { isTryExactLength };
    }
}
