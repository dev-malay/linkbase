'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Preset {
  id: string;
  name: string;
  description?: string;
  linkIds: string[];
  isActive: boolean;
  totalActivations: number;
  totalClicks: number;
  lastActivatedAt?: Date;
}

export function usePresets(profileId: string) {
  const queryClient = useQueryClient();

  // Get all presets
  const presetsQuery = useQuery({
    queryKey: ['presets', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/presets/profile/${profileId}`);
      return response.data as Preset[];
    },
  });

  // Get active preset
  const activePresetQuery = useQuery({
    queryKey: ['active-preset', profileId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/presets/profile/${profileId}/active`);
      return response.data as Preset | null;
    },
  });

  // Create 
  const createPresetMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      linkIds: string[];
    }) => {
      const response = await apiClient.post('/api/presets', {
        profileId,
        ...data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets', profileId] });
    },
  });

  // Activate 
  const activatePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const response = await apiClient.post(`/api/presets/${presetId}/activate`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets', profileId] });
      queryClient.invalidateQueries({ queryKey: ['active-preset', profileId] });
    },
  });

  // Cloner
  const clonePresetMutation = useMutation({
    mutationFn: async (variables: {
      presetId: string;
      newName: string;
    }) => {
      const response = await apiClient.post(
        `/api/presets/${variables.presetId}/clone`,
        { newName: variables.newName }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets', profileId] });
    },
  });

  // Delete 
  const deletePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      await apiClient.delete(`/api/presets/${presetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets', profileId] });
    },
  });

  // Get preset analytics
  const getPresetAnalytics = async (presetId: string) =>{
    const response = await apiClient.get(`/api/presets/${presetId}/analytics`);
    return response.data;
  }

  // Schedule preset activation
  const scheduleActivationMutation = useMutation({
    mutationFn: async (variables: {
      presetId: string;
      scheduledFor: Date;
      note?: string;
    }) => {
      const response = await apiClient.post(
        `/api/presets/${variables.presetId}/schedule-activation`,
        {
          scheduledFor: variables.scheduledFor.toISOString(),
          note: variables.note,
        }
      );
      return response.data;
    },
    onSuccess:() => {
      queryClient.invalidateQueries({ queryKey: ['presets', profileId] });
    },
  });

  return {
    presets: presetsQuery.data || [],
    activePreset: activePresetQuery.data,
    isLoading: presetsQuery.isLoading || activePresetQuery.isLoading,
    isError: presetsQuery.isError || activePresetQuery.isError,

    // mutations
    createPreset: createPresetMutation.mutate,
    isCreating: createPresetMutation.isPending,

    activatePreset: activatePresetMutation.mutate,
    isActivating: activatePresetMutation.isPending,

    clonePreset: clonePresetMutation.mutate,
    isCloning: clonePresetMutation.isPending,

    deletePreset: deletePresetMutation.mutate,
    isDeleting: deletePresetMutation.isPending,

    scheduleActivation: scheduleActivationMutation.mutate,
    isScheduling: scheduleActivationMutation.isPending,

    // Queries
    getPresetAnalytics,
  };
}