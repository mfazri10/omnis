import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface AccessibleAppData {
  id: string;
  slug: string;
  name: string;
  status: string;
  iconMediaUrl: string | null;
}

export const MY_APPS_QUERY: TypedDocumentNode<
  { myApps: AccessibleAppData[] },
  Record<string, never>
> = gql`
  query MyApps {
    myApps {
      id
      slug
      name
      status
      iconMediaUrl
    }
  }
`;

export const MY_PERMISSIONS_QUERY: TypedDocumentNode<
  { myPermissions: string[] },
  { appId?: string | null }
> = gql`
  query MyPermissions($appId: ID) {
    myPermissions(appId: $appId)
  }
`;
