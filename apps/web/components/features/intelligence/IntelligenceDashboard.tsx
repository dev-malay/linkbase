'use client';

import React, { useState } from 'react';
import { useIntelligence } from '@/hooks/useIntelligence';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, TrendingUp, Zap, Brain, BarChart3 } from 'lucide-react';


interface IntelligenceDashboardProps {
  profileId: string}

export function IntelligenceDashboard({ profileId }: IntelligenceDashboardProps) {
  const {
    settings,
    patterns,
    learnings,
    suggestions,
    leaderboard,
    isLoadingLearnings,
    approveSuggestion,
    toggleAutoOptimize,
  } =useIntelligence(profileId);

  if(isLoadingLearnings){
    return <div className="text-center py-8">Loading intelligence data...</div>}

  return(
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Brain className="w-8 h-8 text-blue-600" />
            Link Intelligence
          </h1>
          <p className="text-gray-600">
            AI-powered insights and automatic link optimization

          </p>
        </div>

        {settings && (
          <Button
            onClick={() => toggleAutoOptimize()}
            className={`gap-2 ${
              settings.isAutoOptimizeEnabled ? 'bg-green-600' : 'bg-gray-400'
            }`}
          >
           <Zap className="w-4 h-4" />
            {settings.isAutoOptimizeEnabled ? 'Auto-Optimize ON' : 'Auto-Optimize OFF'}
          </Button>

        )}
      </div>

      {/* Top insights */}
      {learnings && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Key Insights
          </h2>
          <div className="grid gap-3">
            {learnings.topInsights && learnings.topInsights.length > 0 ? (
              learnings.topInsights.map((insight: any, idx: number) => (
                <div key={idx} className="p-3 bg-white rounded-lg border border-blue-100">
                  <p className="font-medium text-gray-900">{insight.insight}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {insight.type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {insight.confidence} confidence
                    </Badge>
                    <span className="text-xs text-gray-500 ml-auto">
                      {insight.sampleSize} clicks
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-600">No insights yet. Collecting data..</p>
            )}
          </div>
        </Card>
      )}

      {/* Pending Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <Card className="p-6 border-amber-200 bg-amber-50">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-600" />
            Optimization Suggestions ({suggestions.length})
          </h2>
          <div className="space-y-4">
            {suggestions.map((suggestion: any) => (
              <div
                key={suggestion.id}
                className="p-4 bg-white rounded-lg border border-amber-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {suggestion.reason}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Projected gain: +{suggestion.projectedClickGain} clicks
                      {suggestion.projectedRevenueGain > 0 && (
                        <span> • ${(Number(suggestion.projectedRevenueGain) / 100).toFixed(2)}</span>
                      )}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {(suggestion.confidence * 100).toFixed(0)}% confident
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => approveSuggestion(suggestion.id)}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Apply
                  </Button>
                  <Button size="sm" variant="outline">
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

     {/* link leaderboard  */}
      {leaderboard && leaderboard.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Link Performance (Last 7 Days)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Link
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Clicks
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    CTR
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((link: any, idx: number) => (
                  <tr key={link.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-bold text-lg text-gray-900">#{idx + 1}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {link.title}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-2xl font-bold text-blue-600">
                        {link.clicks}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-lg font-semibold text-green-600">
                        {link.ctr}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-900">
                        ${link.revenue.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* pattern detection */}
      {patterns && patterns.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Detected Patterns</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patterns.slice(0, 6).map((pattern: any) => (
              <div
                key={`${pattern.patternType}-${pattern.dimension}`}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-600 uppercase">
                      {pattern.patternType}
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {pattern.dimension}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {(pattern.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Sample size: {pattern.sampleSize} clicks
                </p>
                {pattern.topLinkId && (
                  <p className="text-sm text-gray-700 mt-2 font-medium">
                    Top link: {pattern.topLinkScore} clicks
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* settings */}
      {settings && (
        <Card className="p-6 bg-gray-50 border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">
                Optimization Frequency
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {settings.optimizationFrequency}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">
                Confidence Threshold
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {settings.confidenceThreshold} clicks
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">
                Auto-Optimize Status
              </p>
              <Badge
                className={`${
                  settings.isAutoOptimizeEnabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {settings.isAutoOptimizeEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">
                Approval Required
              </p>
              <Badge
                className={`${
                  settings.requiresApproval
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {settings.requiresApproval ? 'Manual' : 'Automatic'}
              </Badge>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}