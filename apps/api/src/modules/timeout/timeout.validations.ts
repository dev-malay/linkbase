import {z} from 'zod'

export class TimeoutValidations {
  static createTimeout = z.object({
    body: z.object({
      timeoutType: z.enum(['time-based', 'visitor-count', 'conditional', 'recurring']),
      expiresAt: z.string().datetime().optional(),
      visibleFrom: z.string().datetime().optional(),
      visibleUntil: z.string().datetime().optional(),
      maxVisitorCount: z.number().int().optional(),
      conditionType: z.string().optional(),
      conditionValue: z.string().optional(),
    }),
  });

  static updateTimeout = z.object({
    body: z.object({
      timeoutType: z.enum(['time-based', 'visitor-count', 'conditional', 'recurring']).optional(),
      expiresAt: z.string().datetime().optional(),
      isActive: z.boolean().optional(),
    }),
  });

  static configureTimeBased = z.object({
    body: z.object({
      expiresAt: z.string().datetime().optional(),
      visibleFrom: z.string().datetime().optional(),
      visibleUntil: z.string().datetime().optional(),
    }),
  })

  static configureRecurring = z.object({
    body: z.object({
      recurringRule: z.string().min(1), // iCalendar format
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  });

  static configureVisitorLimit = z.object({
    body: z.object({
      maxVisitorCount: z.number().int().min(1),
    }),
  });

  static configureConditional = z.object({
    body: z.object({
      conditionType: z.enum(['user_segment', 'subscription_status', 'purchase_history', 'custom']),
      conditionValue: z.string().min(1),
      conditionMetadata: z.record(z.any()).optional(),
    }),
  });

  static setFallback = z.object({
    body: z.object({
      fallbackLinkId: z.string().uuid(),
    }),
  });

  static configureUrgency = z.object({
    body: z.object({
      showUrgencyBadge: z.boolean(),
      urgencyMessage: z.string().optional(),
    }),
  });

  static configureReminders = z.object({
    body: z.object({
      reminderEmailDays: z.array(z.number().int()).optional(),
      reminderEmailHours: z.array(z.number().int()).optional(),
    }),
  });

  static configureWebhook = z.object({
    body: z.object({
      webhookUrl: z.string().url(),
      eventData: z.record(z.any()).optional(),
    }),
  });

  static scheduleChange = z.object({
    body: z.object({
      profileId: z.string().uuid(),
      linkId: z.string().uuid(),
      changeType: z.enum(['timeout', 'show', 'hide', 'variant_swap']),
      scheduledFor: z.string().datetime(),
      action: z.string(),
      variantId: z.string().uuid().optional(),
    }),
  });

  static createVariant = z.object({
    body: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      title: z.string().min(1),
      url: z.string().url(),
      timeoutOverride: z.record(z.any()).optional(),
    }),
  });

  static updateVariant = z.object({
    body: z.object({
      name: z.string().optional(),
      title: z.string().optional(),
      url: z.string().url().optional(),
    }),
  });

  static startABTest = z.object({
    body: z.object({
      variantIds: z.array(z.string().uuid()).min(2),
      splitPercentage: z.number().int().min(10).max(90).optional(),
      duration: z.number().int().optional(),
    }),
  });

  static reactivateArchived = z.object({
    body: z.object({
      newExpiresAt: z.string().datetime().optional(),
    }),
  });

  static bulkSchedule = z.object({
    body: z.object({
      changes: z.array(
        z.object({
          linkId: z.string().uuid(),
          changeType: z.string(),
          scheduledFor: z.string().datetime(),
          action: z.string(),
        })
      ).min(1).max(100),
    }),
  });
}