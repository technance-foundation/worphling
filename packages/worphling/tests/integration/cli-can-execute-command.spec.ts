import { describe, it, expect } from "vitest";
import path from "path";
import { spawnSync } from "child_process";

describe("worphling CLI can be executed", () => {
    it("should run successfully in the playground app using pnpm bin", () => {
        const result = spawnSync("pnpm worphling", {
            cwd: path.resolve(__dirname, "../../../../apps/playground"),
            encoding: "utf-8",
            shell: true,
        });

        expect(result.status).toBe(0);
    });
});
