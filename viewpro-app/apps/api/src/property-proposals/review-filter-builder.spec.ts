import { describe, expect, it } from 'vitest'
import {
  buildReviewerSqlPredicate,
  buildReviewerWhere,
  normalizeReviewerRead,
} from './review-filter-builder'

function sqlText(query: { strings: readonly string[] }) {
  return query.strings.join('?').replace(/\s+/g, ' ').trim()
}

const maxSafePageAtFifty = Math.floor(Number.MAX_SAFE_INTEGER / 50) + 1

const historyCases = [
  [
    'NONE',
    {
      tenantId: 'tenant-1', state: 'RECHAZADA',
      reviewRounds: { none: { tenantId: 'tenant-1' } },
    },
    'AND NOT EXISTS ( SELECT 1 FROM "property_proposal_review_rounds" r WHERE r."proposalId" = p.id AND r."tenantId" = p."tenantId" )',
    [],
  ],
  [
    'PENDING',
    {
      tenantId: 'tenant-1', state: 'RECHAZADA',
      reviewRounds: { some: { tenantId: 'tenant-1', decision: { is: null } } },
    },
    'AND EXISTS ( SELECT 1 FROM "property_proposal_review_rounds" r WHERE r."proposalId" = p.id AND r."tenantId" = p."tenantId" AND NOT EXISTS ( SELECT 1 FROM "property_proposal_review_decisions" d WHERE d."reviewRoundId" = r.id AND d."tenantId" = p."tenantId" ) )',
    [],
  ],
  [
    'REJECTED',
    {
      tenantId: 'tenant-1', state: 'RECHAZADA',
      reviewRounds: {
        some: {
          tenantId: 'tenant-1',
          decision: { is: { tenantId: 'tenant-1', outcome: 'REJECTED' } },
        },
      },
    },
    'AND EXISTS ( SELECT 1 FROM "property_proposal_review_rounds" r WHERE r."proposalId" = p.id AND r."tenantId" = p."tenantId" AND EXISTS ( SELECT 1 FROM "property_proposal_review_decisions" d WHERE d."reviewRoundId" = r.id AND d."tenantId" = p."tenantId" AND d.outcome = ?::"PropertyProposalReviewOutcome" ) )',
    ['REJECTED'],
  ],
  [
    'APPROVED',
    {
      tenantId: 'tenant-1', state: 'RECHAZADA',
      reviewRounds: {
        some: {
          tenantId: 'tenant-1',
          decision: { is: { tenantId: 'tenant-1', outcome: 'APPROVED' } },
        },
      },
    },
    'AND EXISTS ( SELECT 1 FROM "property_proposal_review_rounds" r WHERE r."proposalId" = p.id AND r."tenantId" = p."tenantId" AND EXISTS ( SELECT 1 FROM "property_proposal_review_decisions" d WHERE d."reviewRoundId" = r.id AND d."tenantId" = p."tenantId" AND d.outcome = ?::"PropertyProposalReviewOutcome" ) )',
    ['APPROVED'],
  ],
] as const

describe('review-filter-builder', () => {
  it.each([
    [{}, 1, 20, 0],
    [{ page: -1, pageSize: 20 }, 1, 20, 0],
    [{ page: 0, pageSize: 20 }, 1, 20, 0],
    [{ page: 1.5, pageSize: 20.5 }, 1, 20, 0],
    [{ page: Number.NaN, pageSize: Number.NaN }, 1, 20, 0],
    [{ page: Infinity, pageSize: Infinity }, 1, 20, 0],
    [{ page: Number.MAX_SAFE_INTEGER + 1, pageSize: Number.MAX_SAFE_INTEGER + 1 }, 1, 20, 0],
    [{ page: 2, pageSize: 51 }, 2, 20, 20],
    [{ page: maxSafePageAtFifty, pageSize: 50 }, maxSafePageAtFifty, 50, 9_007_199_254_740_950],
    [{ page: maxSafePageAtFifty + 1, pageSize: 50 }, 1, 50, 0],
  ] as const)('normalizes page=%o pageSize=%o to safe page/pageSize/skip', (input, page, pageSize, skip) => {
    expect(normalizeReviewerRead(input)).toEqual({
      state: 'EN_REVISION', history: undefined, page, pageSize, skip,
    })
  })

  it.each(historyCases)('builds the exact %s Prisma count/list predicate', (history, expectedWhere) => {
    expect(buildReviewerWhere('tenant-1', {
      state: 'RECHAZADA', history: history as never,
    })).toEqual(expectedWhere)
  })

  it.each(historyCases)('builds the exact tenant-correlated %s raw SQL predicate', (history, _where, expectedSql, values) => {
    const predicate = buildReviewerSqlPredicate({
      state: 'RECHAZADA', history: history as never,
    })

    expect(sqlText(predicate)).toBe(
      `AND p.state = ?::"PropertyProposalStatus" ${expectedSql}`,
    )
    expect(predicate.values).toEqual(['RECHAZADA', ...values])
  })
})
