import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";
import type { ActivityLogsFilter } from "../../audit/graphql/audit.graphql";
import type { AppUsersFilter } from "../../app-users/graphql/app-users.graphql";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export type ExportJobSource = "APP_USERS" | "ACTIVITY_LOGS";
export type ExportJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "DONE"
  | "FAILED"
  | "EXPIRED";

export interface ExportJobData {
  id: string;
  source: ExportJobSource;
  status: ExportJobStatus;
  rowCount: number | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
  downloadPath: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const EXPORT_JOB_FIELDS = `
  id
  source
  status
  rowCount
  fileName
  fileSizeBytes
  errorMessage
  downloadPath
  expiresAt
  createdAt
  updatedAt
`;

export const EXPORT_APP_USERS_MUTATION: TypedDocumentNode<
  { exportAppUsers: ExportJobData },
  { filter?: AppUsersFilter | null }
> = gql`
  mutation ExportAppUsers($filter: AppUserFilterInput) {
    exportAppUsers(filter: $filter) {
      ${EXPORT_JOB_FIELDS}
    }
  }
`;

export const EXPORT_ACTIVITY_LOGS_MUTATION: TypedDocumentNode<
  { exportActivityLogs: ExportJobData },
  { filter?: ActivityLogsFilter | null }
> = gql`
  mutation ExportActivityLogs($filter: ActivityLogFilterInput) {
    exportActivityLogs(filter: $filter) {
      ${EXPORT_JOB_FIELDS}
    }
  }
`;

export const EXPORT_JOB_QUERY: TypedDocumentNode<
  { exportJob: ExportJobData },
  { id: string }
> = gql`
  query ExportJob($id: ID!) {
    exportJob(id: $id) {
      ${EXPORT_JOB_FIELDS}
    }
  }
`;
