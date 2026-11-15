import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface AdminData {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  isActive: boolean;
}

export interface AdminsData {
  admins: {
    totalCount: number;
    items: AdminData[];
  };
}

export interface AdminsVars {
  search?: string | null;
  skip?: number | null;
  take?: number | null;
}

export const ADMINS_QUERY: TypedDocumentNode<AdminsData, AdminsVars> = gql`
  query Admins($search: String, $skip: Int, $take: Int) {
    admins(search: $search, skip: $skip, take: $take) {
      totalCount
      items {
        id
        name
        email
        isSuperAdmin
        isActive
      }
    }
  }
`;

export const ADMIN_QUERY: TypedDocumentNode<{ admin: AdminData }, { id: string }> = gql`
  query Admin($id: ID!) {
    admin(id: $id) {
      id
      name
      email
      isSuperAdmin
      isActive
    }
  }
`;

export const CURRENT_ADMIN_QUERY: TypedDocumentNode<
  { currentAdmin: AdminData },
  Record<string, never>
> = gql`
  query CurrentAdmin {
    currentAdmin {
      id
      name
      email
      isSuperAdmin
      isActive
    }
  }
`;

export const EFFECTIVE_PERMISSIONS_QUERY: TypedDocumentNode<
  { effectivePermissions: string[] },
  { adminId: string; appId?: string | null }
> = gql`
  query EffectivePermissions($adminId: ID!, $appId: ID) {
    effectivePermissions(adminId: $adminId, appId: $appId)
  }
`;

export interface AssignmentData {
  roleId: string;
  roleName: string;
  scopeType: string;
  appId: string | null;
  appSlug: string | null;
}

export const ADMIN_ASSIGNMENTS_QUERY: TypedDocumentNode<
  { adminAssignments: AssignmentData[] },
  { adminId: string }
> = gql`
  query AdminAssignments($adminId: ID!) {
    adminAssignments(adminId: $adminId) {
      roleId
      roleName
      scopeType
      appId
      appSlug
    }
  }
`;

export const CREATE_ADMIN_MUTATION: TypedDocumentNode<
  { createAdmin: AdminData },
  { input: { name: string; email: string; password: string } }
> = gql`
  mutation CreateAdmin($input: CreateAdminInput!) {
    createAdmin(input: $input) {
      id
      name
      email
      isSuperAdmin
      isActive
    }
  }
`;

export const UPDATE_ADMIN_MUTATION: TypedDocumentNode<
  { updateAdmin: AdminData },
  { id: string; input: { name: string } }
> = gql`
  mutation UpdateAdmin($id: ID!, $input: UpdateAdminInput!) {
    updateAdmin(id: $id, input: $input) {
      id
      name
      email
      isSuperAdmin
      isActive
    }
  }
`;

export const SET_ADMIN_ACTIVE_MUTATION: TypedDocumentNode<
  { setAdminActive: AdminData },
  { id: string; active: boolean }
> = gql`
  mutation SetAdminActive($id: ID!, $active: Boolean!) {
    setAdminActive(id: $id, active: $active) {
      id
      name
      email
      isSuperAdmin
      isActive
    }
  }
`;
