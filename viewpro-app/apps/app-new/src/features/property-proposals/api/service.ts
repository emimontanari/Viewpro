import { bffRequest, hasErrorCode } from '@/lib/bff-client';
import type {
  CreatePropertyProposalPayload,
  RejectPropertyProposalPayload,
  ReviewerPropertyProposalDetail,
  ReviewerPropertyProposalFilters,
  ReviewerPropertyProposalsPage,
  ReviewPropertyProposalPayload,
  SellerPropertyProposalDetail,
  SellerPropertyProposalFilters,
  SellerPropertyProposalsPage,
  SubmitPropertyProposalPayload,
  UpdatePropertyProposalPayload
} from './types';

const TIMEOUT_MS = 10_000;
const PATH = '/api/property-proposals';

export function listSellerPropertyProposals(filters: SellerPropertyProposalFilters = {}, init?: RequestInit) {
  return request<SellerPropertyProposalsPage>(query(PATH, { page: filters.page, pageSize: filters.pageSize }), init);
}

export function getSellerPropertyProposal(proposalId: string, init?: RequestInit) {
  return request<SellerPropertyProposalDetail>(`${PATH}/${encodeURIComponent(proposalId)}`, init);
}

export function createSellerPropertyProposal(payload: CreatePropertyProposalPayload, init?: RequestInit) {
  return requestJson<SellerPropertyProposalDetail>(PATH, 'POST', payload, init);
}

export function updateSellerPropertyProposal(proposalId: string, payload: UpdatePropertyProposalPayload, init?: RequestInit) {
  return requestJson<SellerPropertyProposalDetail>(`${PATH}/${encodeURIComponent(proposalId)}`, 'PATCH', payload, init);
}

export function submitSellerPropertyProposal(proposalId: string, payload: SubmitPropertyProposalPayload, init?: RequestInit) {
  return requestJson<SellerPropertyProposalDetail>(`${PATH}/${encodeURIComponent(proposalId)}/submit`, 'POST', payload, init);
}

export function listReviewerPropertyProposals(filters: ReviewerPropertyProposalFilters = {}, init?: RequestInit) {
  return request<ReviewerPropertyProposalsPage>(query(`${PATH}/review`, {
    state: filters.state, history: filters.history, page: filters.page, pageSize: filters.pageSize
  }), init);
}

export function getReviewerPropertyProposal(proposalId: string, init?: RequestInit) {
  return request<ReviewerPropertyProposalDetail>(`${PATH}/review/${encodeURIComponent(proposalId)}`, init);
}

export function rejectReviewerPropertyProposal(proposalId: string, payload: RejectPropertyProposalPayload, init?: RequestInit) {
  return requestJson<ReviewerPropertyProposalDetail>(`${PATH}/review/${encodeURIComponent(proposalId)}/reject`, 'POST', payload, init);
}

export function approveReviewerPropertyProposal(proposalId: string, payload: ReviewPropertyProposalPayload, init?: RequestInit) {
  return requestJson<ReviewerPropertyProposalDetail>(`${PATH}/review/${encodeURIComponent(proposalId)}/approve`, 'POST', payload, init);
}

export function propertyProposalErrorCopy(error: unknown, fallback: string): string {
  if (hasErrorCode(error, 'PROPERTY_PROPOSAL_NOT_FOUND')) return 'No encontramos la propuesta.';
  if (hasErrorCode(error, 'PROPERTY_PROPOSAL_STATE_CONFLICT')) return 'La propuesta cambió. Actualizá e intentá nuevamente.';
  if (hasErrorCode(error, 'PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN')) return 'No podés revisar tu propia propuesta.';
  if (hasErrorCode(error, 'PROPERTY_PROPOSAL_SUBMISSION_INCOMPLETE')) return 'Completá los campos requeridos antes de enviar.';
  if (hasErrorCode(error, 'PROPERTY_PROPOSAL_REJECTION_REASON_INVALID')) return 'Ingresá un motivo de rechazo válido.';
  if (hasErrorCode(error, 'PROPERTY_PROPOSAL_PROPOSER_INELIGIBLE')) return 'La persona vendedora ya no cumple los requisitos.';
  if (hasErrorCode(error, 'TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED')) return 'Se alcanzó el límite de propiedades activas.';
  return fallback;
}

function request<T>(path: string, init?: RequestInit) {
  return bffRequest<T>(path, signal(init), { timeoutMs: TIMEOUT_MS });
}

function requestJson<T>(path: string, method: 'PATCH' | 'POST', body: unknown, init?: RequestInit) {
  return bffRequest<T>(path, {
    body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, method, ...signal(init)
  }, { timeoutMs: TIMEOUT_MS });
}

function signal(init?: RequestInit): Pick<RequestInit, 'signal'> {
  return init?.signal ? { signal: init.signal } : {};
}

function query(path: string, filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined) params.set(key, String(value));
  const value = params.toString();
  return value ? `${path}?${value}` : path;
}
