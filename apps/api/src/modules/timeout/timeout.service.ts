import { prisma } from '@linkbase/db';
import { TimeoutRepository } from './timeout.repository';
import { timeoutQueue } from '../../jobs/queues';
import { cache } from '../../utils/cache';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { parseRecurringRule, getNextOccurrence } from '../../utils/recurrence';
import { evaluateCondition } from '../../utils/conditions';

export class TimeoutService {
  private repository: TimeoutRepository;

  constructor() {this.repository = new TimeoutRepository()}

  async getLinkTimeout(linkId: string, userId: string) {
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    const timeout = await prisma.linkTimeout.findUnique({
      where: { linkId },
      include: {
        fallbackLink: true,
        link: true},
    });

    if (!timeout) {
      return { linkId, message: 'No timeout configured' };
    }

    // Calculate remaining time if time-based
    let remainingTime = null;
    if (timeout.expiresAt && !timeout.isExpired) {
      remainingTime = {
        expiresAt: timeout.expiresAt,
        hoursRemaining: Math.max(
          0,
          Math.round(
            (timeout.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)
          )
        ),
      };
    }

    return {
      ...timeout,
      remainingTime,
    };
  }

  async createLinkTimeout(linkId: string, data: any, userId: string) {
    // Verify ownership
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
      include: { profile: true }});

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    // check if timeout already exists
    const existing = await prisma.linkTimeout.findUnique({
      where: { linkId },
    });

    if (existing) {
      throw new BadRequestError('Timeout already configured for this link');
    }

    // Create timeout
    const timeout = await prisma.linkTimeout.create({
      data: {
        linkId,
        profileId: link.profileId,
        timeoutType: data.timeoutType,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        visibleFrom: data.visibleFrom ? new Date(data.visibleFrom) : undefined,
        visibleUntil: data.visibleUntil ? new Date(data.visibleUntil) : undefined,
        maxVisitorCount: data.maxVisitorCount,
        conditionType: data.conditionType,
        conditionValue: data.conditionValue,
       },
    });

    // Queue job to monitor this timeout
    await timeoutQueue.add('monitor-timeout',{
      timeoutId: timeout.id,
      profileId: link.profileId,
    })

    // Invalidate cache
    await cache.delete(`timeout:${linkId}`);

    return timeout}

  async updateLinkTimeout(timeoutId: string, data: any, userId: string) {
    const timeout = await prisma.linkTimeout.findUnique({
      where: { id: timeoutId },
      include: { profile: true },
    })

    if (!timeout) {
      throw new NotFoundError('Timeout not found');
    }

    const profile = await prisma.profile.findFirst({
      where: { id: timeout.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    const updated = await prisma.linkTimeout.update({
      where: { id: timeoutId },
      data: {
        timeoutType: data.timeoutType || timeout.timeoutType,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : timeout.expiresAt,
        isActive: data.isActive !== undefined ? data.isActive : timeout.isActive,
      },
    });

    await cache.delete(`timeout:${timeout.linkId}`);
    return updated;
  }

  async deleteLinkTimeout(timeoutId: string, userId: string) {
    const timeout = await prisma.linkTimeout.findUnique({
      where: { id: timeoutId },
      include: { profile: true },
    });

    if (!timeout) {
      throw new NotFoundError('Timeout not found')}
    const profile = await prisma.profile.findFirst({
      where: { id: timeout.profileId, userId }});

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    await prisma.linkTimeout.delete({
      where: { id: timeoutId },
    });

    await cache.delete(`timeout:${timeout.linkId}`);
  }

  // time based config

  async configureTimeBased(linkId: string, data: any, userId: string){
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId }}});

    if (!link){
        throw new NotFoundError('Link not found');
    }

    // Get or create timeout
    let timeout = await prisma.linkTimeout.findUnique({
      where: { linkId },
    });

    if (!timeout) {
      timeout = await prisma.linkTimeout.create({
        data: {
          linkId,
          profileId: link.profileId,
          timeoutType: 'time-based',
        },
      });
    }

    // Update with timebased config
    const updated = await prisma.linkTimeout.update({
      where: { id: timeout.id },
      data: {
        timeoutType: 'time-based',
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        visibleFrom: data.visibleFrom ? new Date(data.visibleFrom) : undefined,
        visibleUntil: data.visibleUntil ? new Date(data.visibleUntil) : undefined,
      },
    });

    // Queue monitoring job
    await timeoutQueue.add('monitor-timeout', {
      timeoutId: updated.id,
      profileId: link.profileId,
    });

    await cache.delete(`timeout:${linkId}`);
    return updated;
  }

  async configureRecurring(linkId: string, data: any, userId: string) {
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId }},
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    // Get or create timeout
    let timeout = await prisma.linkTimeout.findUnique({
      where: { linkId },
    });

    if (!timeout) {
      timeout = await prisma.linkTimeout.create({
        data: {
          linkId,
          profileId: link.profileId,
          timeoutType: 'recurring',
        },
      });
    }

    // Validate recurring rule (simplified iCalendar parsing)
    try {
      parseRecurringRule(data.recurringRule);
    } catch (error) {
      throw new BadRequestError('Invalid recurring rule format');
    }

    const updated = await prisma.linkTimeout.update({
      where: { id: timeout.id },
      data: {
        timeoutType: 'recurring',
        recurringRule: data.recurringRule,
        recurringStartDate: data.startDate ? new Date(data.startDate) : undefined,
        recurringEndDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });

    await cache.delete(`timeout:${linkId}`);
    return updated;
  }
  async configureVisitorLimit(linkId: string, data: any, userId: string) {
    // Verify ownership
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    let timeout = await prisma.linkTimeout.findUnique({
      where: { linkId },
    });

    if (!timeout) {
      timeout = await prisma.linkTimeout.create({
        data: {
          linkId,
          profileId: link.profileId,
          timeoutType: 'visitor-count',
        },
      });
    }

    const updated = await prisma.linkTimeout.update({
      where: { id: timeout.id },
      data: {
        timeoutType: 'visitor-count',
        maxVisitorCount: data.maxVisitorCount,
        currentVisitorCount: 0,
      },
    });

    await cache.delete(`timeout:${linkId}`);
    return updated;
  }

  async getVisitorCount(linkId: string, userId: string) {
    // Verify ownership
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    const timeout = await prisma.linkTimeout.findUnique({
      where: { linkId },
    });

    if (!timeout || timeout.timeoutType !== 'visitor-count') {
      return { linkId, message: 'No visitor count limit configured' };
    }

    const percentage =
      timeout.maxVisitorCount && timeout.maxVisitorCount > 0
        ? (timeout.currentVisitorCount / timeout.maxVisitorCount) * 100
        : 0;

    return {
      currentCount: timeout.currentVisitorCount,
      maxCount: timeout.maxVisitorCount,
      remaining: Math.max(0, (timeout.maxVisitorCount || 0) - timeout.currentVisitorCount),
      percentage: percentage.toFixed(1) + '%',
      isExpired: timeout.isExpired || timeout.currentVisitorCount >= (timeout.maxVisitorCount || 0),
    };
  }

  async resetVisitorCounter(linkId: string, userId: string) {
    // Verify ownership
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    const timeout = await prisma.linkTimeout.findUnique({
      where: { linkId },
    });

    if (!timeout) {
      throw new NotFoundError('Timeout not found');
    }

    const updated = await prisma.linkTimeout.update({
      where: { id: timeout.id },
      data: { currentVisitorCount: 0, visitorCountResetAt: new Date() },
    });

    await cache.delete(`timeout:${linkId}`);
    return updated;
  }

  async configureConditional(linkId: string, data: any, userId: string){
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    let timeout = await prisma.linkTimeout.findUnique( { 
      where: {linkId},
     });

    if (!timeout){
      timeout = await prisma.linkTimeout.create({
         data: {
           linkId,
           profileId: link.profileId,
           timeoutType: 'conditional',
         },
      });
    }

    const updated = await prisma.linkTimeout.update({
      where: { id: timeout.id },
      data: {
        timeoutType: 'conditional',
        conditionType: data.conditionType,
        conditionValue: data.conditionValue,
        conditionMetadata: data.conditionMetadata,
      },
    });

    await cache.delete(`timeout:${linkId}`);
    return updated;
  }

  //  fallback and messaging

  async setFallbackLink(timeoutId: string, fallbackLinkId: string, userId: string) {
    const timeout = await prisma.linkTimeout.findUnique({
      where: { id: timeoutId },
      include: { profile: true },
    });

    if (!timeout) {
      throw new NotFoundError('Timeout not found');
    }
    const profile = await prisma.profile.findFirst({
      where: { id: timeout.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    // Verify fallback link exists and belongs to same profile
    const fallbackLink = await prisma.link.findFirst({
      where: { id: fallbackLinkId, profileId: timeout.profileId },
    });

    if (!fallbackLink) {
      throw new NotFoundError('Fallback link not found');
    }

    const updated = await prisma.linkTimeout.update({
      where: { id: timeoutId },
      data: { fallbackLinkId },
    });

    await cache.delete(`timeout:${timeout.linkId}`);
    return updated;
  }

  async configureUrgencyMessage(timeoutId: string, data: any, userId: string) {
    const timeout = await prisma.linkTimeout.findUnique({
      where: { id: timeoutId },
      include: { profile: true },
    });

    if (!timeout) {
      throw new NotFoundError('Timeout not found');
    }

    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: timeout.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    const updated = await prisma.linkTimeout.update({
      where: { id: timeoutId },
      data: {
        showUrgencyBadge: data.showUrgencyBadge,
        urgencyMessage: data.urgencyMessage,
      },
    });

    await cache.delete(`timeout:${timeout.linkId}`);
    return updated;
  }

  // reminders and webhooks 

  async configureReminders(timeoutId: string, data: any, userId: string) {
    const timeout = await prisma.linkTimeout.findUnique({
      where: { id: timeoutId },
      include: { profile: true },
    });

    if (!timeout) {
      throw new NotFoundError('Timeout not found');
    }
    const profile = await prisma.profile.findFirst({
      where: { id: timeout.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    const updated = await prisma.linkTimeout.update({
      where: { id: timeoutId },
      data: {
        reminderEmailDays: data.reminderEmailDays || [],
        reminderEmailHours: data.reminderEmailHours || [],
      },
    });

    await cache.delete(`timeout:${timeout.linkId}`);
    return updated;
  }

  async configureWebhook(timeoutId: string, data: any, userId: string) {
    const timeout = await prisma.linkTimeout.findUnique({
      where: { id: timeoutId },
      include: { profile: true },
    });

    if (!timeout) {
      throw new NotFoundError('Timeout not found');
    }

    const profile = await prisma.profile.findFirst({
      where: { id: timeout.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    const updated = await prisma.linkTimeout.update({
      where: { id: timeoutId },
      data: {
        webhookUrlOnExpire: data.webhookUrl,
        webhookEventData: data.eventData,
      },
    });

    await cache.delete(`timeout:${timeout.linkId}`);
    return updated;
  }


  async getScheduledChanges(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.scheduledLinkChange.findMany({
      where: { profileId, status: 'pending' },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async scheduleChange(data: any, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: data.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const scheduled = await prisma.scheduledLinkChange.create({
      data: {
        profileId: data.profileId,
        linkId: data.linkId,
        changeType: data.changeType,
        scheduledFor: new Date(data.scheduledFor),
        action: data.action,
        variantId: data.variantId,
      },
    });

    // Queue job
    await timeoutQueue.add('execute-scheduled-change', {
      changeId: scheduled.id,
      profileId: data.profileId,
    });

    return scheduled;
  }

  async cancelScheduledChange(changeId: string, userId: string) {
    const change = await prisma.scheduledLinkChange.findUnique({
      where: { id: changeId },
      include: { profile: true },
    });

    if (!change) {
      throw new NotFoundError('Scheduled change not found');
    }

    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: change.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    await prisma.scheduledLinkChange.update({
      where: { id: changeId },
      data: { status: 'cancelled' },
    });
  }

  async getArchivedTimeouts(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.archivedLinkTimeout.findMany({
      where: { profileId },
      orderBy: { expiredAt: 'desc' },
    });
  }

  async getArchivedDetails(archivedId: string, userId: string) {
    const archived = await prisma.archivedLinkTimeout.findUnique({
      where: { id: archivedId },
      include: { profile: true },
    });

    if (!archived) {
      throw new NotFoundError('Archived timeout not found');
    }

    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: archived.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    return archived;
  }

  async reactivateArchived(archivedId: string, data: any, userId: string) {
    const archived = await prisma.archivedLinkTimeout.findUnique({
      where: { id: archivedId },
      include: { profile: true },
    });

    if (!archived) {
      throw new NotFoundError('Archived timeout not found');
    }

    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: archived.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    // Create new timeout from archived config
    const newTimeout = await prisma.linkTimeout.create({
      data: {
        linkId: archived.linkId,
        profileId: archived.profileId,
        timeoutType: (archived.originalConfig as any).timeoutType || 'time-based',
        expiresAt: data.newExpiresAt ? new Date(data.newExpiresAt) : undefined,
        ...(archived.originalConfig as any),
      },
    });

    // Queue monitoring
    await timeoutQueue.add('monitor-timeout', {
      timeoutId: newTimeout.id,
      profileId: archived.profileId,
    });

    return newTimeout;
  }

//   variants 

  async createVariant(linkId: string, data: any, userId: string) {
    // Verify ownership
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    const variant = await prisma.linkVariant.create({
      data: {
        linkId,
        profileId: link.profileId,
        name: data.name,
        description: data.description,
        title: data.title,
        url: data.url,
        timeoutOverride: data.timeoutOverride,
      },
    });

    await cache.delete(`variants:${linkId}`);
    return variant;
  }

  async getVariants(linkId: string, userId: string){
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    })

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    return await prisma.linkVariant.findMany({
      where: { linkId },
    })}

  async updateVariant(variantId: string, data: any, userId: string) {
    const variant = await prisma.linkVariant.findUnique({
      where: { id: variantId },
      include: { link: { include: { profile: true } } },
    });

    if (!variant) {
      throw new NotFoundError('Variant not found');
    }
    if (variant.link.profile.userId !== userId) {
      throw new NotFoundError('Unauthorized')}

    const updated = await prisma.linkVariant.update({
      where: { id: variantId },
      data: {
        name: data.name || variant.name,
        title: data.title || variant.title,
        url: data.url || variant.url,
      },
    });

    await cache.delete(`variants:${variant.linkId}`);
    return updated;
  }

  async startVariantABTest(linkId: string, data: any, userId: string) {
    // Verify ownership
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    // Create test record (simplified - full ab test logic would go here)
    const testId = `test-${Date.now()}`;

    // Queue A/B test job
    await timeoutQueue.add('start-variant-test', {
      linkId,
      profileId: link.profileId,
      variantIds: data.variantIds,
      splitPercentage: data.splitPercentage || 50,
      testId,
    });

    return {
      testId,
      status: 'running',
      message: 'A/B test started',
    };
  }

    // events 

  async getExpirationEvents(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.timeoutExpirationEvent.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // bulk ops 

  async bulkScheduleChanges(profileId: string, changes: any[], userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    })

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Create all changes
    const created = await Promise.all(
      changes.map((change) =>
        prisma.scheduledLinkChange.create({
          data: {
            profileId,
            linkId: change.linkId,
            changeType: change.changeType,
            scheduledFor: new Date(change.scheduledFor),
            action: change.action,
          },
        })
      )
    );

    // Queue jobs for each
    for (const change of created) {
      await timeoutQueue.add('execute-scheduled-change', {
        changeId: change.id,
        profileId,
      });
    }

    return {
      scheduled: created.length,
      message: `${created.length} changes scheduled`,
    };
  }
}
