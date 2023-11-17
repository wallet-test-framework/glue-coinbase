import { typecheckPlugin } from "@jgoz/esbuild-plugin-typecheck";
import * as esbuild from "esbuild";
import process from "node:process";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

const options = {
    plugins: [typecheckPlugin()],

    absWorkingDir: fileURLToPath(new URL(".", import.meta.url)),

    entryPoints: ["src/index.ts", "src/cli.ts", "src/glue.ts", "src/units.ts"],

    bundle: false,
    outbase: "src",
    outdir: "./dist",
    target: "es2020",
    format: "esm",
    platform: "node",
    minify: false,
    sourcemap: true,
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await esbuild.build(options);
}

export { options as default };
