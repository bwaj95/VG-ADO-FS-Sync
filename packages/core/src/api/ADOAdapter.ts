import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";
import type { PatchOperation, WorkItem, ApiError } from "./types.js";

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
  err.status = status;
  err.data = data;
  return err;
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
        "Content-Type": "application/json-patch+json",
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
      const data = err?.response?.data ?? err?.message;
      throw makeError("Failed to ADO create bug", status, data);
    }
  }

  public async getWorkItem(id: number): Promise<WorkItem> {
    try {
      const res = await this.client.get(`/wit/workitems/${id}?api-version=7.1`);
      return res.data as WorkItem;
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data ?? err?.message;
      throw makeError("Failed to fetch ADO bug", status, data);
    }
  }

  public async updateBug(id: number, patch: any[]) {
    return this.client.patch(`/wit/workitems/${id}?api-version=7.1`, patch);
  }

  public async queryWiql(query: string) {
    return this.client.post("/wit/wiql?api-version=7.1", { query });
  }
}
