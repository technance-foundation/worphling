#!/usr/bin/env node
import { ConfigLoader } from "./ConfigLoader";

(async () => {
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    console.log("Loaded configuration:", config);
})();
