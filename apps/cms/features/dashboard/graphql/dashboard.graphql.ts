import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface DashboardActivityData {
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

export interface PlatformAppCardData {
  id: string;
  slug: string;
  name: string;
  status: string;
  userCount: number;
  activityCount7d: number;
}

export interface NotificationQueueData {
  scheduled: number;
  sending: number;
  failed: number;
}

export interface PlatformDashboardData {
  apps: PlatformAppCardData[];
  recentActivity: DashboardActivityData[];
  notificationQueue: NotificationQueueData;
}

export interface DashboardSectionData {
  key: string;
  label: string;
  value: number;
  hint: string | null;
}

export interface AppDashboardAppData {
  id: string;
  slug: string;
  name: string;
  status: string;
}

export interface AppCampaignSummaryData {
  draft: number;
  scheduled: number;
  sent: number;
  failed: number;
}

export interface AppDashboardData {
  app: AppDashboardAppData;
  sections: DashboardSectionData[];
  recentActivity: DashboardActivityData[];
  campaigns: AppCampaignSummaryData;
}

const DASHBOARD_ACTIVITY_FIELDS = `
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

export const PLATFORM_DASHBOARD_QUERY: TypedDocumentNode<
  { platformDashboard: PlatformDashboardData },
  Record<string, never>
> = gql`
  query PlatformDashboard {
    platformDashboard {
      apps {
        id
        slug
        name
        status
        userCount
        activityCount7d
      }
      recentActivity {
        ${DASHBOARD_ACTIVITY_FIELDS}
      }
      notificationQueue {
        scheduled
        sending
        failed
      }
    }
  }
`;

export const APP_DASHBOARD_QUERY: TypedDocumentNode<
  { appDashboard: AppDashboardData },
  Record<string, never>
> = gql`
  query AppDashboard {
    appDashboard {
      app {
        id
        slug
        name
        status
      }
      sections {
        key
        label
        value
        hint
      }
      recentActivity {
        ${DASHBOARD_ACTIVITY_FIELDS}
      }
      campaigns {
        draft
        scheduled
        sent
        failed
      }
    }
  }
`;
