import { PatchOperation } from "../api/types.js";
import { logger, errorLogger } from "./logger.js";

export interface ReportEntry {
  timestamp: Date;
  operation: string;
  operationData?: {
    fs_ticket_id?: string;
    ado_bug_id?: string;
    direction?: "FS_TO_ADO" | "ADO_TO_FS";
  };
  message: string;
  context?: any;
}

export class ReportManager {
  private static instance: ReportManager;
  private logs: {
    info: ReportEntry[];
    warnings: ReportEntry[];
    errors: ReportEntry[];
  };

  private startTime: Date = new Date();
  private endTime: Date = new Date();

  private constructor() {
    logger.info("Creating ReportManager instance!!!");
    this.logs = { info: [], warnings: [], errors: [] };
  }

  static getInstance(): ReportManager {
    if (!ReportManager.instance) {
      ReportManager.instance = new ReportManager();
    }
    return ReportManager.instance;
  }

  logCreatedADOBug(ticket: any, adoBug: any, patch: PatchOperation[]) {
    const patchSummary: Record<string, unknown> = {};

    patch.forEach((op) => {
      patchSummary[op.path] = op.value;
    });

    this.info(
      "CREATE_ADO_BUG",
      `Created ADO Bug ID: ${adoBug.id} for FS Ticket ID: ${ticket.id}`,
      JSON.stringify(patchSummary),
      {
        direction: "FS_TO_ADO",
        fs_ticket_id: String(ticket.id),
        ado_bug_id: String(adoBug.id),
        ...patchSummary,
      }
    );
  }

  logUpdatedFSTicketFromADOBug(ticket: any, adoBug: any, updateBody: any) {
    const updateSummary: Record<string, unknown> = {};

    Object.keys(updateBody?.custom_fields || {}).forEach((key) => {
      updateSummary[`custom_fields.${key}`] = updateBody.custom_fields[key];
    });

    delete updateBody.custom_fields;

    this.info(
      "UPDATE_FS_TICKET_FROM_ADO_BUG",
      `Updated FS Ticket ID: ${ticket.id} from ADO Bug ID: ${adoBug.id}`,
      JSON.stringify(updateSummary),
      {
        direction: "ADO_TO_FS",
        fs_ticket_id: String(ticket.id),
        ado_bug_id: String(adoBug.id),
        ...updateSummary,
      }
    );
  }

  info(
    operation: string,
    message: string,
    context?: any,
    operationData?: ReportEntry["operationData"]
  ) {
    const obj: ReportEntry = {
      timestamp: new Date(),
      operation,
      message,
      context: JSON.stringify(context),
    };

    if (operationData) {
      obj["operationData"] = operationData;
    }

    this.logs.info.push(obj);
    logger.info(`[Report] ${operation} - ${message}`, { ...obj });
  }

  warn(
    operation: string,
    message: string,
    context?: any,
    operationData?: ReportEntry["operationData"]
  ) {
    const obj: ReportEntry = {
      timestamp: new Date(),
      operation,
      message,
      context: JSON.stringify(context),
    };

    if (operationData) {
      obj["operationData"] = operationData;
    }

    this.logs.warnings.push(obj);
    logger.warn(`[Report] ${operation} - ${message}`, { ...obj });
  }

  error(
    operation: string,
    message: string,
    context?: any,
    operationData?: ReportEntry["operationData"]
  ) {
    const obj: ReportEntry = {
      timestamp: new Date(),
      operation,
      message,
      context: JSON.stringify(context),
    };

    if (operationData) {
      obj["operationData"] = operationData;
    }

    this.logs.errors.push(obj);
    errorLogger.error(
      `[Report] ${operation} - ${message}`,
      JSON.stringify(obj)
    );
  }

  addRaw(type: "info" | "warnings" | "errors", data: any) {
    this.logs[type].push(data);
  }

  getSummary() {
    return {
      infoCount: this.logs.info.length,
      warningCount: this.logs.warnings.length,
      errorCount: this.logs.errors.length,
    };
  }

  getFullReport() {
    return this.logs;
  }

  clear() {
    this.logs = { info: [], warnings: [], errors: [] };
  }

  setStartTime() {
    this.startTime = new Date();
  }

  setEndTime() {
    this.endTime = new Date();
  }
  getStartTime() {
    return this.startTime;
  }

  getEndTime() {
    return this.endTime;
  }
}
