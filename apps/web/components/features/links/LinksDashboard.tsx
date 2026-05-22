'use client';

import React, { useState } from 'react';
import { useLinks } from '@/hooks/useLinks';
import { LinkSwapModal } from './LinkSwapModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Zap, Eye, Trash2, Clock, RotateCcw } from 'lucide-react';

interface LinksDashboardProps {
  profileId: string;
}

export function LinksDashboard({ profileId }: LinksDashboardProps) {
  const [selectedLink, setSelectedLink] = useState<any>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const { links, isLoading, swapLink, undoSwap, swapHistory } = useLinks(profileId);

  const featuredLink = links.find((l) => l.position === 1);

  if (isLoading) return <div>Loading links...</div>;

  return (
    <div className="space-y-6">
      {featuredLink && (
        <Card className="p-6 border-2 border-blue-300 bg-blue-50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Featured Now</p>
              <h3 className="text-2xl font-bold text-gray-900">{featuredLink.title}</h3>
            </div>
            <div className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
              Live
            </div>
          </div>


          <p className="text-sm text-gray-600 mb-4 truncate">{featuredLink.url}</p>

          <div className="flex items-center justify-between pt-4 border-t border-blue-200">
            <div className="flex gap-4">
              <div>
                <p className="text-2xl font-bold text-blue-600">{featuredLink.clickCount}</p>
                <p className="text-xs text-gray-600">Total clicks</p>
              </div>
              <div>

                <p className="text-2xl font-bold text-green-600">4.2%</p>
                <p className="text-xs text-gray-600">CTR</p>
              </div>
            </div>

            {swapHistory.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => undoSwap()}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Undo
              </Button>
            )}
          </div>
        </Card>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4">Your Links</h3>
        <div className="grid gap-3">
          {links.map((link) => (
            <Card key={link.id} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{link.title}</p>
                  <p className="text-sm text-gray-600 truncate">{link.url}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {link.clickCount} clicks • Position {link.position}
                  </p>
                </div>

                {link.position !== 1 && (
                  <Button
                    size="sm"
                    className="gap-2 bg-blue-600 hover:bg-blue-700 ml-2"
                    onClick={() =>{
                      setSelectedLink(link);
                      setShowSwapModal(true);
                    }}
                  >
                    <Zap className="w-4 h-4" />
                    Swap

                  </Button>
                )}
              </div>

            </Card>
          ))}
        </div>
      </div>

      <LinkSwapModal
        isOpen={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        profileId={profileId}
        linkToSwap={selectedLink}
      />
    </div>
  );
}