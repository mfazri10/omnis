import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface PermissionData {
  id: string;
  key: string;
  module: string;
  label: string;
  description: string | null;
  globalOnly: boolean;
}

export const PERMISSIONS_QUERY: TypedDocumentNode<
  { permissions: PermissionData[] },
  { module?: string | null }
> = gql`
  query Permissions($module: String) {
    permissions(module: $module) {
      id
      key
      module
      label
      description
      globalOnly
    }
  }
`;

export interface AppData {
  id: string;
  slug: string;
  name: string;
  status: string;
}

export const APPS_QUERY: TypedDocumentNode<
  { apps: AppData[] },
  Record<string, never>
> = gql`
  query Apps {
    apps {
      id
      slug
      name
      status
    }
  }
`;
