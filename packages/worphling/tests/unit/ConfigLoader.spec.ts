import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { ConfigLoader } from "../../src/app/ConfigLoader";

let tempDir: string;
let configPath: string;

describe("ConfigLoader", () => {
    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "worphling-config-"));

        configPath = path.join(tempDir, "worphling.config.mjs");

        const content = `
      export default {
        service: "test-service",
        source: "test-source"
      };
    `;
        fs.writeFileSync(configPath, content);
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should load a valid config using file:// URL and validate it", async () => {
        const loader = new ConfigLoader();
        loader["resolveConfigFile"] = () => configPath;

        const config = await loader.load();

        expect(config).toEqual({
            service: "test-service",
            source: "test-source",
        });
    });
});
