import { Job } from 'bull';
import { prisma } from '@linkbase/db';
import { cache } from '../../utils/cache';
import { emitLinkSwapped } from '../../events/link-swapped.event';
import { sendWebhook } from '../../integrations/webhooks';
import { invalidateCDNCache } from '../../integrations/cdn'







interface LinkSwapJobData {
  profileId: string;
  fromLinkId: string;
  toLinkId: string;
  swapHistoryId?: string;

}

interface ScheduledSwapJobData {
  linkId: string;
  profileId: string;
  swapWithLinkId?: string;
  note?: string

}

export async function processLinkSwap(job: Job<LinkSwapJobData>) {
  const { profileId, fromLinkId, toLinkId } = job.data;

  try {
    job.progress(10);

    // verify links still exist
    const fromLink = await prisma.link.findUnique({
      where: { id: fromLinkId },
    })

    const toLink = await prisma.link.findUnique({
      where: { id: toLinkId },
    })

    if (!fromLink || !toLink) {
      throw new Error('One or both links not found');
    }

    job.progress(20);

    // update db (already done in controller, but lets for doublecheck)
    await prisma.link.update({
      where: { id: toLink.id },
      data: { position: 1 },
    });

    await prisma.link.update({
      where: { id: fromLink.id },
      data: { position: toLink.position },
    });

    job.progress(40);

    // update analytics snapshot
    const now = new Date();
    await prisma.analyticsSnapshot.updateMany({
      where: { profileId },
      data: { topLinkId: toLink.id }

    });

    job.progress(60);

    // invalidate thecache
    await cache.delete(`links:${profileId}`);
    await cache.delete(`profile:${profileId}`);
    await cache.delete(`analytics:${profileId}:daily`);

    job.progress(70);

    // invalidate CDN cache for public profile page
    await invalidateCDNCache(`/${fromLink.profile.username}`);

    job.progress(80);

    //  send webhooks to external services
    const webhooks = await prisma.webhook.findMany({
      where: { profileId, isActive: true },
    });

    for (const webhook of webhooks) {
      if (webhook.eventType === 'link_swapped' || webhook.eventType === '*') {
        await sendWebhook(webhook, {
          event: 'link_swapped',
          data: {
            fromLinkId,
            toLinkId,
            profileId,
            timestamp: new Date().toISOString(),
          },
        })
      }

    }

    job.progress(90);

    // emit real time event (for WS)
    emitLinkSwapped({
      type: 'link_swapped',
      linkId: toLinkId,
      profileId,
      previousLinkId: fromLinkId,
      timestamp: new Date(),
    });

    job.progress(100);

    return {
      success: true,
      message: 'Link swap completed',
      fromLink: { id: fromLink.id, position: toLink.position },
      toLink: { id: toLink.id, position: 1 },
    };
  } catch (error) {
    console.error('Link swap processor error:', error);
    throw error;
  }
}

export async function processScheduledSwap(job: Job<ScheduledSwapJobData>) {
  const { linkId, profileId, swapWithLinkId } = job.data;

  try {
    // perform the swap
    const link = await prisma.link.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      throw new Error('Link not found');
    }

    // get featured link
    const featured = await prisma.link.findFirst({
      where: { profileId, position: 1, deletedAt: null },
    });

    if (!featured) {
      throw new Error('No featured link found');
    }

    // perform swap 
    await prisma.link.update({
      where: { id: link.id },
      data: { position: 1 },

    });

    await prisma.link.update({
      where: { id: featured.id },
      data: { position: link.position },

    });

    await prisma.scheduledSwap.updateMany({
      where: { linkId, status: 'pending' },
      data: { status: 'completed', executedAt: new Date() },

    });

    await cache.delete(`links:${profileId}`);

    emitLinkSwapped({
      type: 'scheduled_swap_executed',
      linkId,
      profileId,
      previousLinkId: featured.id,
      timestamp: new Date(),
    });

    return { success: true };
  } catch (error) {
    console.error('Scheduled swap processor error:', error);
    throw error;
  }
}