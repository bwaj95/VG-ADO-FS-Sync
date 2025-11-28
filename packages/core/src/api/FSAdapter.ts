import axios, { AxiosInstance } from "axios";
import { logger, errorLogger } from "../utils/logger";
import { sanitizeAndEncodeFSQuery } from "../utils/utils";

export interface FSTicket {
  id: number;
  subject: string;
  type?: string;
  description?: string;
  description_text?: string;
  category?: string;
  requester_id?: number;
  responder_id?: number;
  custom_fields?: Record<string, any>;
  requester?: {
    id: number;
    name: string;
    email: string;
  };
  attachments?: {
    id: number;
    name: string;
    attachment_url: string;
    content_type: string;
  }[];
}

export interface FSAgent {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
}

export class FSAdapter {
  static client: AxiosInstance;
  private static instance: FSAdapter;
  private domain: string;
  private apiKey: string;
  private apiKeyBase64: string;
  private FS_FETCH_URL: string = "";

  private constructor(domain: string, apiKey: string) {
    this.domain = domain;
    this.apiKey = apiKey;
    this.apiKeyBase64 = Buffer.from(`${this.apiKey}:X`).toString("base64");

    FSAdapter.client = axios.create({
      baseURL: `https://${this.domain}`,
      headers: {
        Authorization: `Basic ${this.apiKeyBase64}`,
        "Content-Type": "application/json",
      },
    });
  }

  static getInstance(): FSAdapter {
    if (!process.env.FS_API_KEY || !process.env.FS_DOMAIN) {
      throw new Error(
        "FS_API_KEY or FS_DOMAIN environment variable is not set."
      );
    }

    if (!this.client) {
      logger.info("Creating Freshservice Adapter instance");
      const domain = process.env.FS_DOMAIN;
      const apiKey = process.env.FS_API_KEY;
      this.instance = new FSAdapter(domain, apiKey);
    }
    return this.instance;
  }

  setFsFetchUrl(url: string) {
    this.FS_FETCH_URL = url;
  }

  async fetchTickets(
    page: number = 1,
    perPage: number = 100
  ): Promise<FSTicket[]> {
    logger.info(
      `Fetching tickets from Freshservice: Page ${page}, Per Page: ${perPage}`
    );
    logger.debug(`Domain URL: ${this.domain}`);
    logger.debug(`API Key Base64: ${this.apiKeyBase64}`);
    logger.debug(`Using Fetch URL: ${this.FS_FETCH_URL}`);

    try {
      const encodedQuery = sanitizeAndEncodeFSQuery(this.FS_FETCH_URL);
      const fetchUrl = `/api/v2/tickets/filter?page=${page}&per_page=${perPage}&query=${encodedQuery}`;

      const response = await FSAdapter.client.get(fetchUrl);

      const tickets = response.data?.tickets || [];

      logger.info(
        `Fetched tickets page ${page} with ${tickets.length} tickets.`
      );

      return tickets;
    } catch (error) {
      const err = error as Error;
      console.error(error);

      errorLogger.error("Error fetching tickets:", {
        message: err.message,
      });
      throw error;
    }
  }

  async getTicketById(ticketId: number): Promise<FSTicket> {
    try {
      const response = await FSAdapter.client.get(
        `/api/v2/tickets/${ticketId}?include=tags,requester,department`
      );
      return response.data?.ticket;
    } catch (error) {
      errorLogger.error(`Error fetching ticket with ID ${ticketId}:`, error);
      throw error;
    }
  }

  async updateTicket(
    ticketId: number,
    updateData: Partial<FSTicket>
  ): Promise<FSTicket> {
    try {
      const response = await FSAdapter.client.put(
        `/api/v2/tickets/${ticketId}`,
        updateData
      );
      return response.data;
    } catch (error) {
      console.log("error updating ticket");
      // console.error(error);

      let errorText;

      if ((error as any).response && (error as any)?.response?.data) {
        errorText = (error as any).response.data;
      } else if ((error as any).message) {
        errorText = (error as any).message;
      }

      errorLogger.error(
        `Error updating ticket with ID ${ticketId}:`,
        errorText
      );

      throw errorText;
    }
  }

  async getAgentById(agentId: number): Promise<FSAgent> {
    try {
      const response = await FSAdapter.client.get(`/api/v2/agents/${agentId}`);
      return response.data?.agent;
    } catch (error) {
      errorLogger.error(`Error fetching agent with ID ${agentId}:`, error);
      throw error;
    }
  }
}
