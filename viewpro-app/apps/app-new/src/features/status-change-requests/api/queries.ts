import { useMutation, useQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import {
  approveStatusChangeRequest,
  createStatusChangeRequest,
  getPendingStatusChangeRequests,
  getStatusChangeRequestsByEngagement,
  rejectStatusChangeRequest
} from './service';
import type {
  CreateStatusChangeRequestPayload,
  RejectStatusChangeRequestPayload,
  StatusChangeRequest
} from './types';

export const statusChangeRequestKeys = {
  all: ['status-change-requests'] as const,
  pendingBandeja: () => [...statusChangeRequestKeys.all, 'pending-bandeja'] as const,
  byEngagement: (engagementId: string) =>
    [...statusChangeRequestKeys.all, 'by-engagement', engagementId] as const
};

export const statusChangeRequestsByEngagementOptions = (engagementId: string) =>
  queryOptions({
    queryKey: statusChangeRequestKeys.byEngagement(engagementId),
    queryFn: () => getStatusChangeRequestsByEngagement(engagementId)
  });

export const pendingStatusChangeRequestsOptions = (params: {
  status?: 'PENDING';
  take?: number;
} = { status: 'PENDING', take: 200 }) =>
  queryOptions({
    queryKey: statusChangeRequestKeys.pendingBandeja(),
    queryFn: () => getPendingStatusChangeRequests(params)
  });

export function useStatusChangeRequestsByEngagement(engagementId: string) {
  return useQuery(statusChangeRequestsByEngagementOptions(engagementId));
}

export function usePendingStatusChangeRequests(params: { take?: number } = {}) {
  return useQuery(pendingStatusChangeRequestsOptions({ status: 'PENDING', ...params }));
}

export function useCreateStatusChangeRequest(engagementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateStatusChangeRequestPayload) =>
      createStatusChangeRequest(engagementId, payload),

    onMutate: async (payload) => {
      const queryKey = statusChangeRequestKeys.byEngagement(engagementId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<StatusChangeRequest[]>(queryKey);

      // Optimistically prepend a placeholder
      const optimistic: StatusChangeRequest = {
        id: `optimistic-${Date.now()}`,
        tenantId: '',
        propertyEngagementId: engagementId,
        requestedByUserId: '',
        targetStatus: payload.targetStatus,
        currentStatusSnapshot: payload.currentStatusSnapshot,
        requestNote: payload.requestNote ?? null,
        status: 'PENDING',
        resolvedByUserId: null,
        resolvedAt: null,
        resolutionComment: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      queryClient.setQueryData<StatusChangeRequest[]>(queryKey, (old = []) => [
        optimistic,
        ...old
      ]);

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          statusChangeRequestKeys.byEngagement(engagementId),
          context.previous
        );
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: statusChangeRequestKeys.byEngagement(engagementId)
      });
    }
  });
}

export function useApproveStatusChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId }: { requestId: string; engagementId: string }) =>
      approveStatusChangeRequest(requestId),

    onMutate: async ({ requestId, engagementId }) => {
      const bandejaKey = statusChangeRequestKeys.pendingBandeja();
      const engagementKey = statusChangeRequestKeys.byEngagement(engagementId);

      await queryClient.cancelQueries({ queryKey: bandejaKey });
      await queryClient.cancelQueries({ queryKey: engagementKey });

      const previousBandeja = queryClient.getQueryData<StatusChangeRequest[]>(bandejaKey);
      const previousEngagement = queryClient.getQueryData<StatusChangeRequest[]>(engagementKey);

      // Optimistically mark as RESOLVED in both lists
      const markResolved = (list: StatusChangeRequest[] = []) =>
        list.map((r) =>
          r.id === requestId ? { ...r, status: 'RESOLVED' as const } : r
        );

      queryClient.setQueryData<StatusChangeRequest[]>(bandejaKey, markResolved);
      queryClient.setQueryData<StatusChangeRequest[]>(engagementKey, markResolved);

      return { previousBandeja, previousEngagement };
    },

    onError: (_err, { engagementId }, context) => {
      if (context?.previousBandeja !== undefined) {
        queryClient.setQueryData(statusChangeRequestKeys.pendingBandeja(), context.previousBandeja);
      }
      if (context?.previousEngagement !== undefined) {
        queryClient.setQueryData(
          statusChangeRequestKeys.byEngagement(engagementId),
          context.previousEngagement
        );
      }
    },

    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: statusChangeRequestKeys.pendingBandeja() });
      queryClient.invalidateQueries({
        queryKey: statusChangeRequestKeys.byEngagement(engagementId)
      });
    }
  });
}

export function useRejectStatusChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      payload
    }: {
      requestId: string;
      engagementId: string;
      payload: RejectStatusChangeRequestPayload;
    }) => rejectStatusChangeRequest(requestId, payload),

    onMutate: async ({ requestId, engagementId }) => {
      const bandejaKey = statusChangeRequestKeys.pendingBandeja();
      const engagementKey = statusChangeRequestKeys.byEngagement(engagementId);

      await queryClient.cancelQueries({ queryKey: bandejaKey });
      await queryClient.cancelQueries({ queryKey: engagementKey });

      const previousBandeja = queryClient.getQueryData<StatusChangeRequest[]>(bandejaKey);
      const previousEngagement = queryClient.getQueryData<StatusChangeRequest[]>(engagementKey);

      const markResolved = (list: StatusChangeRequest[] = []) =>
        list.map((r) =>
          r.id === requestId ? { ...r, status: 'RESOLVED' as const } : r
        );

      queryClient.setQueryData<StatusChangeRequest[]>(bandejaKey, markResolved);
      queryClient.setQueryData<StatusChangeRequest[]>(engagementKey, markResolved);

      return { previousBandeja, previousEngagement };
    },

    onError: (_err, { engagementId }, context) => {
      if (context?.previousBandeja !== undefined) {
        queryClient.setQueryData(statusChangeRequestKeys.pendingBandeja(), context.previousBandeja);
      }
      if (context?.previousEngagement !== undefined) {
        queryClient.setQueryData(
          statusChangeRequestKeys.byEngagement(engagementId),
          context.previousEngagement
        );
      }
    },

    onSuccess: (_data, { engagementId }) => {
      // Invalidate both the bandeja and the per-engagement list after rejection
      queryClient.invalidateQueries({ queryKey: statusChangeRequestKeys.pendingBandeja() });
      queryClient.invalidateQueries({
        queryKey: statusChangeRequestKeys.byEngagement(engagementId)
      });
    }
  });
}
