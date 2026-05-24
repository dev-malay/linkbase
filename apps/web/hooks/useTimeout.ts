'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useTimeout(linkId: string) {
  const queryClient = useQueryClient();

  // get timeout config
  const timeoutQuery = useQuery({
    queryKey: ['timeout', linkId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/timeout/link/${linkId}`);
      return response.data;
    },
  });

  // Get visitor count
  const visitorCountQuery = useQuery({
    queryKey: ['visitor-count', linkId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/timeout/link/${linkId}/visitor-count`);
      return response.data;
    },
    refetchInterval: 10000,       // Refresh every 10 seconds
  });

     // Create/update timeout
  const createTimeoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(`/api/timeout/link/${linkId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeout', linkId] });
    },
  });

  // Configure time-based
  const configureTimeBasedMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(
        `/api/timeout/link/${linkId}/time-based`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeout', linkId] });
    },
  });

  // Configure visitor limit
  const configureVisitorLimitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(
        `/api/timeout/link/${linkId}/visitor-limit`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeout', linkId] });
    },
  });

  return {
    timeout: timeoutQuery.data,
    visitorCount: visitorCountQuery.data,
    isLoading: timeoutQuery.isLoading,
    createTimeout: createTimeoutMutation.mutate,
    configureTimeBased: configureTimeBasedMutation.mutate,
    configureVisitorLimit: configureVisitorLimitMutation.mutate,
  }
  
}