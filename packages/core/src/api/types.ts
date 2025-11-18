export interface PatchOperation {
  op: "add" | "replace" | "remove" | "test" | string;
  path: string;
  value?: any;
}

export interface ApiError extends Error {
  status?: number;
  data?: any;
}

export interface WorkItem {
  id: number;
  rev?: number;
  fields?: Record<string, any>;
  url?: string;
}
