}import { z } from 'zod';

export class LinkValidations {
  static createLink = z.object({
    body: z.object({
      profileId: z.string().uuid(),
      title: z.string().min(1).max(255),
      url: z.string().url(),
      description: z.string().max(500).optional(),
      position: z.number().int().positive().optional(),
      backupUrl: z.string().url().optional(),
    }),
  });

  static updateLink = z.object({
    body: z.object({
      title: z.string().min(1).max(255).optional(),
      url: z.string().url().optional(),
      description: z.string().max(500).optional(),
      backupUrl: z.string().url().optional(),
    }),
  });

  static swapLink = z.object({
    body: z.object({
      profileId: z.string().uuid(),
      swapWithLinkId: z.string().uuid().optional(), // if swapping with specific link
      // If not provided, uses current featured link
    }),
  });

  static reorderLinks = z.object({
    body: z.object({
      links: z.array(
        z.object({
          linkId: z.string().uuid(),
          position: z.number().int().positive(),
        })
      ).min(1),
    }),
  });

  static scheduleSwap = z.object({
    body: z.object({
      scheduledFor: z.string().datetime(), // ISO 8601
      swapWithLinkId: z.string().uuid().optional(),
      note: z.string().optional(),
    }),
  });
}