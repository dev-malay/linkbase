import {z} from 'zod';

export class AudienceValidations {
  static predictLinkOrder = z.object({
    body: z.object({
      sessionId: z.string().uuid(),
      referrer: z.string().optional(),
      country: z.string().length(2).optional(),
      deviceType: z.enum(['mobile', 'tablet', 'desktop']).optional(),
      browser: z.string().optional(),
      os: z.string().optional(),
      customAttributes: z.record(z.any()).optional(),
    }),
  });

  static createRule = z.object({
    body: z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      conditionType: z.enum(['referrer', 'device', 'country', 'time', 'behavior', 'custom']),
      conditionValue: z.string().min(1),
      linkOrder: z.array(z.string().uuid()).min(1),
      priority: z.number().int().optional(),
      matchExactly: z.boolean().optional(),
    }),
  });

  static updateRule = z.object({
    body: z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      linkOrder: z.array(z.string().uuid()).optional(),
      priority: z.number().int().optional(),
      isActive: z.boolean().optional(),
    }),
  });

  static reorderRules = z.object({
    body: z.object({
      rules: z.array(
        z.object({
          ruleId: z.string().uuid(),
          priority: z.number().int(),
        })
      ).min(1),
    }),
  });

  static updateSettings =z.object({
    body: z.object({
      isPersonalizationEnabled: z.boolean().optional(),
    }),
  });

  static startABTest = z.object({
    body: z.object({
      cohortValue: z.string().min(1),
      orderA: z.array(z.string().uuid()).min(1),
      orderB: z.array(z.string().uuid()).min(1),
      splitPercentage: z.number().int().min(10).max(90).optional(),
    }),
  });

  static configureCustomAttributes = z.object({
    body: z.object({
      attributeName: z.string().min(1).max(255),
      mappingType: z.enum(['stripe', 'mailchimp', 'custom_webhook']),
      mappingConfig: z.record(z.any()),
    }),
  })
}