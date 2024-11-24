#!/usr/bin/env node
export * from "./types";

import { main } from "./app";

(async () => {
    await main();
})();
