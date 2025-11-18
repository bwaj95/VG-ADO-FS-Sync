import type { sheetsDataType } from "../types/schema.js";
import { readExcelFile } from "../utils/excelReader.js";
import { logger } from "./logger.js";

const EXCEL_FILE_NAME = process.env.MAPPING_EXCEL_FILE || "VG-FS-ADO-Sync.xlsx";

export class FileReader {
  static instance: FileReader;
  private filePath: string = "";
  private sheetsData: sheetsDataType = {} as sheetsDataType;

  private constructor() {}

  static getInstance() {
    if (!FileReader.instance) {
      FileReader.instance = new FileReader();
    }
    return FileReader.instance;
  }

  setFilePath(filePath: string) {
    // check if filePath ends with .xlsx
    if (!filePath.endsWith(".xlsx")) {
      throw new Error("[FileReader] Only .xlsx files are supported.");
    }

    // check if file name matches EXCEL_FILE_NAME

    const fileName = filePath.split("\\").pop();

    logger.info(`[FileReader] Getting filename: ${fileName}`);

    if (fileName !== EXCEL_FILE_NAME) {
      throw new Error(`[FileReader] File name must be ${EXCEL_FILE_NAME}`);
    }

    this.filePath = filePath;

    return this;
  }

  readFile() {
    if (!this.filePath) {
      throw new Error("File path not set in FileReader.");
    }

    try {
      this.sheetsData = readExcelFile(this.filePath);

      return this;
    } catch (error) {
      logger.error("Error reading Excel file in FileReader:", error);
      return this;
    }
  }

  getSheetsData() {
    return this.sheetsData;
  }
}
