import {z} from 'zod'



export class PresetValidations {
  static createPreset = z.object({
    body: z.object({
      profileId: z.string().uuid(),
      name: z.string().min(1).max(255),
      description: z.string().max(500).optional(),
      linkIds: z.array(z.string().uuid()).min(1),
      metadata: z.record(z.any()).optional(),
    }),
  });

  static updatePreset = z.object({
     body: z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(500).optional(),
      metadata: z.record(z.any()).optional(),
    }),
  });

  static reorderLinksInPreset = z.object({
    body: z.object({
      linkIds: z.array(z.string().uuid()).min(1),
    }),
  })

  static addLinkToPreset = z.object({
    body: z.object({
      linkId: z.string().uuid(),
      position: z.number().int().positive().optional(),
    }),
  });

  static clonePreset = z.object({
    body: z.object({
      newName: z.string().min(1).max(255),
      newDescription: z.string().max(500).optional(),
    }),
  });

  static comparePresets = z.object({
    body: z.object({
      presetIds: z.array(z.string().uuid()).min(2).max(5),
    }),
  })

  static addAvailabilityRule = z.object({
     body: z.object({
      linkId: z.string().uuid(),
      ruleType: z.enum(['time-based','day-based', 'customer-segment', 'geolocation']),
      showOnlyFrom: z.string().optional(), 
      showOnlyUntil: z.string().optional(),
      showOnDays: z.array(z.string()).optional(),
      requiresCustomerTier: z.enum(['vip', 'premium', 'basic']).optional(),
      allowedCountries: z.array(z.string()).optional(),
      blockedCountries: z.array(z.string()).optional(),
    }),
  });

  static updateAvailabilityRule = z.object({
    body: z.object({
      showOnlyFrom: z.string().optional(),
      showOnlyUntil: z.string().optional(),
      showOnDays: z.array(z.string()).optional(),
      requiresCustomerTier: z.string().optional(),
      allowedCountries: z.array(z.string()).optional(),
      blockedCountries: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }),
  });

  static schedulePresetActivation = z.object({
    body: z.object({
      scheduledFor: z.string().datetime(),
      note: z.string().optional(),
      recurrenceRule: z.string().optional()
    }),
  });

  static exportTemplate = z.object({
    body: z.object({templateName: z.string().min(1).max(255),
      templateDescription: z.string().optional(),
      isPublic: z.boolean().optional(),
    }),
  });

  static importTemplate = z.object({
    body: z.object({templateId: z.string().uuid(),
      profileId: z.string().uuid(),
      presetName: z.string().min(1).max(255),
    }),
  });

  static bulkAddLinks = z.object({
    body: z.object({
      links: z.array(
        z.object({
          title: z.string().min(1).max(255),
          url: z.string().url(),
          description: z.string().optional(),
          backupUrl: z.string().url().optional(),
          metadata: z.record(z.any()).optional(),
        })
      ).min(1).max(100),
    }),

  });
}