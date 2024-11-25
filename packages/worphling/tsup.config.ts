import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/cli/index.ts"],
    outDir: "dist",
    dts: true,
    clean: true,
    treeshake: true,
    format: ["esm"],
    minify: false,
    sourcemap: true,
    platform: "node",
    target: "node16",
});
