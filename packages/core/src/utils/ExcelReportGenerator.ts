import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { ReportManager } from "./ReportManager.js";
import { formattedDate, getUtcTimestamp } from "./utils.js";

export class ExcelReportGenerator {
  static async generateReportFile(): Promise<string> {
    const report = ReportManager.getInstance();
    const data = report.getFullReport();
    const summary = report.getSummary();

    const wb = XLSX.utils.book_new();

    // 1️⃣ Summary sheet
    const summarySheet = XLSX.utils.json_to_sheet([
      { Metric: "Info Count", Value: summary.infoCount },
      { Metric: "Warnings", Value: summary.warningCount },
      { Metric: "Errors", Value: summary.errorCount },
      {
        Metric: "Sync Start Time",
        Value: getUtcTimestamp(report.getStartTime()),
      },
      { Metric: "Sync End Time", Value: getUtcTimestamp(report.getEndTime()) },
      { Metric: "Generated At", Value: getUtcTimestamp() },
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Sync Summary");

    // 2️⃣ Details sheet (info + warnings)
    const detailRows = [
      ...data.info.map((x) => ({ Level: "INFO", ...x, ...x.operationData })),
      ...data.warnings.map((x) => ({
        Level: "WARN",
        ...x,
        ...x.operationData,
      })),
    ];
    const detailsSheet = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, detailsSheet, "Details");

    // 3️⃣ Error sheet
    const errorRows = data.errors.map((x) => ({
      ...x,
      context: JSON.stringify(x.context, null, 2),
      ...x.operationData,
    }));
    const errorSheet = XLSX.utils.json_to_sheet(errorRows);
    XLSX.utils.book_append_sheet(wb, errorSheet, "Errors");

    // Write to file
    const dir = path.resolve(process.cwd(), "reports");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const filePath = path.join(
      dir,
      `ADO-FS-SyncReport_${formattedDate()}.xlsx`
    );
    XLSX.writeFile(wb, filePath);

    return filePath;
  }
}
