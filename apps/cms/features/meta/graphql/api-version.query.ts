import { gql, TypedDocumentNode } from "@apollo/client";

interface ApiVersionData {
  apiVersion: string;
}

// TODO(F01): ganti dokumen manual ini dengan hasil graphql-code-generator.
export const API_VERSION_QUERY: TypedDocumentNode<
  ApiVersionData,
  Record<string, never>
> = gql`
  query ApiVersion {
    apiVersion
  }
`;
