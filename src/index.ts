#!/usr/bin/env node
import { runCli } from "./cli";

async function main() {
  console.log("🚀 Starting My Movies CLI...");
  try {
    await runCli();
  } catch (error) {
    console.error("💥 Fatal Error during execution:");
    console.error(error);
    process.exit(1);
  }
}

main();