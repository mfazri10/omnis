import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

// TODO: ganti dokumen manual ini dengan hasil graphql-code-generator
// saat codegen dikonfigurasi.

export type CbtCategory = "TWK" | "TIU" | "TKP";
export type CbtOption = "A" | "B" | "C" | "D" | "E";
/** Nilai enum GraphQL (nama enum, bukan nilai internal database). */
export type CbtSessionStatus = "ONGOING" | "COMPLETED";

export interface TkpWeightsData {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
}

export interface CbtQuestionData {
  id: string;
  category: CbtCategory;
  stem: string;
  imageUrl: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctOption: CbtOption | null;
  tkpWeights: TkpWeightsData | null;
  explanation: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CbtQuestionsFilter {
  category?: CbtCategory | null;
  search?: string | null;
  isActive?: boolean | null;
}

export interface CbtQuestionsConnection {
  items: CbtQuestionData[];
  total: number;
}

const QUESTION_FIELDS = `
  id
  category
  stem
  imageUrl
  optionA
  optionB
  optionC
  optionD
  optionE
  correctOption
  tkpWeights { A B C D E }
  explanation
  isActive
  createdAt
  updatedAt
`;

export const CBT_QUESTIONS_QUERY: TypedDocumentNode<
  { cbtQuestions: CbtQuestionsConnection },
  {
    page?: number | null;
    perPage?: number | null;
    filter?: CbtQuestionsFilter | null;
  }
> = gql`
  query CbtQuestions($page: Int, $perPage: Int, $filter: CbtQuestionFilterInput) {
    cbtQuestions(page: $page, perPage: $perPage, filter: $filter) {
      items {
        ${QUESTION_FIELDS}
      }
      total
    }
  }
`;

export interface CreateCbtQuestionInput {
  category: CbtCategory;
  stem: string;
  imageUrl?: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctOption?: CbtOption | null;
  tkpWeights?: TkpWeightsData | null;
  explanation?: string | null;
}

export type UpdateCbtQuestionInput = Partial<CreateCbtQuestionInput> & {
  isActive?: boolean | null;
};

export const CREATE_CBT_QUESTION_MUTATION: TypedDocumentNode<
  { createCbtQuestion: CbtQuestionData },
  { input: CreateCbtQuestionInput }
> = gql`
  mutation CreateCbtQuestion($input: CreateCbtQuestionInput!) {
    createCbtQuestion(input: $input) {
      ${QUESTION_FIELDS}
    }
  }
`;

export const UPDATE_CBT_QUESTION_MUTATION: TypedDocumentNode<
  { updateCbtQuestion: CbtQuestionData },
  { id: string; input: UpdateCbtQuestionInput }
> = gql`
  mutation UpdateCbtQuestion($id: ID!, $input: UpdateCbtQuestionInput!) {
    updateCbtQuestion(id: $id, input: $input) {
      ${QUESTION_FIELDS}
    }
  }
`;

export const SET_CBT_QUESTION_ACTIVE_MUTATION: TypedDocumentNode<
  { setCbtQuestionActive: CbtQuestionData },
  { id: string; active: boolean }
> = gql`
  mutation SetCbtQuestionActive($id: ID!, $active: Boolean!) {
    setCbtQuestionActive(id: $id, active: $active) {
      ${QUESTION_FIELDS}
    }
  }
`;

export interface CbtPassingGradeData {
  twk: number;
  tiu: number;
  tkp: number;
}

export interface CbtPackageData {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  passingGrade: CbtPassingGradeData;
  isActive: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CbtPackageDetailData extends CbtPackageData {
  questions: CbtQuestionData[];
}

export interface CbtPackagesFilter {
  search?: string | null;
  isActive?: boolean | null;
}

export interface CbtPackagesConnection {
  items: CbtPackageData[];
  total: number;
}

const PACKAGE_FIELDS = `
  id
  title
  description
  durationMinutes
  passingGrade { twk tiu tkp }
  isActive
  questionCount
  createdAt
  updatedAt
`;

export const CBT_PACKAGES_QUERY: TypedDocumentNode<
  { cbtPackages: CbtPackagesConnection },
  {
    page?: number | null;
    perPage?: number | null;
    filter?: CbtPackagesFilter | null;
  }
> = gql`
  query CbtPackages($page: Int, $perPage: Int, $filter: CbtPackageFilterInput) {
    cbtPackages(page: $page, perPage: $perPage, filter: $filter) {
      items {
        ${PACKAGE_FIELDS}
      }
      total
    }
  }
`;

export const CBT_PACKAGE_QUERY: TypedDocumentNode<
  { cbtPackage: CbtPackageDetailData },
  { id: string }
> = gql`
  query CbtPackage($id: ID!) {
    cbtPackage(id: $id) {
      ${PACKAGE_FIELDS}
      questions {
        ${QUESTION_FIELDS}
      }
    }
  }
`;

export interface CreateCbtPackageInput {
  title: string;
  description?: string | null;
  durationMinutes?: number | null;
  passingGrade: CbtPassingGradeData;
}

export type UpdateCbtPackageInput = Partial<CreateCbtPackageInput> & {
  isActive?: boolean | null;
};

export const CREATE_CBT_PACKAGE_MUTATION: TypedDocumentNode<
  { createCbtPackage: CbtPackageData },
  { input: CreateCbtPackageInput }
> = gql`
  mutation CreateCbtPackage($input: CreateCbtPackageInput!) {
    createCbtPackage(input: $input) {
      ${PACKAGE_FIELDS}
    }
  }
`;

export const UPDATE_CBT_PACKAGE_MUTATION: TypedDocumentNode<
  { updateCbtPackage: CbtPackageData },
  { id: string; input: UpdateCbtPackageInput }
> = gql`
  mutation UpdateCbtPackage($id: ID!, $input: UpdateCbtPackageInput!) {
    updateCbtPackage(id: $id, input: $input) {
      ${PACKAGE_FIELDS}
    }
  }
`;

export const SET_CBT_PACKAGE_QUESTIONS_MUTATION: TypedDocumentNode<
  { setCbtPackageQuestions: CbtPackageDetailData },
  { id: string; questionIds: string[] }
> = gql`
  mutation SetCbtPackageQuestions($id: ID!, $questionIds: [ID!]!) {
    setCbtPackageQuestions(id: $id, questionIds: $questionIds) {
      ${PACKAGE_FIELDS}
      questions {
        id
        category
      }
    }
  }
`;

export interface CbtSessionData {
  id: string;
  packageId: string;
  packageTitle: string;
  appUserId: string | null;
  participantName: string;
  status: CbtSessionStatus;
  startedAt: string;
  finishedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CbtAnswerData {
  questionId: string;
  selectedOption: CbtOption | null;
}

export interface CbtResultData {
  id: string;
  sessionId: string;
  participantName: string;
  packageId: string;
  packageTitle: string;
  twkScore: number;
  tiuScore: number;
  tkpScore: number;
  totalScore: number;
  passed: boolean;
  computedAt: string;
  finishedAt: string | null;
}

export interface CbtSessionDetailData {
  session: CbtSessionData;
  package: CbtPackageData;
  questions: CbtQuestionData[];
  answers: CbtAnswerData[];
  result: CbtResultData | null;
}

export interface CbtSessionsFilter {
  packageId?: string | null;
  status?: CbtSessionStatus | null;
  search?: string | null;
}

export interface CbtSessionsConnection {
  items: CbtSessionData[];
  total: number;
}

const SESSION_FIELDS = `
  id
  packageId
  packageTitle
  appUserId
  participantName
  status
  startedAt
  finishedAt
  createdBy
  createdAt
`;

const RESULT_FIELDS = `
  id
  sessionId
  participantName
  packageId
  packageTitle
  twkScore
  tiuScore
  tkpScore
  totalScore
  passed
  computedAt
  finishedAt
`;

const SESSION_DETAIL_FIELDS = `
  session { ${SESSION_FIELDS} }
  package { ${PACKAGE_FIELDS} }
  questions { ${QUESTION_FIELDS} }
  answers { questionId selectedOption }
  result { ${RESULT_FIELDS} }
`;

export const CBT_SESSIONS_QUERY: TypedDocumentNode<
  { cbtSessions: CbtSessionsConnection },
  {
    page?: number | null;
    perPage?: number | null;
    filter?: CbtSessionsFilter | null;
  }
> = gql`
  query CbtSessions($page: Int, $perPage: Int, $filter: CbtSessionFilterInput) {
    cbtSessions(page: $page, perPage: $perPage, filter: $filter) {
      items {
        ${SESSION_FIELDS}
      }
      total
    }
  }
`;

export const CBT_SESSION_QUERY: TypedDocumentNode<
  { cbtSession: CbtSessionDetailData },
  { id: string }
> = gql`
  query CbtSession($id: ID!) {
    cbtSession(id: $id) {
      ${SESSION_DETAIL_FIELDS}
    }
  }
`;

export interface StartCbtSimulationInput {
  packageId: string;
  appUserId?: string | null;
  participantName?: string | null;
}

export const START_CBT_SIMULATION_MUTATION: TypedDocumentNode<
  { startCbtSimulation: CbtSessionDetailData },
  { input: StartCbtSimulationInput }
> = gql`
  mutation StartCbtSimulation($input: StartCbtSimulationInput!) {
    startCbtSimulation(input: $input) {
      ${SESSION_DETAIL_FIELDS}
    }
  }
`;

export interface CbtAnswerInput {
  questionId: string;
  selectedOption?: CbtOption | null;
}

export const SUBMIT_CBT_ANSWERS_MUTATION: TypedDocumentNode<
  { submitCbtAnswers: CbtSessionDetailData },
  { sessionId: string; answers: CbtAnswerInput[] }
> = gql`
  mutation SubmitCbtAnswers($sessionId: ID!, $answers: [CbtAnswerInput!]!) {
    submitCbtAnswers(sessionId: $sessionId, answers: $answers) {
      ${SESSION_DETAIL_FIELDS}
    }
  }
`;

export const FINISH_CBT_SESSION_MUTATION: TypedDocumentNode<
  { finishCbtSession: CbtSessionDetailData },
  { id: string }
> = gql`
  mutation FinishCbtSession($id: ID!) {
    finishCbtSession(id: $id) {
      ${SESSION_DETAIL_FIELDS}
    }
  }
`;

export interface CbtResultsFilter {
  packageId?: string | null;
  passed?: boolean | null;
}

export interface CbtResultsConnection {
  items: CbtResultData[];
  total: number;
}

export const CBT_RESULTS_QUERY: TypedDocumentNode<
  { cbtResults: CbtResultsConnection },
  {
    page?: number | null;
    perPage?: number | null;
    filter?: CbtResultsFilter | null;
  }
> = gql`
  query CbtResults($page: Int, $perPage: Int, $filter: CbtResultFilterInput) {
    cbtResults(page: $page, perPage: $perPage, filter: $filter) {
      items {
        ${RESULT_FIELDS}
      }
      total
    }
  }
`;

export interface CbtPackageStatsData {
  packageId: string;
  completed: number;
  passedCount: number;
  passRate: number;
  avgTotal: number | null;
  avgTwk: number | null;
  avgTiu: number | null;
  avgTkp: number | null;
  maxTotal: number | null;
  minTotal: number | null;
}

export const CBT_PACKAGE_STATS_QUERY: TypedDocumentNode<
  { cbtPackageStats: CbtPackageStatsData },
  { packageId: string }
> = gql`
  query CbtPackageStats($packageId: ID!) {
    cbtPackageStats(packageId: $packageId) {
      packageId
      completed
      passedCount
      passRate
      avgTotal
      avgTwk
      avgTiu
      avgTkp
      maxTotal
      minTotal
    }
  }
`;
