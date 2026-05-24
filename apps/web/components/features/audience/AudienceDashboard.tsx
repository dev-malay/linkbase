'use client';
import React, { useState } from 'react';
import { useAudience } from '@/hooks/useAudience';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, MapPin, Smartphone, Target, Brain} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AudienceDashboardProps {profileId: string}

export function AudienceDashboard({ profileId }: AudienceDashboardProps) {
  const { rules, cohorts, insights, impact, isLoading, createRule, togglePersonalization } =
    useAudience(profileId);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', condition: '', links: [] });

  if (isLoading) {
    return <div className="text-center py-8">Loading audience data...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Brain className="w-8 h-8 text-blue-600" />
            Audience Prediction
          </h1>
          <p className="text-gray-600">Personalize link order per visitor cohort</p>
        </div>
        <Button onClick={() => togglePersonalization()} className="bg-blue-600">
          Enable Personalization
        </Button>
      </div>

 {/* Personalization impact */}
      {impact && (
        <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Personalization Impact
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">CTR Improvement</p>
              <p className="text-2xl font-bold text-green-600">{impact.avgCTRImprovement}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Extra Clicks</p>
              <p className="text-2xl font-bold text-green-600">+{impact.estimatedClicksGained}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Revenue Gain</p>
              <p className="text-2xl font-bold text-green-600">
                ${impact.estimatedRevenueGained.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Cohorts</p>
              <p className="text-2xl font-bold text-green-600">{impact.cohortCount}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Audience insights */}
      {insights && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Audience Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Referrers */}
            <div>
              <h3 className="font-semibold mb-3">Top Referrers</h3>
              <div className="space-y-2">
                {insights.topReferrers?.map((ref: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{ref.name}</span>
                    <Badge>{ref.visitors} visits</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Device distribution */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Devices
              </h3>
              <div className="space-y-2">
                {insights.deviceDistribution?.map((device: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{device.device}</span>
                    <Badge>{device.count} users</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Top countries */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Regions
              </h3>
              <div className="space-y-2">
                {insights.topCountries?.map((country: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{country.country}</span>
                    <Badge>{country.visitors} visits</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">
              Returning visitor rate: <span className="font-semibold">{insights.returningVisitorRate?.toFixed(1)}%</span>
            </p>
          </div>
        </Card>
      )}

      {/* Cohort Performance */}
      {cohorts && cohorts.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Cohort Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold">Cohort</th>
                  <th className="text-left py-2 px-2 font-semibold">Visitors</th>
                  <th className="text-left py-2 px-2 font-semibold">Clicks</th>
                  <th className="text-left py-2 px-2 font-semibold">CTR</th>
                  <th className="text-left py-2 px-2 font-semibold">Improvement</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort: any, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <div>
                        <p className="font-medium">{cohort.cohortName}</p>
                        <p className="text-xs text-gray-500">{cohort.cohortType}</p>
                      </div>
                    </td>
                    <td className="py-2 px-2">{cohort.totalVisitors}</td>
                    <td className="py-2 px-2 font-semibold">{cohort.totalClicks}</td>
                    <td className="py-2 px-2 text-blue-600 font-semibold">{cohort.ctr}</td>
                    <td className="py-2 px-2">
                      <Badge className={cohort.improvementPercentage > 0 ? 'bg-green-100 text-green-800' : ''}>
                        {cohort.improvementPercentage}

                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Personalization Rules */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Personalization Rules
          </h2>
          <Button onClick={() => setShowRuleForm(true)} size="sm" className="bg-blue-600">
            Add Rule
          </Button>
        </div>

        <div className="space-y-2">
          {rules.map((rule: any, idx: number) => (
            <div key={rule.id} className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {rule.conditionType}: <span className="font-semibold">{rule.conditionValue}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Applied {rule.applicationsCount} times
                  </p>
                </div>
                <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                  {rule.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )}