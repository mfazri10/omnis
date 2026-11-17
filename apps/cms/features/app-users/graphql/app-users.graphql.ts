import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface AppUserData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  metadata: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppUsersFilter {
  search?: string | null;
  status?: string | null;
}

export interface AppUsersConnection {
  items: AppUserData[];
  total: number;
}

const APP_USER_FIELDS = `
  id
  name
  email
  phone
  avatarUrl
  isActive
  metadata
  lastLoginAt
  createdAt
  updatedAt
`;

export const APP_USERS_QUERY: TypedDocumentNode<
  { appUsers: AppUsersConnection },
  {
    page?: number | null;
    perPage?: number | null;
    filter?: AppUsersFilter | null;
  }
> = gql`
  query AppUsers($page: Int, $perPage: Int, $filter: AppUserFilterInput) {
    appUsers(page: $page, perPage: $perPage, filter: $filter) {
      items {
        ${APP_USER_FIELDS}
      }
      total
    }
  }
`;

export interface CreateAppUserInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  metadata?: string | null;
}

export const CREATE_APP_USER_MUTATION: TypedDocumentNode<
  { createAppUser: AppUserData },
  { input: CreateAppUserInput }
> = gql`
  mutation CreateAppUser($input: CreateAppUserInput!) {
    createAppUser(input: $input) {
      ${APP_USER_FIELDS}
    }
  }
`;

export interface UpdateAppUserInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  metadata?: string | null;
}

export const UPDATE_APP_USER_MUTATION: TypedDocumentNode<
  { updateAppUser: AppUserData },
  { id: string; input: UpdateAppUserInput }
> = gql`
  mutation UpdateAppUser($id: ID!, $input: UpdateAppUserInput!) {
    updateAppUser(id: $id, input: $input) {
      ${APP_USER_FIELDS}
    }
  }
`;

export const SET_APP_USER_ACTIVE_MUTATION: TypedDocumentNode<
  { setAppUserActive: AppUserData },
  { id: string; active: boolean }
> = gql`
  mutation SetAppUserActive($id: ID!, $active: Boolean!) {
    setAppUserActive(id: $id, active: $active) {
      ${APP_USER_FIELDS}
    }
  }
`;
