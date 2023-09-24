import { CoinbaseGlue } from "./glue.js";
import serveGlue from "@wallet-test-framework/glue-ws";
import * as process from "node:process";

export async function main(_args: string[]): Promise<void> {
    const implementation = new CoinbaseGlue();
    const serveResult = serveGlue(implementation, { port: 0 });

    try {
        console.log(serveResult);
    } finally {
        await serveResult.close();
    }
}

export function mainSync(args: string[]): void {
    main(args).catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
