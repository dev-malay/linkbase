'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, Zap, Eye, Clock, AlertCircle } from 'lucide-react';
import { useLinks } from '@/hooks/useLinks';

interface LinkSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  linkToSwap: { id: string; title: string; url: string } | null;
}

export function LinkSwapModal({
  isOpen,
  onClose,
  profileId,
  linkToSwap,
}: LinkSwapModalProps) {
  const [step, setStep] = useState<'confirm' | 'preview' | 'analytics'>('confirm');
  const [previewData, setPreviewData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  const { swapLink, isSwapping, getSwapAnalytics, links } = useLinks(profileId);

  const currentFeatured = links.find((l) => l.position === 1);

  const handlePreview = async () => {
    // iun real app fetch preview data
    setPreviewData({
      domain: new URL(linkToSwap?.url || '').hostname,
      isValid: true,
    });

    setStep('preview');
  }

  const handleSwap = async() => {
    swapLink(
      { linkId: linkToSwap?.id || '', swapWithLinkId: undefined},
      {
        onSuccess: async () => {
          const analytics = await getSwapAnalytics(linkToSwap?.id || '');
          setAnalyticsData(analytics);
          setStep('analytics');
        },
      }
    );

  }

  const handleClose = () => {
    setStep('confirm');
    setPreviewData(null);
    setAnalyticsData(null);
    onClose();
  }

  if (!linkToSwap || !currentFeatured) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            Swap Link
          </DialogTitle>
          <DialogDescription>
            Instantly swap your featured link
          </DialogDescription>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Currently Featured</p>
              <p className="font-semibold text-gray-900">{currentFeatured.title}</p>
              <p className="text-sm text-gray-600 mt-1 truncate">{currentFeatured.url}</p>
              <p className="text-xs text-gray-500 mt-2">
                {currentFeatured.clickCount} clicks today
              </p>
            </div>

            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-600 mb-2 uppercase">Swap To</p>
              <p className="font-semibold text-gray-900">{linkToSwap.title}</p>
              <p className="text-sm text-gray-600 mt-1 truncate">{linkToSwap.url}</p>
            </div>

 
            <div className="flex gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                This change goes live immediately to all your visitors
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} disabled={isSwapping}>
                Cancel
              </Button>
              <Button variant="default" onClick={handlePreview} disabled={isSwapping}>
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button variant="default" onClick={handleSwap} disabled={isSwapping} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Zap className="w-4 h-4 mr-2" />
                {isSwapping ? 'Swapping...' : 'Swap Now'}
              </Button>
            </div>
          </div>
        )}


        {step === 'preview' && previewData && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Preview</p>
              <div className="space-y-2">
                <p className="text-sm"><span className="font-medium">Domain:</span> {previewData.domain}</p>
                <p className="text-sm"><span className="font-medium">Status:</span> <span className="text-green-600">✓ Live</span></p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('confirm')}>
                Back
              </Button>
              <Button variant="default" onClick={handleSwap} disabled={isSwapping} className="flex-1 bg-blue-600">
                Confirm & Swap
              </Button>
            </div>
          </div>
        )}

        {step === 'analytics' && analyticsData && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-900 mb-3">✓ Swap Complete!</p>
              
              <div className="space-y-3">
                 <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Current Link Performance</p>
                  <p className="text-2xl font-bold text-green-600">{analyticsData.current.clicksLastHour}</p>
                  <p className="text-xs text-gray-600">clicks in last hour</p>
                </div>

                {analyticsData.previous && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">vs Previous Link</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {analyticsData.previous.clicksLastHour} clicks
                      <span className={`ml-2 text-sm ${analyticsData.improvement?.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                            {analyticsData.improvement}
                      </span>
                    </p>
                  </div>
                )}
              </div>

            </div>

            <Button onClick={handleClose} className="w-full bg-blue-600">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

  )

}