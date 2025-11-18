import nodemailer from "nodemailer";
import { ExcelReportGenerator } from "./ExcelReportGenerator";

export class ReportEmailer {
  static async sendReportEmail(to: string) {
    const filePath = await ExcelReportGenerator.generateReportFile();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const subject = `🔔 FS <--> ADO Sync Report (${new Date().toLocaleString()})`;

    await transporter.sendMail({
      from: `"FS <--> ADO Sync" <${process.env.EMAIL_USER}>`,
      to,
      cc: process.env.REPORT_EMAIL_CC ?? "",
      subject,
      text: `Attached is the latest sync report.`,
      attachments: [
        {
          filename: filePath.split("\\").pop(),
          path: filePath,
        },
      ],
    });
  }

  static async sendErrorReport(to: string, error: Error) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const subject = `❌ FS <--> ADO Sync Error Report (${new Date().toLocaleString()})`;

    await transporter.sendMail({
      from: `"FS <--> ADO Sync" <${process.env.EMAIL_USER}>`,
      to,
      cc: process.env.REPORT_EMAIL_CC ?? "",
      subject,
      text: `An error occurred during the FS <--> CRM sync process:\n\n${error.message}\n\nStack Trace:\n${error.stack}`,
    });
  }
}
