'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api'

export function useIntelligence(profileId: string) {
  const queryClient = useQueryClient();

  // Get optimization settings
  const settingsQuery = useQuery({
    queryKey: ['intelligence-settings', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/intelligence/profile/${profileId}/settings`);
      return response.data
    }});

  // Get detected patterns

  const patternsQuery = useQuery({
    queryKey: ['patterns', profileId],
    queryFn: async () =>{
      const response = await apiClient.get(`/api/intelligence/profile/${profileId}/patterns`);
      return response.data},
  });

  // get learning dashboard
  const learningsQuery = useQuery({
    queryKey: ['learnings', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/intelligence/profile/${profileId}/learnings`);
      return response.data;
    },
  });

// get pending suggestions
  const suggestionsQuery = useQuery({
    queryKey: ['suggestions', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/intelligence/profile/${profileId}/suggestions`);
      return response.data;
    },
  });

  // Get link leaderboard
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/intelligence/profile/${profileId}/leaderboard`);
      return response.data;
    },
  });

  // Approve suggestion
  const approveSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const response = await apiClient.post(`/api/intelligence/${suggestionId}/approve`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', profileId] });
      queryClient.invalidateQueries({ queryKey: ['learnings', profileId] });
    },
  });

  // toggle auto optimize
  const toggleAutoOptimizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(
        `/api/intelligence/profile/${profileId}/toggle-auto-optimize`,
        {}
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-settings', profileId] });
    },
  });

  // Start ab test
  const startABTestMutation = useMutation({
    mutationFn: async (variantRanking: string[]) => {
      const response = await apiClient.post(
        `/api/intelligence/profile/${profileId}/ab-test/start`,
        { variantRanking }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learnings', profileId] });
    },
  });

  return {
    settings: settingsQuery.data,
    patterns: patternsQuery.data || [],
    learnings: learningsQuery.data,
    suggestions: suggestionsQuery.data || [],
    leaderboard: leaderboardQuery.data || [],

    isLoadingLearnings: learningsQuery.isLoading,
    approveSuggestion: approveSuggestionMutation.mutate,
    toggleAutoOptimize: toggleAutoOptimizeMutation.mutate,
    startABTest: startABTestMutation.mutate,
  };
}