import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.
export interface CampaignData {
  id: string;
  appId: string;
  createdBy: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkTarget: string | null;
  targetType: string;
  targetSegment: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  targetCount: number;
  sentCount: number;
  failedCount: number;
  simulatedCount: number;
  unknownCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignsFilter {
  status?: string | null;
  search?: string | null;
}

export interface CampaignsConnection {
  items: CampaignData[];
  total: number;
}

const CAMPAIGN_FIELDS = `
  id
  appId
  createdBy
  title
  body
  imageUrl
  linkTarget
  targetType
  targetSegment
  status
  scheduledAt
  sentAt
  targetCount
  sentCount
  failedCount
  simulatedCount
  unknownCount
  createdAt
  updatedAt
`;

export const CAMPAIGNS_QUERY: TypedDocumentNode<
  { campaigns: CampaignsConnection },
  {
    page?: number | null;
    perPage?: number | null;
    filter?: CampaignsFilter | null;
  }
> = gql`
  query Campaigns($page: Int, $perPage: Int, $filter: CampaignFilterInput) {
    campaigns(page: $page, perPage: $perPage, filter: $filter) {
      items {
        ${CAMPAIGN_FIELDS}
      }
      total
    }
  }
`;

export interface CreateCampaignInput {
  title: string;
  body: string;
  imageUrl?: string | null;
  linkTarget?: string | null;
  targetType?: string | null;
  targetSegment?: string | null;
  scheduledAt?: string | null;
}

export const CREATE_CAMPAIGN_MUTATION: TypedDocumentNode<
  { createCampaign: CampaignData },
  { input: CreateCampaignInput }
> = gql`
  mutation CreateCampaign($input: CreateCampaignInput!) {
    createCampaign(input: $input) {
      ${CAMPAIGN_FIELDS}
    }
  }
`;

export interface UpdateCampaignInput {
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  linkTarget?: string | null;
  targetType?: string | null;
  targetSegment?: string | null;
  scheduledAt?: string | null;
}

export const UPDATE_CAMPAIGN_MUTATION: TypedDocumentNode<
  { updateCampaign: CampaignData },
  { id: string; input: UpdateCampaignInput }
> = gql`
  mutation UpdateCampaign($id: ID!, $input: UpdateCampaignInput!) {
    updateCampaign(id: $id, input: $input) {
      ${CAMPAIGN_FIELDS}
    }
  }
`;

export const SEND_CAMPAIGN_NOW_MUTATION: TypedDocumentNode<
  { sendCampaignNow: CampaignData },
  { id: string }
> = gql`
  mutation SendCampaignNow($id: ID!) {
    sendCampaignNow(id: $id) {
      ${CAMPAIGN_FIELDS}
    }
  }
`;

export const CANCEL_CAMPAIGN_MUTATION: TypedDocumentNode<
  { cancelCampaign: CampaignData },
  { id: string }
> = gql`
  mutation CancelCampaign($id: ID!) {
    cancelCampaign(id: $id) {
      ${CAMPAIGN_FIELDS}
    }
  }
`;
