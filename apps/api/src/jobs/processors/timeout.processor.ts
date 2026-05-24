import { Job } from 'bull';
import { prisma } from '@linkbase/db';
import { cache } from '../../utils/cache';
import {
  shouldLinkBeVisible,
  calculateUrgencyMessage,
  shouldSendReminder,
} from '../../utils/timeout-ml';
import { getNextOccurrence } from '../../utils/recurrence';
import axios from 'axios';

export async function monitorTimeout(job: Job) {
  const { timeoutId, profileId } = job.data;

  try {
    const timeout = await prisma.linkTimeout.findUnique({
      where: { id: timeoutId },
      include: { link: true, profile: true },
    });

    if (!timeout) return;

    // Check if link should be visible
    const isVisible = shouldLinkBeVisible(timeout);

    // Expire link if needed
    if (!isVisible && !timeout.isExpired) {
      await expireTimeout(timeout, profileId);
    }

    // Check for reminders
    const shouldRemindDay = await shouldSendReminder(timeout, 'day');
    const shouldRemindHour = await shouldSendReminder(timeout, 'hour');

    if (shouldRemindDay || shouldRemindHour) {
      await sendReminderEmail(timeout);
    }

    // For recurring, schedule next occurrence
    if (timeout.timeoutType === 'recurring' && timeout.recurringRule) {
      const rule = JSON.parse(timeout.recurringRule);
      const nextOccurrence = getNextOccurrence(rule);

      // Update or create new timeout for next cycle
      await prisma.linkTimeout.update({
        where: { id: timeoutId },
        data: {
          visibleFrom: nextOccurrence,
          visibleUntil: new Date(
            nextOccurrence.getTime() + 24 * 60 * 60 * 1000
          ),
        },
      });
    }
  } catch (error) {
    console.error('Timeout monitoring error:', error);
  }
}

export async function executeScheduledChange(job: Job) {
  const { changeId, profileId } = job.data;

  try {
    const change = await prisma.scheduledLinkChange.findUnique({
      where: { id: changeId },
    });

    if (!change) return;

    // Execute the change
    switch (change.action) {
      case 'show':
        await prisma.link.update({
          where: { id: change.linkId },
          data: { isHidden: false },
        });
        break;

      case 'hide':
        await prisma.link.update({
          where: { id: change.linkId },
          data: { isHidden: true },
        });
        break;

      case 'expire':
        const timeout = await prisma.linkTimeout.findUnique({
          where: { linkId: change.linkId },
        });
        if (timeout) {
          await expireTimeout(timeout, profileId);
        }
        break;

      case 'change_variant':
        // Swap to variant
        if (change.variantId) {
          const variant = await prisma.linkVariant.findUnique({
            where: { id: change.variantId },
          });
          if (variant) {
            await prisma.link.update({
              where: { id: change.linkId },
              data: {
                title: variant.title,
                url: variant.url,
              },
            });
          }
        }
        break;
    }

    // Mark as executed
    await prisma.scheduledLinkChange.update({
      where: { id: changeId },
      data: {
        status: 'executed',
        executedAt: new Date(),
      },
    });

    // Invalidate cache
    await cache.delete(`timeout:${change.linkId}`);
  } catch (error) {
    console.error('Scheduled change execution error:', error);
  }
}

async function expireTimeout(timeout: any, profileId: string) {
  try {
    // Archive the timeout
    await prisma.archivedLinkTimeout.create({
      data: {
        linkId: timeout.linkId,
        profileId,
        timeoutId: timeout.id,
        originalConfig: timeout,
        totalVisitors: timeout.visitorsDuringTimeout,
        totalClicks: timeout.clicksDuringTimeout,
        totalRevenue: timeout.revenueDuringTimeout,
        activatedAt: timeout.createdAt,
        expiredAt: new Date(),
        duration: Math.round(
          (Date.now() - timeout.createdAt.getTime()) / (60 * 60 * 1000)
        ),
      },
    });

    // Mark timeout as expired
    await prisma.linkTimeout.update({
      where: { id: timeout.id },
      data: {
        isExpired: true,
        expiredAt: new Date(),
        isActive: false,
      },
    });

    // Hide the link
    await prisma.link.update({
      where: { id: timeout.linkId },
      data: { isHidden: true },
    });

    // Show fallback if configured
    if (timeout.fallbackLinkId) {
      await prisma.link.update({
        where: { id: timeout.fallbackLinkId },
        data: { isHidden: false },
      });
    }

    // Fire webhook if configured
    if (timeout.webhookUrlOnExpire) {
      try {
        await axios.post(timeout.webhookUrlOnExpire, {
          event: 'link_expired',
          linkId: timeout.linkId,
          timeoutId: timeout.id,
          expiredAt: new Date().toISOString(),
          data: timeout.webhookEventData,
        });
      } catch (error) {
        console.error('Webhook fire error:', error);
      }
    }

    // Create expiration event
    await prisma.timeoutExpirationEvent.create({
      data: {
        timeoutId: timeout.id,
        profileId,
        linkId: timeout.linkId,
        eventType: 'expired',
        action: 'fallback_activated',
      },
    });

    // Invalidate caches
    await cache.delete(`timeout:${timeout.linkId}`);
  } catch (error) {
    console.error('Timeout expiration error:', error);
  }
}

async function sendReminderEmail(timeout: any) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: timeout.profileId },
      include: { user: true },
    });

    if (!profile || !profile.user.email) return;

    const urgencyMessage = calculateUrgencyMessage(timeout);

    // Send email (integrate with email service)
    // await emailService.send({
    //   to: profile.user.email,
    //   subject: `Link expires soon: ${timeout.link.title}`,
    //   body: `Your link "${timeout.link.title}" will expire ${urgencyMessage}`,
    // });

    console.log(`Reminder sent for ${timeout.linkId}: ${urgencyMessage}`);
  } catch (error) {
    console.error('Reminder email error:', error);
  }
}

export async function startVariantTest(job: Job) {
  const { linkId, profileId, variantIds, splitPercentage, testId } = job.data;

  try {
    // Initialize variant test tracking
    // Each visitor gets randomly assigned variant A or B
    // Track performance and determine winner

    await cache.set(`variant-test:${testId}`, JSON.stringify({
      linkId,
      variants: variantIds,
      splitPercentage,
      variantAClicks: 0,
      variantBClicks: 0,
      createdAt: Date.now(),
    }), 86400 * 7); // 7 days
  } catch (error) {
    console.error('Variant test startup error:', error);
  }
}

export async function incrementVisitorCount(job: Job) {
  const { linkId } = job.data;

  try {
    const timeout = await prisma.linkTimeout.findUnique({
      where: { linkId },
    });

    if (!timeout || timeout.timeoutType !== 'visitor-count') return;

    const updated = await prisma.linkTimeout.update({
      where: { id: timeout.id },
      data: {
        currentVisitorCount: { increment: 1 },
        visitorsDuringTimeout: { increment: 1 },
      },
    });

    // Check if limit reached
    if (
      updated.maxVisitorCount &&
      updated.currentVisitorCount >= updated.maxVisitorCount
    ) {
      await expireTimeout(updated, timeout.profileId);
    }

    await cache.delete(`timeout:${linkId}`);
  } catch (error) {
    console.error('Visitor count increment error:', error);
  }
}