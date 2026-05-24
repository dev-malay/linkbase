'use client';

import React from 'react';
import { useAttribution } from '@/hooks/useAttribution';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Users, BarChart3 } from 'lucide-react';

interface AttributionDashboardProps {
  profileId: string;
}

export function AttributionDashboard({ profileId }: AttributionDashboardProps) {
  const { revenue, cohortRevenue, forecast, ltv, isLoading } = useAttribution(profileId);

  if (isLoading) return <div>Loading attribution data...</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <DollarSign className="w-8 h-8 text-green-600" />
          Link Performance Attribution
        </h1>
        <p className="text-gray-600">Track revenue by link and understand what drives sales</p>
      </div>

      {/* Key Metrics */}
      {ltv && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-green-50 border-green-200">
            <p className="text-sm text-gray-600 mb-1">Total Customers</p>
            <p className="text-3xl font-bold text-green-600">{ltv.totalCustomers}</p>
          </Card>
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Avg LTV</p>
            <p className="text-3xl font-bold text-blue-600">${ltv.avgLTV.toFixed(0)}</p>
          </Card>
          <Card className="p-4 bg-purple-50 border-purple-200">
            <p className="text-sm text-gray-600 mb-1">Total LTV</p>
            <p className="text-3xl font-bold text-purple-600">${ltv.totalLTV.toFixed(0)}</p>
          </Card>
          <Card className="p-4 bg-orange-50 border-orange-200">
            <p className="text-sm text-gray-600 mb-1">Churn Rate</p>
            <p className="text-3xl font-bold text-orange-600">{ltv.churnRate}</p>
          </Card>
        </div>
      )}

      {/* Revenue by Link */}
      {revenue && revenue.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Revenue by Link
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold">Link</th>
                  <th className="text-left py-2 px-2 font-semibold">Clicks</th>
                  <th className="text-left py-2 px-2 font-semibold">Revenue</th>
                  <th className="text-left py-2 px-2 font-semibold">Conv. Rate</th>
                  <th className="text-left py-2 px-2 font-semibold">CPCR</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((link: any, idx: number) => (
                  <tr key={link.linkId} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium">
                      {link.title}
                      {idx === 0 && (
                        <Badge className="ml-2 bg-green-600">Top Performer</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2">{link.clicks}</td>
                    <td className="py-2 px-2 font-semibold text-green-600">
                      ${link.totalRevenue.toFixed(2)}
                    </td>
                    <td className="py-2 px-2">{link.conversionRate}</td>
                    <td className="py-2 px-2 text-blue-600">${link.cpcr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Forecast */}
      {forecast && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Revenue Forecast
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Next 7 Days</p>
              <p className="text-3xl font-bold text-green-600">
                ${forecast.projectedRevenue}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Projected Clicks</p>
              <p className="text-3xl font-bold">{forecast.projectedClicks}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Confidence</p>
              <p className="text-3xl font-bold text-blue-600">
                {(forecast.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}