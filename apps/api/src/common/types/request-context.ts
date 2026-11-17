import type { AppStatus } from "../../modules/platform/entities/apps.entity";

/** Bentuk minimal konteks GraphQL yang dipakai guard/interceptor/decorator. */
export interface GraphqlRequest {
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GraphqlContext {
  req: GraphqlRequest;
}

export const APP_CONTEXT_KEY = "appContext";

/** Konteks aplikasi tervalidasi AppContextGuard (F02). */
export interface AppContext {
  appId: string;
  slug: string;
  name: string;
  status: AppStatus;
  dbName: string;
}
