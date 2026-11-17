import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface MediaData {
  id: string;
  fileName: string;
  path: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  uploadedByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaFilter {
  search?: string | null;
}

export interface MediaConnection {
  items: MediaData[];
  total: number;
}

const MEDIA_FIELDS = `
  id
  fileName
  path
  url
  mimeType
  sizeBytes
  altText
  uploadedByAdminId
  createdAt
  updatedAt
`;

export const MEDIA_QUERY: TypedDocumentNode<
  { media: MediaConnection },
  {
    page?: number | null;
    perPage?: number | null;
    filter?: MediaFilter | null;
  }
> = gql`
  query Media($page: Int, $perPage: Int, $filter: MediaFilterInput) {
    media(page: $page, perPage: $perPage, filter: $filter) {
      items {
        ${MEDIA_FIELDS}
      }
      total
    }
  }
`;

export const DELETE_MEDIA_MUTATION: TypedDocumentNode<
  { deleteMedia: boolean },
  { id: string }
> = gql`
  mutation DeleteMedia($id: ID!) {
    deleteMedia(id: $id)
  }
`;
