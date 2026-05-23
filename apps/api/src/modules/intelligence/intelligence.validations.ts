import {z} from 'zod'


export class IntelligenceValidations {
  static updateSettings = z.object({
    body: z.object({
      isAutoOptimizeEnabled: z.boolean().optional(),
      optimizationFrequency: z.enum(['hourly', 'daily', 'weekly']).optional(),
      confidenceThreshold: z.number().int().min(0).max(10000).optional(),
      requiresApproval: z.boolean().optional(),
      seasonalAdjustmentEnabled: z.boolean().optional(),
    }),
  });

  static rejectSuggestion = z.object({
    body: z.object({
      reason: z.string().min(1).max(500).optional(),
    }),
  });

  static compareRankings = z.object({
    body: z.object({
      rankingId1: z.string().uuid(),
      rankingId2: z.string().uuid(),
    }),
  });

  static startABTest = z.object({
    body: z.object({
      variantRanking: z.array(z.string().uuid()).min(1),
      splitPercentage: z.number().int().min(10).max(90).optional(),
      minSampleSize: z.number().int().min(100).optional(),
    }),
  });

  static predictRanking = z.object({
    query: z.object({
      season: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).optional(),
      timeframe: z.enum(['past-week', 'past-month', 'past-quarter']).optional(),
    }),
  });

  static setRule = z.object({
    body: z.object({
      type: z.enum(['never_below', 'always_above']),
      linkId: z.string().uuid(),
      targetLinkId: z.string().uuid(),
      reason: z.string().optional(),
    }),
  });
}