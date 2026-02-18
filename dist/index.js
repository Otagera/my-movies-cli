#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = require("./cli");
async function main() {
    console.log("🚀 Starting My Movies CLI...");
    try {
        await (0, cli_1.runCli)();
    }
    catch (error) {
        console.error("💥 Fatal Error during execution:");
        console.error(error);
        process.exit(1);
    }
}
main();
