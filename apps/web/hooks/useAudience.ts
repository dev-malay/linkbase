'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useAudience(profileId: string) {
  const queryClient = useQueryClient();

  // Get personalization rules
  const rulesQuery = useQuery({
    queryKey: ['personalization-rules', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/audience/profile/${profileId}/rules`);
      return response.data;
    },
  });

  // Get cohorts
  const cohortsQuery = useQuery({
    queryKey: ['cohorts', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/audience/profile/${profileId}/cohorts`);
      return response.data;
    },
  });

  // Get audience insights
  const insightsQuery = useQuery({
    queryKey: ['audience-insights', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/audience/profile/${profileId}/insights`);
      return response.data;
    },
  });

  // Get personalization impact
  const impactQuery = useQuery({
    queryKey: ['personalization-impact', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/audience/profile/${profileId}/impact`);
      return response.data;
    },
  });

  // Create rule
  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(`/api/audience/profile/${profileId}/rules`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization-rules', profileId] });
    },
  });

  // Toggle personalization
  const toggleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/audience/profile/${profileId}/toggle`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization-settings', profileId] });
    },
  });

  return {
    rules: rulesQuery.data || [],
    cohorts: cohortsQuery.data || [],
    insights: insightsQuery.data,
    impact: impactQuery.data,
    isLoading: rulesQuery.isLoading,
    createRule: createRuleMutation.mutate,
    togglePersonalization: toggleMutation.mutate,
  };
}