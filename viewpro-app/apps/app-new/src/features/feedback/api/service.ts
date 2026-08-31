import { bffRequest, getLatestApplicationRequestId } from '@/lib/bff-client';
import type { SubmitFeedbackInput, SubmitFeedbackResponse } from './types';

const FEEDBACK_BFF_PATH = '/api/feedback';

export function submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResponse> {
  const requestId = getLatestApplicationRequestId();
  const body = {
    ...input,
    pathname: window.location.pathname,
    ...(requestId ? { requestId } : {})
  };

  return bffRequest<SubmitFeedbackResponse>(FEEDBACK_BFF_PATH, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });
}
