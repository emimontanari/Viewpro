import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

const DASHBOARD_SUMMARY_PATH = '/analytics/dashboard-summary';
const DASHBOARD_SUMMARY_RANGES = new Set(['7d', '14d', '30d']);

export async function GET(request: NextRequest) {
  try {
    const response = await bffFetch(
      `${DASHBOARD_SUMMARY_PATH}${buildDashboardSummaryQuery(request)}`
    );
    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo cargar el resumen operativo.');
  }
}

function buildDashboardSummaryQuery(request: NextRequest) {
  const backendParams = new URLSearchParams();
  appendSearchParam(
    backendParams,
    'range',
    normalizeDashboardRange(request.nextUrl.searchParams.get('range'))
  );

  const query = backendParams.toString();
  return query ? `?${query}` : '';
}

function appendSearchParam(searchParams: URLSearchParams, key: string, value: string | null) {
  if (!value) {
    return;
  }

  searchParams.set(key, value);
}

function normalizeDashboardRange(range: string | null) {
  return range && DASHBOARD_SUMMARY_RANGES.has(range) ? range : null;
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'El resumen operativo tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
