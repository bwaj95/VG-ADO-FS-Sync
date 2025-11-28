import XLSX from "xlsx";
import {
  SingleFieldMappingSchema,
  RepoMappingSchema,
  QueryMappingSchema,
  ProductFieldMappingSchema,
  ProductsDataMappingSchema,
  sheetsDataSchema,
  URLMappingSchema,
} from "../types/schema.js";
import type {
  SingleFieldMappingRecord,
  RepoMappingRecord,
  QueryMappingRecord,
  ProductFieldMappingRecord,
  ProductsDataMappingRecord,
  sheetsDataType,
  URLMappingRecord,
} from "../types/schema.js";
import { logger, errorLogger } from "./logger.js";
import { parse, z } from "zod";

const requiredSheetNames = [
  "SingleField",
  "Repo",
  "Query",
  "URL",
  "ProductsFields",
  "ProductsData",
];

export function readExcelFile(filePath: string): sheetsDataType {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;

    if (!sheetNames || sheetNames.length === 0) {
      throw new Error("No sheets found in the Excel file.");
    }

    requiredSheetNames.forEach((sheetName) => {
      if (!sheetNames.includes(sheetName)) {
        throw new Error(
          `Required sheet "${sheetName}" is missing in the Excel file.`
        );
      }
    });

    const sheetsData = {
      singleField: [] as SingleFieldMappingRecord[],
      repo: [] as RepoMappingRecord[],
      url: [] as URLMappingRecord[],
      query: [] as QueryMappingRecord[],
      productField: [] as ProductFieldMappingRecord[],
      productsData: [] as ProductsDataMappingRecord[],
    };

    requiredSheetNames.forEach((sheetName) => {
      switch (sheetName) {
        case "SingleField":
          sheetsData.singleField = parseSingleFieldSheet(workbook);
          break;
        case "Repo":
          sheetsData.repo = parseRepoSheet(workbook);
          break;
        case "URL":
          sheetsData.url = parseURLSheet(workbook);
          break;
        case "ProductsFields":
          sheetsData.productField = parseProductsFieldsSheet(workbook);
          break;
        case "ProductsData":
          sheetsData.productsData = parseProductsDataSheet(workbook);
          break;
      }
    });

    return sheetsData;
  } catch (error) {
    errorLogger.error("Failed to read Excel file", { error });
    throw error;
  }
}

const parseSingleFieldSheet = (
  workbook: XLSX.WorkBook
): SingleFieldMappingRecord[] => {
  try {
    const sheetName = "SingleField";
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
    }

    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      throw new Error("No data found in the SingleField Excel sheet.");
    }

    const records: SingleFieldMappingRecord[] = (
      data as Record<string, any>[]
    ).map((row, index) => ({
      fs_field: String(row["FS-Field-Key"] || "").trim(),
      isCustomFieldFS: Boolean(
        String(row["isCustomFieldFS"] || "")
          .trim()
          .toLowerCase() === "true"
      ),
      isMultiSelectFS: Boolean(
        String(row["isMultiSelectFS"] || "")
          .trim()
          .toLowerCase() === "true"
      ),
      fsFieldType: String(row["FS-Field-Type"] || "").trim() as
        | ""
        | "text"
        | "date",
      ado_field: String(row["ADO-Field-Key"] || "").trim(),
      direction: String(row["Direction"] || "")
        .trim()
        .toUpperCase() as "FS_TO_ADO" | "ADO_TO_FS",
    }));
    // Validate records
    records.forEach((record) => SingleFieldMappingSchema.parse(record));
    logger.info(
      `Successfully read ${records.length} SingleField mapping records from Excel file.`
    );
    // logger.debug("SingleField Mapping records:", { records });
    return records;
  } catch (error) {
    errorLogger.error("Failed to read SingleField sheet from Excel file", {
      error,
    });
    throw error;
  }
};

const parseRepoSheet = (workbook: XLSX.WorkBook): RepoMappingRecord[] => {
  try {
    const sheetName = "Repo";
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    if (!data || data.length === 0) {
      throw new Error("No data found in the Repo Excel sheet.");
    }

    const records: RepoMappingRecord[] = (data as Record<string, any>[]).map(
      (row, index) => ({
        fs_field: String(row["FS-Field-Key"] || "").trim(),
        isCustomFieldFS: Boolean(
          String(row["isCustomFieldFS"] || "")
            .trim()
            .toLowerCase() === "true"
        ),
        isMultiSelectFS: Boolean(
          String(row["isMultiSelectFS"] || "")
            .trim()
            .toLowerCase() === "true"
        ),
        direction: String(row["Direction"] || "")
          .trim()
          .toUpperCase() as "FS_TO_ADO" | "ADO_TO_FS",
        titleText: String(row["TitleText"] || "").trim(),
        isMultiSelectADO: Boolean(
          String(row["isMultiSelectADO"] || "")
            .trim()
            .toLowerCase() === "true"
        ),
      })
    );
    // Validate records
    records.forEach((record) => RepoMappingSchema.parse(record));
    logger.info(
      `Successfully read ${records.length} Repo mapping records from Excel file.`
    );
    // logger.debug("Repo Mapping records:", { records });
    return records;
  } catch (error) {
    errorLogger.error("Failed to read Repo sheet from Excel file", { error });
    throw error;
  }
};

const parseQuerySheet = (workbook: XLSX.WorkBook): QueryMappingRecord[] => {
  try {
    const sheetName = "Query";
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    if (!data || data.length === 0) {
      throw new Error("No data found in the Query Excel sheet.");
    }

    const records: QueryMappingRecord[] = (data as Record<string, any>[]).map(
      (row, index) => ({
        param: String(row["Param"] || "").trim(),
        value: String(row["Value"] || "").trim(),
        isValueBoolean: Boolean(
          String(row["isValueBoolean"] || "")
            .trim()
            .toLowerCase() === "true"
        ),
        enclosingQuotesType: String(row["EnclosingQuotesType"] || "")
          .trim()
          .toUpperCase() as "SINGLE_QUOTES" | "NONE",
      })
    );
    // Validate records
    records.forEach((record) => QueryMappingSchema.parse(record));
    logger.info(
      `Successfully read ${records.length} Query mapping records from Excel file.`
    );
    // logger.debug("Query Mapping records:", { records });
    return records;
  } catch (error) {
    errorLogger.error("Failed to read Query sheet from Excel file", { error });
    throw error;
  }
};

const parseURLSheet = (workbook: XLSX.WorkBook): URLMappingRecord[] => {
  try {
    const sheetName = "URL";
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    if (!data || data.length === 0) {
      throw new Error("No data found in the URL Excel sheet.");
    }

    const records: URLMappingRecord[] = (data as Record<string, any>[]).map(
      (row, index) => ({
        key: String(row["Key"] || "").trim(),
        value: String(row["Value"] || "").trim(),
      })
    );
    // Validate records
    records.forEach((record) => URLMappingSchema.parse(record));
    logger.info(
      `Successfully read ${records.length} URL mapping records from Excel file.`
    );
    // logger.debug("URL Mapping records:", { records });
    return records;
  } catch (error) {
    errorLogger.error("Failed to read URL sheet from Excel file", { error });
    throw error;
  }
};

const parseProductsFieldsSheet = (
  workbook: XLSX.WorkBook
): ProductFieldMappingRecord[] => {
  try {
    const sheetName = "ProductsFields";
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
    }
    const data = XLSX.utils.sheet_to_json(sheet);
    if (!data || data.length === 0) {
      throw new Error("No data found in the ProductsFields Excel sheet.");
    }
    const records: ProductFieldMappingRecord[] = (
      data as Record<string, any>[]
    ).map((row, index) => ({
      ado_field: String(row["ADO-Field-Key"] || "").trim(),
      products_data_sheet_key: String(row["ProductsDataSheetKey"] || "").trim(),
      direction: String(row["Direction"] || "")
        .trim()
        .toUpperCase() as "FS_TO_ADO" | "ADO_TO_FS",
    }));
    // Validate records
    records.forEach((record) => ProductFieldMappingSchema.parse(record));
    logger.info(
      `Successfully read ${records.length} ProductField mapping records from Excel file.`
    );
    // logger.debug("ProductField Mapping records:", { records });
    return records;
  } catch (error) {
    errorLogger.error("Failed to read ProductsFields sheet from Excel file", {
      error,
    });
    throw error;
  }
};

const parseProductsDataSheet = (
  workbook: XLSX.WorkBook
): ProductsDataMappingRecord[] => {
  try {
    const sheetName = "ProductsData";
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    if (!data || data.length === 0) {
      throw new Error("No data found in the ProductsData Excel sheet.");
    }

    const records: ProductsDataMappingRecord[] = (
      data as Record<string, any>[]
    ).map((row, index) => ({
      ProductName: String(row["ProductName"] || "").trim(),
      ProductVersion: String(row["ProductVersion"] || "").trim(),
      AreaPath: String(row["AreaPath"] || "").trim(),
      IterationPath: String(row["IterationPath"] || "").trim(),
      TeamProject: String(row["TeamProject"] || "").trim(),
      Developer: String(row["Developer"] || "").trim(),
      Tester: String(row["Tester"] || "").trim(),
      WorkItemType: String(row["WorkItemType"] || "").trim(),
      AssignedTo: String(row["AssignedTo"] || "").trim(),
    }));
    // Validate records
    records.forEach((record) => ProductsDataMappingSchema.parse(record));
    logger.info(
      `Successfully read ${records.length} ProductsData mapping records from Excel file.`
    );
    // logger.debug("ProductsData Mapping records:", { records });
    return records;
  } catch (error) {
    errorLogger.error("Failed to read ProductsData sheet from Excel file", {
      error,
    });
    throw error;
  }
};
