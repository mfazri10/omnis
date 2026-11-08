/** Bentuk minimal konteks GraphQL yang dipakai guard/interceptor/decorator. */
export interface GraphqlRequest {
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GraphqlContext {
  req: GraphqlRequest;
}
