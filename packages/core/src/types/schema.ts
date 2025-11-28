import { z } from "zod";

export const MappingSchema = z.object({
  fs_field: z.string().min(1),
  crm_field: z.string().min(1),
  isCustomFieldFS: z.boolean().optional().default(false),
  direction: z.enum(["FS_TO_CRM", "CRM_TO_FS"]),
  isMultiSelectCrm: z.boolean().optional().default(false),
});

export type MappingRecord = z.infer<typeof MappingSchema>;

/**
 * SingleField Sheet
 * FS-Field-Key	isCustomFieldFS	ADO-Field-Key	Direction
id	FALSE	Custom.IMSID	FS_TO_ADO
subject	FALSE	System.Title	FS_TO_ADO
created_at	FALSE	IMSCreatedOn	FS_TO_ADO
queued_on	TRUE	IMSQueuedOn	FS_TO_ADO
product_version	TRUE	Custom.ProductVersion	FS_TO_ADO
product_name	TRUE	Solution.ProductName	FS_TO_ADO
department_id	FALSE	Custom.AccountID	FS_TO_ADO
requester	FALSE	Custom.ReqID	FS_TO_ADO
responder	FALSE	Custom.IMSTechnician	FS_TO_ADO
source_control_reference	TRUE	id	ADO_TO_FS
source_control_reference_created_on	TRUE	System.CreatedDate	ADO_TO_FS
devops_status	TRUE	System. State	ADO_TO_FS
 */
export const SingleFieldMappingSchema = z.object({
  fs_field: z.string().min(1),
  isCustomFieldFS: z.boolean().optional().default(false),
  isMultiSelectFS: z.boolean().optional().default(false),
  fsFieldType: z.enum(["text", "date", ""]),
  ado_field: z.string().min(1),
  direction: z.enum(["FS_TO_ADO", "ADO_TO_FS"]),
});
export type SingleFieldMappingRecord = z.infer<typeof SingleFieldMappingSchema>;

/**
 * Repo Sheet
 * FS-Field-Key	isCustomFieldFS	isMultiSelectFS	Direction	TitleText	isMultiSelectADO
msf_module	TRUE	TRUE	FS_TO_ADO	Modules	FALSE
description	FALSE	FALSE	FS_TO_ADO	Description	FALSE
steps_to_reproduce	TRUE	FALSE	FS_TO_ADO	Steps To Reporoduce	FALSE
problem_statement	TRUE	FALSE	FS_TO_ADO	Problem Statement	FALSE
 */
export const RepoMappingSchema = z.object({
  fs_field: z.string().min(1),
  isCustomFieldFS: z.boolean().optional().default(false),
  isMultiSelectFS: z.boolean().optional().default(false),
  direction: z.enum(["FS_TO_ADO", "ADO_TO_FS"]),
  titleText: z.string().min(1),
  isMultiSelectADO: z.boolean().optional().default(false),
});
export type RepoMappingRecord = z.infer<typeof RepoMappingSchema>;

/**
 * Query Sheet
 * Param	Value	isValueBoolean	EnclosingQuotesType
status	12	FALSE	SINGLE_QUOTES
status	14	FALSE	SINGLE_QUOTES
status	17	FALSE	SINGLE_QUOTES
status	20	FALSE	SINGLE_QUOTES
status	21	FALSE	SINGLE_QUOTES
status	22	FALSE	SINGLE_QUOTES
workspace_id	3	FALSE	NONE
queued_with	Level-3	FALSE	SINGLE_QUOTES
Disable_DevOps_Sync	FALSE	TRUE	NONE
 */
export const QueryMappingSchema = z.object({
  param: z.string().min(1),
  value: z.string().min(1),
  isValueBoolean: z.boolean().optional().default(false),
  enclosingQuotesType: z.enum(["SINGLE_QUOTES", "NONE"]),
});
export type QueryMappingRecord = z.infer<typeof QueryMappingSchema>;

/**
 * URL Sheet
 * Key	Value
FETCHURL	https://valgenesis-helpdesk-dev.freshservice.com/api/v2/tickets/filter?page=1&query="(status:'12' OR status:'14' OR  status:'17' OR status:'20' OR status:'21' OR status:'22') AND workspace_id:3 AND queued_with: 'Level-3' AND Disable_DevOps_Sync:false"
 */
export const URLMappingSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});
export type URLMappingRecord = z.infer<typeof URLMappingSchema>;

/**
 * ProductFields Sheet
 * ADO-Field-Key	ProductsDataSheetKey	Direction
Custom.Developer	Developer	FS_TO_ADO
Custom.Tester	Tester	FS_TO_ADO
System.AreaPath	AreaPath	FS_TO_ADO
System.TeamProject	TeamProject	FS_TO_ADO
System.IterationPath	IterationPath	FS_TO_ADO
System.WorkItemType	WorkItemType	FS_TO_ADO
 */
export const ProductFieldMappingSchema = z.object({
  ado_field: z.string().min(1),
  products_data_sheet_key: z.string().min(1),
  direction: z.enum(["FS_TO_ADO", "ADO_TO_FS"]),
});
export type ProductFieldMappingRecord = z.infer<
  typeof ProductFieldMappingSchema
>;

/**
 * ProductsData Sheet
 * ProductName	ProductVersion	AreaPath	IterationPath	TeamProject	Developer	Tester	WorkItemType
VLMS	4.0.0.0	vg-test\VLMSV4	iteration1	VG-SUPPORT-TEST	user1	tester1	Bug
VLMS	4.0.1	vg-test\VLMSV4	iternaltion2	VG-SUPPORT-TEST	user2	tester2	Bug
VLMS	4.1.0.	vg-test\VLMSV4	iteration1	VG-SUPPORT-TEST	user3	tester3	Bug
VLMS	4.2.0	vg-test\VLMSV4	iteration1	VG-SUPPORT-TEST	user4	tester4	Bug
VLMS	4.2.3	vg-test\VLMSV4	iternaltion2	VG-SUPPORT-TEST	user5	tester5	Bug
VLMS	4.2.7	vg-test\VLMSV4	iteration1	VG-SUPPORT-TEST	user6	tester6	Bug
VLMS	5.0.0.0.	vg-test\VLMSV5	iteration1	VG-SUPPORT-TEST	user7	tester7	Bug
VLMS	5.1.0.0.	vg-test\VLMSV5	iternaltion2	VG-SUPPORT-TEST	user8	tester8	Bug
PM	1.5.0.3.	vg-test\PM	iteration1	VG-SUPPORT-TEST	user9	tester9	Bug
 */

export const ProductsDataMappingSchema = z.object({
  ProductName: z.string().min(1),
  ProductVersion: z.string().min(1),
  AreaPath: z.string().min(1),
  IterationPath: z.string().min(1),
  TeamProject: z.string().min(1),
  Developer: z.string().min(1),
  Tester: z.string().min(1),
  WorkItemType: z.string().min(1),
  AssignedTo: z.string().min(1),
});
export type ProductsDataMappingRecord = z.infer<
  typeof ProductsDataMappingSchema
>;

export const sheetsDataSchema = z.object({
  singleField: z.array(SingleFieldMappingSchema),
  repo: z.array(RepoMappingSchema),
  query: z.array(QueryMappingSchema),
  url: z.array(URLMappingSchema),
  productField: z.array(ProductFieldMappingSchema),
  productsData: z.array(ProductsDataMappingSchema),
});
export type sheetsDataType = z.infer<typeof sheetsDataSchema>;
