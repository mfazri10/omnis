import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.

export interface MobileMenuData {
  id: string;
  appId: string;
  name: string;
  slug: string;
  routeKey: string | null;
  iconKey: string | null;
  parentId: string | null;
  orderNo: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMobileMenuInput {
  name: string;
  slug: string;
  routeKey?: string | null;
  iconKey?: string | null;
  parentId?: string | null;
  orderNo?: number;
  isActive?: boolean;
}

export interface UpdateMobileMenuInput {
  id: string;
  name?: string | null;
  slug?: string | null;
  routeKey?: string | null;
  iconKey?: string | null;
  parentId?: string | null;
  orderNo?: number;
  isActive?: boolean;
}

const MENU_FIELDS = `
  id
  appId
  name
  slug
  routeKey
  iconKey
  parentId
  orderNo
  isActive
  createdAt
  updatedAt
`;

export const MOBILE_MENUS_QUERY: TypedDocumentNode<
  { mobileMenus: MobileMenuData[] },
  Record<string, never>
> = gql`
  query MobileMenus {
    mobileMenus {
      ${MENU_FIELDS}
    }
  }
`;

export const CREATE_MOBILE_MENU_MUTATION: TypedDocumentNode<
  { createMobileMenu: MobileMenuData },
  { input: CreateMobileMenuInput }
> = gql`
  mutation CreateMobileMenu($input: CreateMobileMenuInput!) {
    createMobileMenu(input: $input) {
      ${MENU_FIELDS}
    }
  }
`;

export const UPDATE_MOBILE_MENU_MUTATION: TypedDocumentNode<
  { updateMobileMenu: MobileMenuData },
  { input: UpdateMobileMenuInput }
> = gql`
  mutation UpdateMobileMenu($input: UpdateMobileMenuInput!) {
    updateMobileMenu(input: $input) {
      ${MENU_FIELDS}
    }
  }
`;

export const DELETE_MOBILE_MENU_MUTATION: TypedDocumentNode<
  { deleteMobileMenu: boolean },
  { id: string }
> = gql`
  mutation DeleteMobileMenu($id: ID!) {
    deleteMobileMenu(id: $id)
  }
`;
