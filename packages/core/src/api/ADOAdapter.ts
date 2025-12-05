import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";
import type { PatchOperation, WorkItem, ApiError } from "./types.js";
import { errorLogger, logger } from "../utils/logger.js";
import { getErrorMessage } from "../utils/utils.js";

dotenv.config();

export interface BugPayload {
  title: string;
  description: string;
  assignedTo: string;
  imsId: string;
  accountId: string;
  productVersion: string;
}

export type CreateBugOptions = {
  project?: string; // e.g. VG-SUPPORT-TEST
  apiVersion?: string; // default 7.1-preview.3
  patch: PatchOperation[];
};

function makeError(message: string, status?: number, data?: any): ApiError {
  const err = new Error(message) as ApiError;
  if (status) err.status = status;
  if (data) err.data = data;
  return err;
}

export interface ADOAttachmentUploadResult {
  id: string;
  url: string;
}

/**
 * Azure DevOps Adapter - Singleton Class
 * Handles authentication and all ADO API calls.
 */
export class ADOAdapter {
  private static instance: ADOAdapter;
  private client: AxiosInstance;

  private constructor() {
    // Build Basic Auth
    const token = Buffer.from(
      `${process.env.VG_ADO_USER}:${process.env.VG_ADO_PASS}`
    ).toString("base64");

    this.client = axios.create({
      baseURL: `${process.env.VG_ADO_ORG_URL}/DefaultCollection/${process.env.VG_ADO_PROJECT}/_apis`,
      headers: {
        Authorization: `Basic ${token}`,
      },
    });
  }

  /** Singleton accessor */
  public static getInstance(): ADOAdapter {
    if (!ADOAdapter.instance) {
      ADOAdapter.instance = new ADOAdapter();
    }
    return ADOAdapter.instance;
  }

  /**
   * Create a Bug Work Item
   */
  public async createBug(options: CreateBugOptions): Promise<WorkItem> {
    if (!options || !Array.isArray(options.patch)) {
      throw makeError("`patch` operations array is required");
    }

    const apiVersion = options.apiVersion ?? "7.1-preview.3";

    try {
      const url = `/wit/workitems/$Bug`;
      const res = await this.client.patch(url, options.patch, {
        params: { "api-version": apiVersion },
        headers: { "Content-Type": "application/json-patch+json" },
      });

      return res.data as WorkItem;
    } catch (err: any) {
      const status = err?.response?.status;
      const statusText = err?.response?.statusText;
      const data = err?.response?.data ?? err?.message;

      errorLogger.error(
        `[ADOAdapter] Error creating bug - Status: ${status} | StatusText: ${statusText} | Data: ${data}`
      );

      throw makeError("Failed to ADO create bug", status, data);
    }
  }

  public async getWorkItem(id: number): Promise<WorkItem> {
    try {
      const res = await this.client.get(
        `/wit/workitems/${id}?api-version=7.1-preview.3`
      );
      return res.data as WorkItem;
    } catch (err: any) {
      const status = err?.response?.status;
      const statusText = err?.response?.statusText;
      const data = err?.response?.data ?? err?.message;

      errorLogger.error(
        `[ADOAdapter] Error fetching work item - Status: ${status} | StatusText: ${statusText} | Data: ${data}`
      );

      throw makeError("Failed to fetch ADO bug", status, data);
    }
  }

  public async updateBug(id: number, patch: PatchOperation[]) {
    try {
      const response = await this.client.patch(
        `/wit/workitems/${id}?api-version=7.1-preview.3`,
        patch,
        {
          headers: { "Content-Type": "application/json-patch+json" },
        }
      );
      return response.data as WorkItem;
    } catch (err: any) {
      const status = err?.response?.status;
      const statusText = err?.response?.statusText;
      const data = err?.response?.data ?? err?.message;

      errorLogger.error(
        `[ADOAdapter] Error uploading attachment - Status: ${status} | StatusText: ${statusText} | Data: ${data}`
      );
      throw makeError(`Failed to update ADO bug ID ${id}`, status, data);
    }
  }

  public async queryWiql(query: string) {
    try {
      const response = await this.client.post(
        "/wit/wiql?api-version=7.1-preview.3",
        {
          query,
        },
        {
          headers: { "Content-Type": "application/json-patch+json" },
        }
      );
      return response.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const statusText = err?.response?.statusText;
      const data = err?.response?.data ?? err?.message;

      errorLogger.error(
        `[ADOAdapter] Error executing WIQL query - Status: ${status} | StatusText: ${statusText} | Data: ${data}`
      );

      throw makeError("Failed to execute WIQL query", status, data);
    }
  }

  // =====================================================
  //  ATTACHMENT API — Upload & Attach
  // =====================================================

  /**
   * Upload attachment to ADO (binary file)
   */
  public async uploadAttachment(
    fileName: string,
    contentType: string,
    buffer: Buffer
  ): Promise<ADOAttachmentUploadResult> {
    try {
      logger.info(
        `UploadAttachment Details: FileName: ${fileName} | Content-Type: ${contentType} | Buffer length: ${buffer?.length}`
      );

      const url = `/wit/attachments`;

      const res = await this.client.post(url, buffer, {
        params: { "api-version": "7.1-preview.3", fileName },
        headers: {
          "Content-Type": "application/octet-stream",
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      return {
        id: res.data.id,
        url: res.data.url,
      };
    } catch (err: any) {
      const status = err?.response?.status;
      const statusText = err?.response?.statusText;
      const data = err?.response?.data ?? err?.message;

      errorLogger.error(
        `[ADOAdapter] Error uploading attachment - Status: ${status} | StatusText: ${statusText} | Data: ${data}`
      );

      console.log("ADO uploadattachment full errror....");
      console.error(err);

      throw makeError(`Failed to upload attachment ${fileName}`, status, data);
    }
  }

  /**
   * Link an uploaded attachment to a Work Item
   */
  public async attachToWorkItem(
    workItemId: number,
    attachmentUrl: string,
    comment: string = "Imported from Freshservice"
  ): Promise<any> {
    const patch: PatchOperation[] = [
      {
        op: "add",
        path: "/relations/-",
        value: {
          rel: "AttachedFile",
          url: attachmentUrl,
          attributes: { comment },
        },
      },
    ];

    return this.updateBug(workItemId, patch);
  }

  // =====================================================
  //  Helper: Create Bug + Upload & Attach Multiple Files
  // =====================================================

  /**
   * Creates a bug AND attaches files (if any).
   * `attachments` = array of { fileName, buffer, contentType }
   */
  public async createBugWithAttachments(options: {
    patch: PatchOperation[];
    attachments?: {
      fileName: string;
      buffer: Buffer;
      contentType: string;
    }[];
  }): Promise<WorkItem> {
    // Step 1 — create bug
    const bug = await this.createBug({ patch: options.patch });

    // No attachments → return immediately
    if (!options.attachments || options.attachments.length === 0) {
      return bug;
    }

    // Step 2 — upload + link each attachment
    for (const file of options.attachments) {
      const upload = await this.uploadAttachment(
        file.fileName,
        file.contentType,
        file.buffer
      );

      await this.attachToWorkItem(bug.id, upload.url);
    }

    return bug;
  }
}
