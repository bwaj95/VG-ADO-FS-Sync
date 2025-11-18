import { ReportManager } from "./ReportManager.js";
import { ReportEmailer } from "./ReportEmailer";
import { logger } from "./logger.js";

export function setupGlobalErrorHandling() {
  const report = ReportManager.getInstance();

  process.on("uncaughtException", async (err) => {
    logger.error("💥 Uncaught Exception:", err);

    report.error("Uncaught Exception", "An uncaught exception occurred", {
      error: err,
    });
    await sendErrorReport(err);
  });

  process.on("unhandledRejection", async (reason: any) => {
    logger.error("💥 Unhandled Rejection:", reason);
    report.error("Unhandled Rejection", "An unhandled rejection occurred", {
      reason,
    });
    await sendErrorReport(
      reason instanceof Error ? reason : new Error(String(reason))
    );
  });

  async function sendErrorReport(error: Error = new Error("Unknown error")) {
    try {
      await ReportEmailer.sendErrorReport(process.env.REPORT_EMAIL!, error);
    } catch (e) {
      logger.error("❌ Failed to send error report email:", e);
    }
  }
}
