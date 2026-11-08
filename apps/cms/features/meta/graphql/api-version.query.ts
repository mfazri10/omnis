import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

interface ApiVersionData {
  apiVersion: string;
}

// TODO(F02): ganti dokumen manual ini dengan hasil graphql-code-generator
// (ditunda karena F01 belum memakai GraphQL selain query bukti ini).
export const API_VERSION_QUERY: TypedDocumentNode<
  ApiVersionData,
  Record<string, never>
> = gql`
  query ApiVersion {
    apiVersion
  }
`;
