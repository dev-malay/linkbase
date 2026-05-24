'use client';
import React, { useState } from 'react';
import { useTimeout } from '@/hooks/useTimeout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, AlertCircle, Zap } from 'lucide-react'

interface TimeoutConfiguratorProps {
  linkId: string;
}

export function TimeoutConfigurator({ linkId }: TimeoutConfiguratorProps) {
  const { timeout, visitorCount, createTimeout, configureTimeBased, configureVisitorLimit } =
    useTimeout(linkId);

  const [timeoutType, setTimeoutType] = useState('time-based');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxVisitors, setMaxVisitors] = useState('');
  const [showUrgency, setShowUrgency] = useState(true)
  const handleCreateTimeoutBased = () => {
    configureTimeBased({
      expiresAt: new Date(expiresAt).toISOString(),
    });
  };

  const handleCreateVisitorLimit = () => {
    configureVisitorLimit({
      maxVisitorCount: parseInt(maxVisitors),
    });
  };

  
  return (
    <div className="space-y-6">
      {/* Current Status */}
      {timeout && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold mb-2">Current Timeout</h3>
              <p className="text-sm text-gray-600">
                Type: <span className="font-medium">{timeout.timeoutType}</span>
              </p>
              {timeout.remainingTime && (
                <p className="text-sm text-gray-600 mt-1">
                  Remaining: <span className="font-medium text-green-600">
                    {timeout.remainingTime.hoursRemaining} hours
                  </span>
                </p>
              )}
            </div>
            {timeout.isExpired && (
              <Badge className="bg-red-600">Expired</Badge>
            )}
            {!timeout.isExpired && (
              <Badge className="bg-green-600">Active</Badge>
            )}
          </div>
        </Card>
      )}

      {/* TimeBased Configuration */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Time-Based Expiration
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Set an exact date and time when this link will expire
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Expires At</label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              placeholder="Select date and time"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showUrgency}
              onChange={(e) => setShowUrgency(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show urgency badge ("2 hours remaining")</span>
          </label>
          <Button
            onClick={handleCreateTimeoutBased}
            disabled={!expiresAt}
            className="w-full bg-blue-600"
          >
            Set Time-Based Expiration
          </Button>
        </div>
      </Card>

      {/* Visitor Count Limit */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          Visitor Count Limit
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Link expires after X visitors. Great for creating scarcity.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Max Visitors</label>
            <Input
              type="number"
              value={maxVisitors}
              onChange={(e) => setMaxVisitors(e.target.value)}
              placeholder="e.g., 100"
              min="1"
            />
          </div>
          {visitorCount && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium">
                {visitorCount.currentCount} / {visitorCount.maxCount} visitors
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: visitorCount.percentage }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {visitorCount.remaining} spots remaining
              </p>
            </div>
          )}
          <Button
            onClick={handleCreateVisitorLimit}
            disabled={!maxVisitors}
            className="w-full bg-purple-600"
          >
            Set Visitor Limit
          </Button>
        </div>
      </Card>
      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm mb-1">Pro Tips</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Set urgency badges to increase conversions by 30-50%</li>
              <li>• Use 48-hour windows for flash sales</li>
              <li>• Limit to 50-100 spots for perceived scarcity</li>
              <li>• Configure fallback links to show when primary expires</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}