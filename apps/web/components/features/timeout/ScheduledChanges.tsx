'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trash2 } from 'lucide-react';

interface ScheduledChangesProps {
  profileId: string;
}

export function ScheduledChanges({ profileId }: ScheduledChangesProps) {
  const queryClient = useQueryClient();

  // Get scheduled changes
  const { data: changes = [], isLoading } = useQuery({
    queryKey: ['scheduled-changes', profileId],
    queryFn: async () => {
      const response = await apiClient.get(
        `/api/timeout/profile/${profileId}/scheduled-changes`
      );
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Cancel change mutation
  const cancelMutation = useMutation({
    mutationFn: async (changeId: string) => {
      await apiClient.delete(`/api/timeout/scheduled/${changeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-changes', profileId] });
    },
  });

  if (isLoading) return <div>Loading scheduled changes...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Scheduled Changes
      </h2>

      {changes.length === 0 ? (
        <Card className="p-6 text-center text-gray-600">
          <p>No scheduled changes. Create one to automate link updates.</p>
        </Card>
      ) : (
        changes.map((change: any) => (
          <Card key={change.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold mb-1">{change.action.toUpperCase()}</div>
                <p className="text-sm text-gray-600">
                  Scheduled for:{' '}
                  <span className="font-medium">
                    {new Date(change.scheduledFor).toLocaleString()}
                  </span>
                </p>
                <Badge className="mt-2">
                  {change.status === 'pending' ? 'Pending' : 'Executed'}
                </Badge>
              </div>
              {change.status === 'pending' && (
                <Button
                  onClick={() => cancelMutation.mutate(change.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}