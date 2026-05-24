import {z} from 'zod';

export class AttributionValidations {
  static webhook = z.object({
    body: z.object({
      type: z.string(), // "charge.created", "subscription_created", etc
      data: z.record(z.any()),
      timestamp: z.string().optional(),
      signature: z.string().optional(),
    }),
  });

  static configureIntegration = z.object({
    body: z.object({
      service: z.enum(['stripe', 'youtube', 'patreon', 'gumroad', 'mailchimp']),
      accessToken: z.string().optional(),
      config: z.record(z.any()).optional(),
    }),
  });

  static updateSettings = z.object({
    body: z.object({
      attributionWindowDays: z.number().int().min(1).max(90).optional(),
      attributionModel: z.enum(['last_click', 'first_click', 'multi_touch']).optional(),
      fraudDetectionEnabled: z.boolean().optional(),
    }),
  });

  static resolveFraudAlert = z.object({
    body: z.object({
      resolution: z.enum(['false_positive', 'genuine_fraud', 'legitimate_traffic']),
      notes: z.string().optional(),
    }),
  });
}