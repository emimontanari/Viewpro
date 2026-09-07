import { Prisma, type PropertyProposalStatus } from '@prisma/client'

export type PropertyProposalReviewHistory = 'NONE' | 'PENDING' | 'REJECTED' | 'APPROVED'

export type PropertyProposalReviewFilters = {
  state?: PropertyProposalStatus
  history?: PropertyProposalReviewHistory
  page?: number
  pageSize?: number
}

type NormalizedReviewerRead = {
  state: PropertyProposalStatus
  history: PropertyProposalReviewHistory | undefined
  page: number
  pageSize: number
  skip: number
}

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

export function normalizeReviewerRead(input: PropertyProposalReviewFilters): NormalizedReviewerRead {
  const pageSize = isSafePositiveInteger(input.pageSize) && input.pageSize <= MAX_PAGE_SIZE
    ? input.pageSize
    : DEFAULT_PAGE_SIZE
  const page = isSafePositiveInteger(input.page)
    && input.page <= Math.floor(Number.MAX_SAFE_INTEGER / pageSize) + 1
    ? input.page
    : DEFAULT_PAGE
  return {
    state: input.state ?? 'EN_REVISION',
    history: input.history,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  }
}

export function buildReviewerWhere(
  tenantId: string,
  input: Pick<PropertyProposalReviewFilters, 'state' | 'history'>,
): Prisma.PropertyProposalWhereInput {
  const history = input.history === 'NONE'
    ? { reviewRounds: { none: { tenantId } } }
    : input.history === 'PENDING'
      ? { reviewRounds: { some: { tenantId, decision: { is: null } } } }
      : input.history === 'REJECTED' || input.history === 'APPROVED'
        ? { reviewRounds: { some: { tenantId, decision: { is: { tenantId, outcome: input.history } } } } }
        : {}
  return { tenantId, ...(input.state ? { state: input.state } : {}), ...history }
}

export function buildReviewerSqlPredicate(
  input: Pick<PropertyProposalReviewFilters, 'state' | 'history'>,
): Prisma.Sql {
  const state = input.state
    ? Prisma.sql`AND p.state = ${input.state}::"PropertyProposalStatus"`
    : Prisma.empty
  const history = input.history === 'NONE'
    ? Prisma.sql`AND NOT EXISTS (
        SELECT 1 FROM "property_proposal_review_rounds" r
        WHERE r."proposalId" = p.id AND r."tenantId" = p."tenantId"
      )`
    : input.history === 'PENDING'
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "property_proposal_review_rounds" r
          WHERE r."proposalId" = p.id AND r."tenantId" = p."tenantId"
            AND NOT EXISTS (
              SELECT 1 FROM "property_proposal_review_decisions" d
              WHERE d."reviewRoundId" = r.id AND d."tenantId" = p."tenantId"
            )
        )`
      : input.history === 'REJECTED' || input.history === 'APPROVED'
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM "property_proposal_review_rounds" r
            WHERE r."proposalId" = p.id AND r."tenantId" = p."tenantId"
              AND EXISTS (
                SELECT 1 FROM "property_proposal_review_decisions" d
                WHERE d."reviewRoundId" = r.id AND d."tenantId" = p."tenantId"
                  AND d.outcome = ${input.history}::"PropertyProposalReviewOutcome"
              )
          )`
        : Prisma.empty
  return Prisma.join([state, history], ' ')
}
