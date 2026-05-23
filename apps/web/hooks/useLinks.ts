'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState, useCallback } from 'react';

export interface Link {
  id: string;
  title: string;
  url: string;
  shortUrl: string;
  description?: string;
  position: number;
  clickCount: number;
  isActive: boolean;
}

export function useLinks(profileId: string) {
  const queryClient = useQueryClient();
  const [swapHistory, setSwapHistory] = useState<Array<{ linkId: string; timestamp: Date }>>([]);

  // get all links for profile
  const linksQuery = useQuery({
    queryKey: ['links', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/links/profile/${profileId}`);
      return response.data as Link[];
    },
  });

  // swap link mutation
  const swapLinkMutation = useMutation({
    mutationFn: async (variables: { linkId: string; swapWithLinkId?: string}) =>{
      const response = await apiClient.post(`/api/links/${variables.linkId}/swap`,{
        profileId,
        swapWithLinkId: variables.swapWithLinkId,
      })
      return response.data;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['links', profileId] });
      setSwapHistory((prev) => [
        { linkId: data.data.swappedTo.id, timestamp: new Date() },
        ...prev.slice(0, 4),
      ]);
    }

  })

  // the preview link before swap
  const previewLinkQuery = useQuery({
    queryKey: ['link-preview', 'temp'],
    queryFn: async(variables: {linkId: string}) => {
      const response = await apiClient.get(`/api/links/${variables.linkId}/preview`);
      return response.data;
    },
    enabled: false,
  });


  // get swap analytics
  const analyticsQuery = useQuery({
    queryKey: ['swap-analytics', 'temp'],
    queryFn: async (variables: { linkId: string}) => {
      const response = await apiClient.get(`/api/links/${variables.linkId}/swap-analytics`);
      return response.data;
    },
    enabled: false,
  })


  // Undo the swap mutation
  const undoSwapMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/links/undo-swap`, { profileId });
      return response.data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links', profileId] });
      setSwapHistory((prev) => prev.slice(1)); // Remove last swap from history
    },
  });

  // schedule swap mutation
  const scheduleSwapMutation = useMutation({
    mutationFn: async (variables: {
      linkId: string;
      scheduledFor: Date;
      swapWithLinkId?: string;
      note?: string;
    }) =>{
      const response = await apiClient.post(`/api/links/${variables.linkId}/schedule-swap`,{
        profileId,
        scheduledFor: variables.scheduledFor.toISOString(),
        swapWithLinkId: variables.swapWithLinkId,
        note: variables.note,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-swaps', profileId] });
    },
  });

  // activate backup link mutation
  const activateBackupMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const response = await apiClient.post(`/api/links/${linkId}/activate-backup`, {
        profileId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links', profileId] });
    }
  });

  return {
    links: linksQuery.data || [],
    isLoading: linksQuery.isLoading,
    isError: linksQuery.isError,
    error: linksQuery.error,

    // swap mthds
    swapLink: swapLinkMutation.mutate,
    swapLinkAsync: swapLinkMutation.mutateAsync,
    isSwapping: swapLinkMutation.isPending,

    // rpeview
    previewLink: async (linkId: string) => {
      const response = await apiClient.get(`/api/links/${linkId}/preview`);
      return response.data;
    },

    // analytics
    getSwapAnalytics: async (linkId: string) => {
      const response = await apiClient.get(`/api/links/${linkId}/swap-analytics`);
      return response.data;
    },



    undoSwap: undoSwapMutation.mutate,
    isUndoing: undoSwapMutation.isPending,
    swapHistory,
    scheduleSwap: scheduleSwapMutation.mutate,
    isScheduling: scheduleSwapMutation.isPending,


    activateBackup: activateBackupMutation.mutate,
    isActivatingBackup: activateBackupMutation.isPending,
  };
  
}