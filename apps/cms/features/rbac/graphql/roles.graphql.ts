import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface RoleData {
  id: string;
  name: string;
  description: string | null;
  scopeType: string;
  appId: string | null;
  permissionKeys: string[];
}

export interface RolesData {
  roles: RoleData[];
}

export interface RolesVars {
  scope?: string | null;
  appId?: string | null;
}

export const ROLES_QUERY: TypedDocumentNode<RolesData, RolesVars> = gql`
  query Roles($scope: String, $appId: ID) {
    roles(scope: $scope, appId: $appId) {
      id
      name
      description
      scopeType
      appId
      permissionKeys
    }
  }
`;

export interface RoleInput {
  name: string;
  description?: string | null;
  scopeType: string;
  appId?: string | null;
  permissionKeys: string[];
}

export interface CreateRoleData {
  createRole: RoleData;
}

export interface CreateRoleVars {
  input: RoleInput;
}

export const CREATE_ROLE_MUTATION: TypedDocumentNode<
  CreateRoleData,
  CreateRoleVars
> = gql`
  mutation CreateRole($input: CreateRoleInput!) {
    createRole(input: $input) {
      id
      name
      description
      scopeType
      appId
      permissionKeys
    }
  }
`;

export interface UpdateRoleInput {
  name?: string | null;
  description?: string | null;
  permissionKeys?: string[] | null;
}

export interface UpdateRoleData {
  updateRole: RoleData;
}

export interface UpdateRoleVars {
  id: string;
  input: UpdateRoleInput;
}

export const UPDATE_ROLE_MUTATION: TypedDocumentNode<
  UpdateRoleData,
  UpdateRoleVars
> = gql`
  mutation UpdateRole($id: ID!, $input: UpdateRoleInput!) {
    updateRole(id: $id, input: $input) {
      id
      name
      description
      scopeType
      appId
      permissionKeys
    }
  }
`;

export const DELETE_ROLE_MUTATION: TypedDocumentNode<
  { deleteRole: boolean },
  { id: string }
> = gql`
  mutation DeleteRole($id: ID!) {
    deleteRole(id: $id)
  }
`;

export interface AssignmentVars {
  adminId: string;
  roleId: string;
  appId?: string | null;
}

export const ASSIGN_ROLE_MUTATION: TypedDocumentNode<
  { assignRole: boolean },
  AssignmentVars
> = gql`
  mutation AssignRole($adminId: ID!, $roleId: ID!, $appId: ID) {
    assignRole(adminId: $adminId, roleId: $roleId, appId: $appId)
  }
`;

export const UNASSIGN_ROLE_MUTATION: TypedDocumentNode<
  { unassignRole: boolean },
  AssignmentVars
> = gql`
  mutation UnassignRole($adminId: ID!, $roleId: ID!, $appId: ID) {
    unassignRole(adminId: $adminId, roleId: $roleId, appId: $appId)
  }
`;
