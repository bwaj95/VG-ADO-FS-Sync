import { ADOAdapter } from "../api/ADOAdapter";
import { FSAdapter, FSAgent, FSTicket } from "../api/FSAdapter";
import { PatchOperation, WorkItem } from "../api/types";
import {
  ProductFieldMappingRecord,
  ProductsDataMappingRecord,
  RepoMappingRecord,
  sheetsDataType,
  SingleFieldMappingRecord,
} from "../types/schema";
import { FileReader } from "../utils/FileReader";
import { logger, errorLogger } from "../utils/logger";
import { ReportManager } from "../utils/ReportManager";
import { convertADODateToISO, stringifyMultiSelectFS } from "../utils/utils";

export class SyncEngine {
  static instance: SyncEngine;
  fs: FSAdapter;
  ado: ADOAdapter;
  reportManager = ReportManager.getInstance();

  private fsToAdoMappings: SingleFieldMappingRecord[] | null = null;
  private adoToFsMappings: SingleFieldMappingRecord[] | null = null;
  private repoMappings: RepoMappingRecord[] | null = null;
  private productFieldMappings: ProductFieldMappingRecord[] | null = null;
  private productsDataMappings: ProductsDataMappingRecord[] | null = null;

  constructor() {
    this.fs = this.initFS();
    this.ado = this.initADO();
  }

  static getInstance() {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  initFS() {
    const instance = FSAdapter.getInstance();

    return instance;
  }

  initADO() {
    const instance = ADOAdapter.getInstance();

    return instance;
  }

  async run() {
    try {
      const sheetsData: sheetsDataType =
        FileReader.getInstance().getSheetsData();

      const fetchQuery = sheetsData.url.find(
        (item) => item.key === "FS_FETCH_QUERY"
      );

      if (!fetchQuery || !fetchQuery.value) {
        console.log("No fetchUrl Excel file");
        throw new Error("No fetchUrl Excel file");
      }

      this.fs.setFsFetchUrl(fetchQuery.value);

      console.log("Fetch URL set to:", fetchQuery.value);

      const singleFieldMappings: SingleFieldMappingRecord[] =
        sheetsData.singleField;

      this.fsToAdoMappings = singleFieldMappings.filter(
        (m) => m.direction === "FS_TO_ADO"
      );
      this.adoToFsMappings = singleFieldMappings.filter(
        (m) => m.direction === "ADO_TO_FS"
      );

      this.repoMappings = sheetsData.repo;
      this.productFieldMappings = sheetsData.productField;
      this.productsDataMappings = sheetsData.productsData;

      let page = 1,
        per_page = 5;

      while (true) {
        const tickets = await this.fs.fetchTickets(page, per_page);
        if (tickets.length === 0) {
          break;
        }

        await this.processBatch(tickets);

        page++;
      }

      logger.info("✅ FS ↔ ADO Sync Engine run completed.");
    } catch (error) {
      errorLogger.error(
        `[SyncEngine] Error occurred: ${(error as Error)?.message}`
      );
      this.reportManager.error(
        "SyncEngine - run",
        `Error in sync run: ${(error as Error).message}`,
        error
      );
    }
  }

  async processBatch(tickets: any[]) {
    try {
      logger.info(`⚙️ Processing batch of ${tickets.length} tickets.`);

      const promises = tickets.map((ticket) => this.processTicket(ticket));

      await Promise.all(promises);
    } catch (error) {
      errorLogger.error("[SyncEngine] - Error processing ticket batch:", {
        message: JSON.stringify((error as Error).message),
        stack: JSON.stringify((error as Error).stack),
      });
      this.reportManager.error(
        "SyncEngine - processBatch",
        `Error processing batch: ${(error as Error).message}`,
        error
      );
    }
  }

  async processTicket(ticket: any) {
    try {
      logger.info(`🔄 Processing ticket ID: ${ticket.id}`);
      if (!ticket.custom_fields?.source_control_reference) {
        const adoBug = await this.handleCreateADOBug(ticket);
        if (!adoBug || !adoBug.id) {
          errorLogger.error(
            `Failed to create ADO Bug for FS Ticket ID: ${ticket.id}`
          );
          return;
        }
        // Update FS Ticket with ADO Bug reference
        await this.handleFSTicketUpdateFromADOBug(ticket, adoBug);
        logger.info(
          `✅ Linked FS Ticket ID: ${ticket.id} with ADO Bug ID: ${adoBug.id}`
        );
      } else {
        logger.info(
          `FS Ticket ID: ${ticket.id} already linked to ADO Bug. Starting update flow.`
        );

        const adoBug = await this.ado.getWorkItem(
          ticket.custom_fields.source_control_reference
        );

        logger.debug(`Fetched ADO Bug for FS Ticket ID ${ticket.id}:`, {
          adoBug,
        });

        await this.handleFSTicketUpdateFromADOBug(ticket, adoBug);
        logger.info(
          `✅ Updated FS Ticket ID: ${ticket.id} from ADO Bug ID: ${adoBug.id}`
        );
      }
    } catch (error) {
      errorLogger.error(
        `[SyncEngine] - Error processing ticket: ${ticket.id}`,
        {
          message: JSON.stringify((error as Error).message),
          stack: JSON.stringify((error as Error).stack),
        }
      );
      this.reportManager.error(
        "SyncEngine - processTicket",
        `Error processing ticket ID ${ticket.id}: ${(error as Error).message}`,
        error
      );
    }
  }

  async handleCreateADOBug(baseTicket: any) {
    try {
      logger.info(
        `Handling Ticket for Creating ADO Bug for FS Ticket ID: ${baseTicket.id}`
      );

      const ticket = await this.fs.getTicketById(baseTicket.id);
      const patch = [];

      // logger.debug(`Fetched FS Ticket Details for ID ${ticket.id}:`, {
      //   ticket,
      // });

      const requester =
        ticket.requester && ticket.requester?.email ? ticket.requester : null;
      logger.info(
        `FS Ticket ID: ${ticket.id} requested by ${requester?.name} (${requester?.email})`
      );

      const fsAgent = ticket.responder_id
        ? await this.fs.getAgentById(ticket.responder_id)
        : null;

      const singleFieldsAdoPatch = this.buildFSToADOSingleFields(ticket);
      patch.push(...singleFieldsAdoPatch);

      if (requester) {
        const requesterAdoPatch = this.buildFSToADORequesterFields(ticket);
        logger.debug(
          `Requester ADO Patch Data for FS Ticket ID ${ticket.id}:`,
          {
            requesterAdoPatch,
          }
        );
        patch.push(...requesterAdoPatch);
      }

      if (fsAgent) {
        logger.info(
          `FS Agent fetched for Agent ID ${fsAgent.id} of Ticket ID ${ticket.id}: ${fsAgent.first_name} ${fsAgent.last_name}`
        );
        const responderAdoPatch = this.buildFSToADOResponderFields(
          ticket,
          fsAgent
        );
        logger.debug(
          `Responder ADO Patch Data for FS Ticket ID ${ticket.id}:`,
          {
            responderAdoPatch,
          }
        );
        patch.push(...responderAdoPatch);
      }

      const repoFieldsAdoPatch = this.buildFSToADORepoFields(ticket);
      patch.push(...repoFieldsAdoPatch);

      const productFieldsAdoPatch = this.buildFSToADOProductFields(ticket);
      patch.push(...productFieldsAdoPatch);

      logger.debug(`Final ADO Bug Patch Data for FS Ticket ID ${ticket.id}:`, {
        patch,
      });

      // Create ADO Bug
      const adoBug = await this.ado.createBug({ patch });

      logger.info(
        `✅ Created ADO Bug ID: ${adoBug.id} for FS Ticket ID: ${ticket.id}`
      );

      this.reportManager.logCreatedADOBug(ticket, adoBug, patch);

      /** Attachment handling code */
      if (ticket.attachments && ticket.attachments.length > 0) {
        logger.info(
          `Uploading and attaching ${ticket.attachments.length} attachments for ADO Bug ID: ${adoBug.id}`
        );

        await this.handleAttachmentUploadAndLinking(ticket, adoBug);
        logger.info(
          `[SyncEngine - handleCreateADOBug] - ✅ Completed attachment upload and linking for ADO Bug ID: ${adoBug.id}`
        );
      }

      return adoBug;
    } catch (error) {
      errorLogger.error("Error in handle create ADO Bug from FS Ticket:", {
        message: JSON.stringify((error as Error).message),
        stack: JSON.stringify((error as Error).stack),
      });

      this.reportManager.error(
        "SyncEngine - handleCreateADOBug",
        `Error creating ADO Bug for FS Ticket ID ${baseTicket.id}: ${
          (error as Error).message
        }`,
        JSON.stringify(error, null, 2)
      );

      return null;
    }
  }

  async handleFSTicketUpdateFromADOBug(ticket: any, adoBug: WorkItem) {
    try {
      logger.info(
        `Handling FS Ticket Update from ADO Bug ID: ${adoBug.id} for FS Ticket ID: ${ticket.id}`
      );

      const updateBody = this.buildFSUpdateBodyFromADOBug(adoBug, ticket);

      await this.fs.updateTicket(ticket.id, updateBody);

      logger.info(
        `✅ Updated FS Ticket ID: ${ticket.id} from ADO Bug ID: ${adoBug.id}`
      );

      this.reportManager.logUpdatedFSTicketFromADOBug(
        ticket,
        adoBug,
        updateBody
      );
    } catch (error) {
      errorLogger.error("Error in handle FS Ticket update from ADO Bug:", {
        message: JSON.stringify((error as Error).message),
        stack: JSON.stringify((error as Error).stack),
      });
      this.reportManager.error(
        "SyncEngine - handleFSTicketUpdateFromADOBug",
        `Error updating FS Ticket ID ${ticket.id} from ADO Bug ID ${
          adoBug.id
        }: ${(error as Error).message}`,
        JSON.stringify(error, null, 2)
      );
    }
  }

  buildFSToADOSingleFields(ticket: any): PatchOperation[] {
    try {
      const adoPatchData: PatchOperation[] = [];

      if (!this.fsToAdoMappings || this.fsToAdoMappings.length === 0) {
        logger.warn("FS to ADO mappings are not initialized or empty.");
        return adoPatchData;
      }

      this.fsToAdoMappings.forEach((mapping) => {
        let fsValue = mapping.isCustomFieldFS
          ? ticket.custom_fields?.[mapping.fs_field]
          : ticket[mapping.fs_field];

        if (mapping.isMultiSelectFS && Array.isArray(fsValue)) {
          fsValue = stringifyMultiSelectFS(fsValue);
        }

        fsValue = fsValue ?? "";

        const adoPatchEntry: PatchOperation = {
          op: "add",
          path: `/fields/${mapping.ado_field}`,
          value: fsValue,
        };

        adoPatchData.push(adoPatchEntry);
      });

      // logger.debug(`ADO Fields built from FS Ticket ${ticket.id} :`, {
      //   adoFields: adoPatchData,
      // });

      return adoPatchData;
    } catch (error) {
      errorLogger.error("Error building FS to ADO single fields:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      this.reportManager.error(
        "SyncEngine - buildFSToADOSingleFields",
        `Error building FS to ADO single fields for ticket ID ${ticket.id}: ${
          (error as Error).message
        }`,
        error
      );

      return [];
    }
  }

  buildFSToADORepoFields(ticket: any): PatchOperation[] {
    try {
      const adoPatchData: PatchOperation[] = [];

      const htmlTextArray: string[] = [];

      if (!this.repoMappings || this.repoMappings.length === 0) {
        logger.warn("Repo mappings are not initialized or empty.");
        return adoPatchData;
      }

      this.repoMappings.forEach((mapping) => {
        let fsValue = mapping.isCustomFieldFS
          ? ticket.custom_fields?.[mapping.fs_field]
          : ticket[mapping.fs_field];
        if (mapping.isMultiSelectFS && Array.isArray(fsValue)) {
          fsValue = stringifyMultiSelectFS(fsValue);
        }

        fsValue = fsValue ?? "";

        htmlTextArray.push(
          `<b>${mapping.titleText}:</b><br/> ${fsValue}<br/><br/>`
        );
      });

      let combinedHtmlText = "<b>Reporduction Steps:</b><br/>";

      combinedHtmlText += htmlTextArray.join("");

      const fieldKey = process.env.ADO_REPO_FIELD_KEY || "System.Description";

      const adoPatchEntry: PatchOperation = {
        op: "add",
        path: `/fields/${fieldKey}`,
        value: combinedHtmlText,
      };

      // logger.debug(`ADO Repo Fields built from FS Ticket ${ticket.id} :`, {
      //   adoFields: adoPatchEntry,
      // });

      return [adoPatchEntry];
    } catch (error) {
      errorLogger.error("Error building FS to ADO repo fields:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      this.reportManager.error(
        "SyncEngine - buildFSToADORepoFields",
        `Error building FS to ADO repo fields for ticket ID ${ticket.id}: ${
          (error as Error).message
        }`,
        error
      );

      return [];
    }
  }

  buildFSToADOProductFields(ticket: any): PatchOperation[] {
    try {
      const adoPatchData: PatchOperation[] = [];

      if (
        !this.productFieldMappings ||
        this.productFieldMappings.length === 0
      ) {
        logger.warn("Product Field mappings are not initialized or empty.");
        return adoPatchData;
      }

      if (
        !this.productsDataMappings ||
        this.productsDataMappings.length === 0
      ) {
        logger.warn("Products Data mappings are not initialized or empty.");
        return adoPatchData;
      }

      const productDetails = this.productsDataMappings.find(
        (prod) =>
          prod.ProductVersion === ticket.custom_fields?.product_version &&
          prod.ProductName === ticket.custom_fields?.product_name
      );

      if (!productDetails) {
        logger.warn(
          `No matching product details found for ticket ${ticket.id} with Product Version: ${ticket.custom_fields?.product_version} and Product Name: ${ticket.custom_fields?.product_name}`
        );
        return adoPatchData;
      }

      // logger.debug(`Product Details found for FS Ticket ID ${ticket.id}:`, {
      //   productDetails,
      // });

      this.productFieldMappings.forEach((mapping) => {
        const key =
          mapping.products_data_sheet_key as keyof ProductsDataMappingRecord;

        const value = productDetails[key];

        // logger.debug(
        //   `Ticket ${ticket.id} - Mapping Product Field - ADO Field: ${mapping.ado_field}, Value: ${value}`
        // );

        if (value) {
          const adoPatchEntry: PatchOperation = {
            op: "add",
            path: `/fields/${mapping.ado_field}`,
            value: value,
          };

          adoPatchData.push(adoPatchEntry);
        }
      });

      // logger.debug(`ADO Product Fields built from FS Ticket ${ticket.id} :`, {
      //   adoFields: adoPatchData,
      // });

      return adoPatchData;
    } catch (error) {
      errorLogger.error("Error building FS to ADO product fields:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      this.reportManager.error(
        "SyncEngine - buildFSToADOProductFields",
        `Error building FS to ADO product fields for ticket ID ${ticket.id}: ${
          (error as Error).message
        }`,
        error
      );

      return [];
    }
  }

  buildFSToADOResponderFields(ticket: any, fsAgent: FSAgent): PatchOperation[] {
    try {
      const adoPatchData: PatchOperation[] = [];

      const fieldKey =
        process.env.ADO_RESPONDER_FIELD_KEY || "Custom.IMSTechnician";

      if (fsAgent && fsAgent.first_name) {
        let agentName = fsAgent.first_name;
        if (fsAgent.last_name) {
          agentName += ` ${fsAgent.last_name}`;
        }

        const adoPatchEntry: PatchOperation = {
          op: "add",
          path: `/fields/${fieldKey}`,
          value: agentName,
        };

        adoPatchData.push(adoPatchEntry);
      }

      return adoPatchData;
    } catch (error) {
      errorLogger.error("Error building FS to ADO agent fields:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      this.reportManager.error(
        "SyncEngine - buildFSToADOAgentFields",
        `Error building FS to ADO agent fields for ticket ID ${ticket.id}: ${
          (error as Error).message
        }`,
        error
      );

      return [];
    }
  }

  buildFSToADORequesterFields(ticket: any): PatchOperation[] {
    try {
      const adoPatchData: PatchOperation[] = [];
      const fieldKey = process.env.ADO_REQUESTER_FIELD_KEY || "Custom.ReqID";

      const requester = ticket.requester;

      if (requester && requester.email) {
        const adoPatchEntry: PatchOperation = {
          op: "add",
          path: `/fields/${fieldKey}`,
          value: requester.email,
        };

        adoPatchData.push(adoPatchEntry);
      }
      return adoPatchData;
    } catch (error) {
      errorLogger.error("Error building FS to ADO requester fields:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      this.reportManager.error(
        "SyncEngine - buildFSToADORequesterFields",
        `Error building FS to ADO requester fields for ticket ID ${
          ticket.id
        }: ${(error as Error).message}`,
        error
      );
      return [];
    }
  }

  buildFSUpdateBodyFromADOBug(adoBug: WorkItem, ticket: any): any {
    try {
      const updateBody: Record<string, any> = { custom_fields: {} };

      if (process.env.FS_FIELD_FOR_ADO_BUG_ID) {
        const idKey = process.env.FS_FIELD_FOR_ADO_BUG_ID;
        updateBody.custom_fields[idKey] = String(adoBug.id);
      }

      if (!this.adoToFsMappings || this.adoToFsMappings.length === 0) {
        logger.warn("ADO to FS mappings are not initialized or empty.");
        return updateBody;
      }

      if (!adoBug.fields) {
        logger.warn(
          `ADO Bug ${adoBug.id} has no fields. Ticket ID: ${ticket.id}`
        );
        return updateBody;
      }

      this.adoToFsMappings.forEach((mapping) => {
        let adoFieldValue = adoBug.fields?.[mapping.ado_field] ?? null;

        if (adoFieldValue !== null && mapping.isMultiSelectFS) {
          adoFieldValue = String(adoFieldValue)
            .split(",")
            .map((val) => val.trim());
        }

        adoFieldValue = adoFieldValue ?? "";

        if (adoFieldValue && mapping.fsFieldType === "date") {
          adoFieldValue = convertADODateToISO(adoFieldValue);
        } else if (adoFieldValue && mapping.fsFieldType === "text") {
          adoFieldValue = "" + adoFieldValue;
        }

        if (mapping.isCustomFieldFS) {
          updateBody.custom_fields[mapping.fs_field] = adoFieldValue;
        } else {
          updateBody[mapping.fs_field] = adoFieldValue;
        }

        logger.debug(
          `adding adovalue ${adoFieldValue}. type: ${mapping.fsFieldType}`
        );
      });

      logger.debug(
        `FS Update Body built from ADO Bug ${adoBug.id} for Ticket ${ticket.id} :`,
        {
          updateBody,
        }
      );

      return updateBody;
    } catch (error) {
      errorLogger.error("Error building update body FS from ADO Bug:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      this.reportManager.error(
        "SyncEngine - buildFSUpdateBodyFromADOBug",
        `Error building update body FS from ADO Bug ID ${
          adoBug.id
        } for Ticket ID ${ticket.id}: ${(error as Error).message}`,
        error
      );

      return { custom_fields: {} };
    }
  }

  async handleAttachmentUploadAndLinking(ticket: any, adoBug: WorkItem) {
    try {
      const attachments = ticket.attachments;

      for (const attachment of attachments) {
        logger.info(
          `Uploading attachment ${attachment.name} for FS Ticket ID: ${ticket.id}`
        );
        const fileBufferResponse = await FSAdapter.client.get(
          attachment.attachment_url,
          { responseType: "arraybuffer" }
        );
        const fileBuffer = Buffer.from(fileBufferResponse.data);

        const uploadResult = await this.ado.uploadAttachment(
          attachment.name,
          attachment.content_type,
          fileBuffer
        );
        logger.info(
          `Uploaded attachment ${attachment.name} to ADO. Attachment ID: ${uploadResult.id}`
        );

        await this.ado.attachToWorkItem(adoBug.id, uploadResult.url);

        logger.info(
          `Attached attachment ${attachment.name} to ADO Bug ID: ${adoBug.id}`
        );
      }

      logger.info(
        `✅ Completed uploading and attaching ${attachments.length} files for FS Ticket ID: ${ticket.id}`
      );
    } catch (error) {
      console.log("Attach file error...");
      console.log(JSON.stringify(error));

      errorLogger.error(
        `Error uploading and attaching files for FS Ticket ID: ${ticket.id}`,
        {
          message: JSON.stringify((error as Error).message),
          stack: JSON.stringify((error as Error).stack),
          cause: JSON.stringify((error as Error)?.cause),
        }
      );
      this.reportManager.error(
        "SyncEngine - handleAttachmentUploadAndLinking",
        `Error uploading and attaching files for FS Ticket ID ${ticket.id}: ${
          (error as Error).message
        }`,
        JSON.stringify(error, null, 2)
      );
    }
  }
}
