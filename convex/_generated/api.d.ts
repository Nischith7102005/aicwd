import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as agent from "../agent.js";
import type * as api from "../api.js";
import type * as etlExport from "../etlExport.js";
import type * as inference from "../inference.js";
import type * as ingest from "../ingest.js";
import type * as llm from "../llm.js";
import type * as metrics from "../metrics.js";
import type * as mutations from "../mutations.js";
import type * as queries from "../queries.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  api: typeof api;
  etlExport: typeof etlExport;
  inference: typeof inference;
  ingest: typeof ingest;
  llm: typeof llm;
  metrics: typeof metrics;
  mutations: typeof mutations;
  queries: typeof queries;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
