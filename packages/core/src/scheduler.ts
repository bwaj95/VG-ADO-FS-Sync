import cron from "node-cron";
import { logger, errorLogger } from "./utils/logger";
import path from "path";
import { FileReader } from "./utils/FileReader";
import { SyncEngine } from "./sync/SyncEngine";
import { ReportManager } from "./utils/ReportManager";
import { ExcelReportGenerator } from "./utils/ExcelReportGenerator";
import { ReportEmailer } from "./utils/ReportEmailer";
import { setupGlobalErrorHandling } from "./utils/errorHandler";

export const startScheduler = async () => {
  const pattern = process.env.CRON_PATTERN!; // every 2 minutes for testing

  setupGlobalErrorHandling();

  logger.info(`📅 Scheduler initialized with cron pattern: ${pattern}`);

  cron.schedule(pattern, async () => {
    logger.info("🔁 Scheduler triggered: Running FS ↔ ADO Sync Job");

    const reportManager = ReportManager.getInstance();
    reportManager.setStartTime();

    try {
      const mappingFile =
        process.env.MAPPING_EXCEL_FILE || "VG-FS-ADO-Sync.xlsx";

      const excelFilePath = path.resolve(process.cwd(), "data/" + mappingFile);

      logger.info(`Using mapping Excel file at: ${excelFilePath}`);

      const sheetsData = FileReader.getInstance()
        .setFilePath(excelFilePath)
        .readFile()
        .getSheetsData();
      logger.info("✅ Successfully read mapping Excel file.", { sheetsData });
      logger.debug("Mapping Sheets Data:", { sheetsData });

      // Initialize and run Sync Engine
      const syncEngine = SyncEngine.getInstance();
      await syncEngine.run();

      reportManager.info("MAIN", "Scheduler completed successfully.");
      reportManager.setEndTime();
      logger.info("Scheduler completed successfully.");
      const reportsFile = await ExcelReportGenerator.generateReportFile();
      logger.info(`Generated report file at: ${reportsFile}`);
    } catch (error) {
      errorLogger.error("Error occurred while starting the scheduler:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      reportManager.error(
        "START_SCHEDULER",
        "Error occurred while starting the scheduler:",
        {
          message: (error as Error).message,
          stack: (error as Error).stack,
        }
      );
      reportManager.setEndTime();
    } finally {
      const summary = reportManager.getSummary();
      logger.info(
        `Sync Summary: ${summary.infoCount} info, ${summary.warningCount} warnings, ${summary.errorCount} errors.`
      );
      await ReportEmailer.sendReportEmail(process.env.REPORT_EMAIL_TO!);

      reportManager.clear(); // Clear report for next run
    }
  });
};
