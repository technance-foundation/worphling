import minimist from "minimist";
import { Flags } from "../types";

export class Cli {
    public flags: Flags;

    constructor() {
        this.flags = this.detectFlags();
    }

    private detectFlags(): Flags {
        const args = minimist(process.argv.slice(2), {
            boolean: ["try-exact-length", "with-sorting", "skip-modified-detection", "force-retranslate-all"],
            default: {
                "try-exact-length": false,
                "with-sorting": false,
                "skip-modified-detection": false,
                "force-retranslate-all": false,
            },
        });

        const isTryingExactLengthEnabled = args["try-exact-length"];
        const isSortingEnabled = args["with-sorting"];
        const isModifiedDetectionSkipped = args["skip-modified-detection"];
        const isForceRetranslateAllEnabled = args["force-retranslate-all"];

        return {
            isTryingExactLengthEnabled,
            isSortingEnabled,
            isModifiedDetectionSkipped,
            isForceRetranslateAllEnabled,
        };
    }
}
