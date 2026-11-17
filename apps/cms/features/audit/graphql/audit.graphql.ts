import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface ActivityLogData {
  id: string;
  adminId: string;
  adminName: string | null;
  appId: string | null;
  appName: string | null;
  appSlug: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  ipAddress: string | null;
  createdAt: string;
}

export interface ActivityLogsFilter {
  dateFrom?: string | null;
  dateTo?: string | null;
  appId?: string | null;
  adminId?: string | null;
  entityType?: string | null;
  action?: string | null;
  search?: string | null;
}

export interface ActivityLogsConnection {
  items: ActivityLogData[];
  total: number;
}

const ACTIVITY_LOG_FIELDS = `
  id
  adminId
  adminName
  appId
  appName
  appSlug
  action
  entityType
  entityId
  summary
  ipAddress
  createdAt
`;

export const ACTIVITY_LOGS_QUERY: TypedDocumentNode<
  { activityLogs: ActivityLogsConnection },
  {
    page?: number | null;
    perPage?: number | null;
    filter?: ActivityLogsFilter | null;
  }
> = gql`
  query ActivityLogs($page: Int, $perPage: Int, $filter: ActivityLogFilterInput) {
    activityLogs(page: $page, perPage: $perPage, filter: $filter) {
      items {
        ${ACTIVITY_LOG_FIELDS}
      }
      total
    }
  }
`;
