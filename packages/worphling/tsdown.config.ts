import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        cli: "src/cli/index.ts",
    },
    outDir: "dist",
    dts: true,
    clean: true,
    treeshake: true,
    format: ["esm"],
    minify: false,
    sourcemap: true,
    platform: "node",
});
