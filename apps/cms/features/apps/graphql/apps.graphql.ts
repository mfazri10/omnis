import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface AppListData {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
}

export const APPS_LIST_QUERY: TypedDocumentNode<
  { apps: AppListData[] },
  { status?: string | null; search?: string | null }
> = gql`
  query AppsList($status: String, $search: String) {
    apps(status: $status, search: $search) {
      id
      slug
      name
      status
      createdAt
    }
  }
`;

export interface AppDetailData {
  id: string;
  slug: string;
  name: string;
  status: string;
  dbName: string;
  iconMediaUrl: string | null;
  androidPackage: string | null;
  iosBundleId: string | null;
  storeUrlAndroid: string | null;
  storeUrlIos: string | null;
  notes: string | null;
  failureReason: string | null;
  lastProvisioningAt: string | null;
  createdAt: string;
  fcmConfigured: boolean;
}

const APP_DETAIL_FIELDS = `
  id
  slug
  name
  status
  dbName
  iconMediaUrl
  androidPackage
  iosBundleId
  storeUrlAndroid
  storeUrlIos
  notes
  failureReason
  lastProvisioningAt
  createdAt
  fcmConfigured
`;

export const APP_QUERY: TypedDocumentNode<
  { app: AppDetailData },
  { slug: string }
> = gql`
  query App($slug: String!) {
    app(slug: $slug) {
      ${APP_DETAIL_FIELDS}
    }
  }
`;

export interface ProvisionAppInput {
  name: string;
  slug: string;
  iconMediaUrl?: string | null;
  androidPackage?: string | null;
  iosBundleId?: string | null;
  storeUrlAndroid?: string | null;
  storeUrlIos?: string | null;
  notes?: string | null;
}

export const PROVISION_APP_MUTATION: TypedDocumentNode<
  { provisionApp: AppDetailData },
  { input: ProvisionAppInput }
> = gql`
  mutation ProvisionApp($input: ProvisionAppInput!) {
    provisionApp(input: $input) {
      ${APP_DETAIL_FIELDS}
    }
  }
`;

export const RETRY_PROVISION_MUTATION: TypedDocumentNode<
  { retryProvisionApp: AppDetailData },
  { slug: string }
> = gql`
  mutation RetryProvision($slug: String!) {
    retryProvisionApp(slug: $slug) {
      ${APP_DETAIL_FIELDS}
    }
  }
`;

export interface UpdateAppInput {
  name?: string | null;
  notes?: string | null;
  iconMediaUrl?: string | null;
  androidPackage?: string | null;
  iosBundleId?: string | null;
  storeUrlAndroid?: string | null;
  storeUrlIos?: string | null;
}

export const UPDATE_APP_MUTATION: TypedDocumentNode<
  { updateApp: AppDetailData },
  { id: string; input: UpdateAppInput }
> = gql`
  mutation UpdateApp($id: ID!, $input: UpdateAppInput!) {
    updateApp(id: $id, input: $input) {
      ${APP_DETAIL_FIELDS}
    }
  }
`;

export const SUSPEND_APP_MUTATION: TypedDocumentNode<
  { suspendApp: AppDetailData },
  { id: string }
> = gql`
  mutation SuspendApp($id: ID!) {
    suspendApp(id: $id) {
      ${APP_DETAIL_FIELDS}
    }
  }
`;

export const UNSUSPEND_APP_MUTATION: TypedDocumentNode<
  { unsuspendApp: AppDetailData },
  { id: string }
> = gql`
  mutation UnsuspendApp($id: ID!) {
    unsuspendApp(id: $id) {
      ${APP_DETAIL_FIELDS}
    }
  }
`;

export const ARCHIVE_APP_MUTATION: TypedDocumentNode<
  { archiveApp: AppDetailData },
  { id: string }
> = gql`
  mutation ArchiveApp($id: ID!) {
    archiveApp(id: $id) {
      ${APP_DETAIL_FIELDS}
    }
  }
`;

export const DELETE_APP_MUTATION: TypedDocumentNode<
  { deleteApp: boolean },
  { id: string }
> = gql`
  mutation DeleteApp($id: ID!) {
    deleteApp(id: $id)
  }
`;

export const SET_FCM_MUTATION: TypedDocumentNode<
  { setFcmCredential: boolean },
  { appId: string; serviceAccountJson: string }
> = gql`
  mutation SetFcm($appId: ID!, $serviceAccountJson: String!) {
    setFcmCredential(appId: $appId, serviceAccountJson: $serviceAccountJson)
  }
`;
