import { logger, startScheduler, errorLogger } from "@repo/core";
import { loadEnv } from "./config/env";

const main = async () => {
  loadEnv(); // Initialize env vars

  try {
    logger.info("🚀 Starting ADO Devops ↔ Freshservice Sync Scheduler...");
    await startScheduler();
  } catch (err) {
    errorLogger.error("Fatal error starting scheduler", { error: err });
  }
};

main();
