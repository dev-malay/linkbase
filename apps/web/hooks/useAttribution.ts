'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useAttribution(profileId: string) {
  const queryClient = useQueryClient();

  // Get revenue by link
  const revenueQuery = useQuery({
    queryKey: ['revenue', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/attribution/profile/${profileId}/revenue`);
      return response.data;
    },
  });

  // Get cohort revenue
  const cohortRevenueQuery = useQuery({
    queryKey: ['cohort-revenue', profileId],
    queryFn: async () => {
      const response = await apiClient.get(
        `/api/attribution/profile/${profileId}/cohort-revenue`
      );
      return response.data;
    },
  });

  // Get revenue forecast
  const forecastQuery = useQuery({
    queryKey: ['forecast', profileId],
    queryFn: async () => {
      const response = await apiClient.get(
        `/api/attribution/profile/${profileId}/forecast`
      );
      return response.data;
    },
  });

  // Get LTV metrics
  const ltvQuery = useQuery({
    queryKey: ['ltv-metrics', profileId],
    queryFn: async () => {
      const response = await apiClient.get(
        `/api/attribution/profile/${profileId}/ltv-metrics`
      );
      return response.data;
    },
  });

  return {
    revenue: revenueQuery.data || [],
    cohortRevenue: cohortRevenueQuery.data || [],
    forecast: forecastQuery.data,
    ltv: ltvQuery.data,
    isLoading: revenueQuery.isLoading,
  };
}