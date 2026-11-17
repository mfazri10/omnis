import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface AppConfigData {
  appId: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  minVersionAndroid: string;
  minVersionIos: string;
  themePrimaryColor: string;
  logoMediaUrl: string | null;
  supportEmail: string | null;
  supportWhatsapp: string | null;
  updatedAt: string;
  displayName: string;
  slug: string;
  iconMediaUrl: string | null;
  storeUrlAndroid: string | null;
  storeUrlIos: string | null;
}

const APP_CONFIG_FIELDS = `
  appId
  maintenanceMode
  maintenanceMessage
  minVersionAndroid
  minVersionIos
  themePrimaryColor
  logoMediaUrl
  supportEmail
  supportWhatsapp
  updatedAt
  displayName
  slug
  iconMediaUrl
  storeUrlAndroid
  storeUrlIos
`;

export const APP_CONFIG_QUERY: TypedDocumentNode<
  { appConfig: AppConfigData },
  Record<string, never>
> = gql`
  query AppConfig {
    appConfig {
      ${APP_CONFIG_FIELDS}
    }
  }
`;

export interface UpdateAppConfigInput {
  maintenanceMode: boolean;
  maintenanceMessage?: string | null;
  minVersionAndroid?: string | null;
  minVersionIos?: string | null;
  themePrimaryColor?: string | null;
  logoMediaUrl?: string | null;
  supportEmail?: string | null;
  supportWhatsapp?: string | null;
}

export const UPDATE_APP_CONFIG_MUTATION: TypedDocumentNode<
  { updateAppConfig: AppConfigData },
  { input: UpdateAppConfigInput }
> = gql`
  mutation UpdateAppConfig($input: UpdateAppConfigInput!) {
    updateAppConfig(input: $input) {
      ${APP_CONFIG_FIELDS}
    }
  }
`;
