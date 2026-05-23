'use client';

import React, { useState } from 'react';
import { usePresets } from '@/hooks/usePresets';
import { useLinks } from '@/hooks/useLinks';
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Play, Copy, Trash2, BarChart3, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'



interface PresetsDashboardProps {
  profileId: string}

export function PresetsDashboard({ profileId }: PresetsDashboardProps) {
  const { presets, activePreset, activatePreset, createPreset, clonePreset, deletePreset, isActivating } = usePresets(profileId);
  const { links } = useLinks(profileId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);

  const handleCreatePreset = () => {
    if (!newPresetName || selectedLinks.length === 0) return;

    createPreset(
      {
        name: newPresetName,
        linkIds: selectedLinks,
      },
      {
        onSuccess: () => {
          setNewPresetName('');
          setSelectedLinks([]);
          setShowCreateDialog(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Active Preset Card */}
      {activePreset && (
        <Card className="p-6 border-2 border-blue-300 bg-blue-50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Active Preset</p>
              <h3 className="text-2xl font-bold text-gray-900">{activePreset.name}</h3>
            </div>
            <div className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
              {activePreset.linkIds.length} links
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {activePreset.description || 'No description'}
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-blue-200">
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-bold text-blue-600">{activePreset.totalActivations}</p>
                <p className="text-xs text-gray-600">Activations</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{activePreset.totalClicks}</p>
                <p className="text-xs text-gray-600">Total clicks</p>
              </div>
            </div>

            <Button variant="outline" size="sm" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              View Analytics
            </Button>
          </div>
        </Card>
      )}

      {/* Create Preset Button */}
      <Button onClick={() => setShowCreateDialog(true)} className="gap-2 bg-blue-600">
        <Plus className="w-4 h-4" />
        Create New Preset
      </Button>

      {/* Presets List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Your Presets</h3>
        <div className="grid gap-3">
          {presets.map((preset) => (
            <Card key={preset.id} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{preset.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {preset.linkIds.length} links •{' '}
                    {preset.totalActivations} activations •{' '}
                    {preset.totalClicks} clicks
                  </p>
                </div>

                <div className="flex gap-2 ml-4">
                  {!preset.isActive && (
                    <Button
                      size="sm"
                      className="gap-2 bg-blue-600"
                      onClick={() => activatePreset(preset.id)}
                      disabled={isActivating}
                    >
                      <Play className="w-4 h-4" />
                      Activate
                    </Button>
                  )}

                  {preset.isActive && (
                    <div className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                      Active
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => clonePreset({ presetId: preset.id, newName: `${preset.name} (Copy)` })}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deletePreset(preset.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Create Preset Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Preset</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Preset Name</label>
              <Input
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="e.g., Friday Content"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Select Links</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {links.map((link) => (
                  <div key={link.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedLinks.includes(link.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLinks([...selectedLinks, link.id]);
                        } else {
                          setSelectedLinks(selectedLinks.filter((id) => id !== link.id));
                        }
                      }}
                      id={link.id}
                    />
                    <label htmlFor={link.id} className="text-sm cursor-pointer flex-1">
                      {link.title}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleCreatePreset}
              disabled={!newPresetName || selectedLinks.length === 0}
              className="w-full bg-blue-600"
            >
              Create Preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}