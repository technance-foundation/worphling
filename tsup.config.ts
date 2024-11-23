import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    dts: true,
    clean: true,
    treeshake: true,
    minify: process.env.NODE_ENV === "production",
    format: ["esm", "cjs"],
    bundle: true,
    sourcemap: true,
    platform: "node",
    target: "node16",
});
