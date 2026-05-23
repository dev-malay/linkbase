'use client';
import React from 'react';
import { useIntelligence } from '@/hooks/useIntelligence';
import { Card } from '@/components/ui/card';
import { TrendingUp, Medal } from 'lucide-react';

interface LinkLeaderboardProps {profileId: string};

export function LinkLeaderboard({ profileId }: LinkLeaderboardProps) {
  const { leaderboard, isLoadingLearnings } = useIntelligence(profileId);

  if (isLoadingLearnings) {return <div>Loading leaderboard...</div>}

  const getMedalIcon = (position: number) => {
    switch (position) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return null;
    }
  };

  return(
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-blue-600" />
        Link Performance Leaderboard
      </h2>

      <div className="space-y-2">
        {leaderboard && leaderboard.length > 0 ? (
          leaderboard.map((link: any, idx: number) => (
            <div
              key={link.id}
              className={`p-4 rounded-lg border transition ${
                idx === 0
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-2xl font-bold w-12 text-center">
                    {getMedalIcon(idx) || `#${idx + 1}`}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{link.title}</p>
                    <p className="text-sm text-gray-600">
                      Position {link.position}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 text-right">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Clicks</p>
                    <p className="text-2xl font-bold text-blue-600">{link.clicks}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">CTR</p>
                    <p className="text-2xl font-bold text-green-600">{link.ctr}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Revenue</p>
                    <p className="text-2xl font-bold text-purple-600">
                      ${link.revenue.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-600">
            No data yet. Keep collecting clicks!
          </div>
        )}
      </div>
    </Card>
  )
  
}