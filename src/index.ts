import * as process from "node:process";

export async function main(_args: string[]): Promise<void> {
    const foo = new Promise<void>((res) => {
        console.log("here");
        res();
    });
    await foo;
}

export function mainSync(args: string[]): void {
    main(args).catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
