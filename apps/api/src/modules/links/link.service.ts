import { prisma } from '@linkbase/db';
import { LinkRepository } from './link.repository';
import { analyticsQueue } from '../../jobs/queues';
import { linkSwapQueue } from '../../jobs/queues';
import { emitLinkSwapped } from '../../events/link-swapped.event';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { generateShortUrl } from '../../utils/short-url';
import { cache } from '../../utils/cache';

export class LinkService {
  constructor(private repository: LinkRepository) {}

  async getLinksForProfile(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const cacheKey = `links:${profileId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const links = await this.repository.getLinksForProfile(profileId);

    await cache.set(cacheKey, JSON.stringify(links), 300);

    return links;
  }

  async getLink(linkId: string, userId: string) {
    const link = await this.repository.getLink(linkId);

    if (!link) {
      throw new NotFoundError('Link not found');
    }
    const profile = await prisma.profile.findFirst({
      where: { id: link.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    return link;
  }

  async createLink(
    data: {
      profileId: string;
      title: string;
      url: string;
      description?: string;
      position?: number;
      backupUrl?: string;
    },
    userId: string
  )
   {


    const profile = await prisma.profile.findFirst({
      where: { id: data.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    let position = data.position;
    if (!position) {
      const lastLink = await prisma.link.findFirst({
        where: { profileId: data.profileId, deletedAt: null },
        orderBy: { position: 'desc' },
      });
      position = (lastLink?.position || 0) + 1;
    }

    const shortUrl = await generateShortUrl();

    const link = await prisma.link.create({
      data: {
        profileId: data.profileId,
        title: data.title,
        url: data.url,
        shortUrl,
        description: data.description,
        position,
        metadata: {
          backupUrl: data.backupUrl,
        },
      }
    });

    await cache.delete(`links:${data.profileId}`);
    emitLinkSwapped({
      type: 'link_created',
      linkId: link.id,
      profileId: data.profileId,
      timestamp: new Date(),
    });

    return link;
  }

  async updateLink(
    linkId: string,
    data: {
      title?: string;
      url?: string;
      description?: string;
      backupUrl?: string;
    },
    userId: string
  ) {
    const link = await this.getLink(linkId, userId);

    const updated = await prisma.link.update({
      where: { id: linkId },
      data: {
        title: data.title || link.title,
        url: data.url || link.url,
        description: data.description !== undefined ? data.description : link.description,
        metadata: {
          ...link.metadata,
          backupUrl: data.backupUrl,
        },
      }
    });

    await cache.delete(`links:${link.profileId}`);

    return updated;
  }

  async deleteLink(linkId: string, userId: string) {
    const link = await this.getLink(linkId, userId);
    await prisma.link.update({
      where: { id: linkId },
      data: { deletedAt: new Date() },
    });

    await cache.delete(`links:${link.profileId}`);

    const remainingLinks = await prisma.link.findMany({
      where: { profileId: link.profileId, deletedAt: null },
      orderBy: { position: 'asc' },
    });

    for (let i = 0; i < remainingLinks.length; i++) {
      await prisma.link.update({
        where: { id: remainingLinks[i].id },
        data: { position: i + 1 },
      });
    }

    emitLinkSwapped({
      type: 'link_deleted',
      linkId,
      profileId: link.profileId,
      timestamp: new Date(),
    });
  }

//live link control methods below
  async swapLink(
    linkId: string,
    profileId: string,
    swapWithLinkId: string | undefined,
    userId: string
  ) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');

    }

    const linkToSwap = await prisma.link.findFirst({
      where: { id: linkId, profileId, deletedAt: null },
    });

    if (!linkToSwap) {
      throw new NotFoundError('Link not found');
    }

    let targetLink = linkToSwap;
    if (swapWithLinkId) {
      targetLink = await prisma.link.findFirst({
        where: { id: swapWithLinkId, profileId, deletedAt: null },
      });

      if (!targetLink) {
        throw new NotFoundError('Target link not found');
      }
    }

    // get the current featured link (position 1)
    const currentFeatured = await prisma.link.findFirst({
      where: { profileId, position: 1, deletedAt: null },
    })

    if (!currentFeatured) {
      throw new BadRequestError('No featured link found');
    }

    const swapHistory = await prisma.swapHistory.create({
      data: {
        profileId,
        fromLinkId: currentFeatured.id,
        toLinkId: targetLink.id,
        swappedAt: new Date(),
      },
    });

    const targetPosition = targetLink.position;

    await prisma.link.update({
      where: { id: targetLink.id },
      data: { position: 1 },
    });

    await prisma.link.update({
      where: { id: currentFeatured.id },
      data: { position: targetPosition },
    });

    await linkSwapQueue.add('execute-swap', {
      profileId,
      fromLinkId: currentFeatured.id,
      toLinkId: targetLink.id,
      swapHistoryId: swapHistory.id,
    });

    await cache.delete(`links:${profileId}`);
    emitLinkSwapped({
      type: 'link_swapped',
      linkId: targetLink.id,
      profileId,
      previousLinkId: currentFeatured.id,
      timestamp: new Date(),
    });

    return {
      success: true,
      swappedTo: {
        id: targetLink.id,
        title: targetLink.title,
        position: 1,
      },
      swappedFrom: {
        id: currentFeatured.id,
        title: currentFeatured.title,
        position: targetPosition,
      },
      swapHistoryId: swapHistory.id,
    }
  }


  async previewLink(linkId: string, userId: string) {
    const link = await this.getLink(linkId, userId);

    return {
      id: link.id,
      title: link.title,
      url: link.url,
      shortUrl: link.shortUrl,
      description: link.description,
      preview: {
        domain: new URL(link.url).hostname,
        isValid: true, // in prod, check if link is live
      },
    };
  }

  async reorderLinks(
    profileId: string,
    links: Array<{ linkId: string; position: number }>,
    userId: string
  ) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    await prisma.$transaction(
      links.map((link) =>
        prisma.link.update({
          where: { id: link.linkId },
          data: { position: link.position },
        })
      )
    );

    await cache.delete(`links:${profileId}`);
    emitLinkSwapped({
      type: 'links_reordered',
      profileId,
      timestamp: new Date(),
    });

    return { success: true, reordered: links.length };
  }


  async getSwapHistory(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    })

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const history = await prisma.swapHistory.findMany({
      where: { profileId },
      orderBy: { swappedAt: 'desc' },
      take: 5, // Last 5 swaps
      include: {
        fromLink: true,
        toLink: true,
      },
    });

    return history
  }


  async undoSwap(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }


    const latestSwap = await prisma.swapHistory.findFirst({
      where: { profileId },
      orderBy: { swappedAt: 'desc' },
    });

    if (!latestSwap) {
      throw new BadRequestError('No swap history found');
    }

    const fromLink = await prisma.link.findUnique({
      where: { id: latestSwap.fromLinkId },
    });

    const toLink = await prisma.link.findUnique({
      where: { id: latestSwap.toLinkId },
    })

    if (!fromLink || !toLink) {
      throw new NotFoundError('Links not found');
    }


    await prisma.link.update({
      where: { id: latestSwap.fromLinkId },
      data: { position: 1 },
    });

    await prisma.link.update({
      where: { id: latestSwap.toLinkId },
      data: { position: toLink.position },

    })


    await prisma.swapHistory.update({
      where: { id: latestSwap.id },
      data: { revertedAt: new Date() },
    })

    await cache.delete(`links:${profileId}`);

    return {
      success: true,
      message: 'Swap undone',
      revertedTo: {
        id: latestSwap.fromLinkId,
        position: 1,
      },
    };
  }


  async getSwapAnalytics(linkId: string, userId: string) {
    const link = await this.getLink(linkId, userId);

    // Get current link clicks (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const currentClicks = await prisma.linkClick.count({
      where: {
        linkId,
        timestamp: { gte: oneHourAgo },
      },
    });


    const previousSwap = await prisma.swapHistory.findFirst({
      where: { toLinkId: linkId },
      orderBy: { swappedAt: 'desc' },
      include: { fromLink: true },
    });

    let previousClicks = 0;
    if (previousSwap) {
      const previousOneHourWindow = new Date(
        previousSwap.swappedAt.getTime() - 60 * 60 * 1000
      );


      previousClicks = await prisma.linkClick.count({
        where: {
          linkId: previousSwap.fromLinkId,
          timestamp: {
            gte: previousOneHourWindow,
            lte: previousSwap.swappedAt,
          },
        },
      })
    }

    const improvement =
      previousClicks > 0
        ? (((currentClicks - previousClicks) / previousClicks) * 100).toFixed(1)
        : null;

    return {
      current: {
        linkId,
        title: link.title,
        clicksLastHour: currentClicks,
        ctr: ((currentClicks / 1000) * 100).toFixed(2) + '%', // Assuming ~1000 visits/hour
      },
      previous: previousSwap
        ? {
            linkId: previousSwap.fromLink.id,
            title: previousSwap.fromLink.title,
            clicksLastHour: previousClicks,
            ctr: ((previousClicks / 1000) * 100).toFixed(2) + '%',
          }

        : null,
      improvement: improvement ? `+${improvement}%` : null,
    };
  }

  async scheduleSwap(
    data: {
      linkId: string;
      profileId: string;
      scheduledFor: Date;
      swapWithLinkId?: string;
      note?: string;
    },
    userId: string
  ) {


    const profile = await prisma.profile.findFirst({
      where: { id: data.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Verify link exists
    const link = await prisma.link.findFirst({
      where: { id: data.linkId, profileId: data.profileId, deletedAt: null },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }
// queue w bullmq schedule time 
    const jobId = `swap-${data.linkId}-${Date.now()}`;

    await linkSwapQueue.add(
      'scheduled-swap',
      {
        linkId: data.linkId,
        profileId: data.profileId,
        swapWithLinkId: data.swapWithLinkId,
        note: data.note,
      },
      {
        delay: data.scheduledFor.getTime() - Date.now(),
        jobId,
      }
    );

    const scheduled = await prisma.scheduledSwap.create({
      data: {
        profileId: data.profileId,
        linkId: data.linkId,
        scheduledFor: data.scheduledFor,
        jobId,
        status: 'pending',
        metadata: {
          swapWithLinkId: data.swapWithLinkId,
          note: data.note,
        },
      },
    });

    return scheduled;
  }


  
  async getScheduledSwaps(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.scheduledSwap.findMany({
      where: { profileId, status: 'pending' },
      orderBy: { scheduledFor: 'asc' },
      include: {
        link: true,
      },
    });
  }

  async cancelScheduledSwap(swapId: string, userId: string) {
    const swap = await prisma.scheduledSwap.findUnique({
      where: { id: swapId },
      include: { link: { include: { profile: true } } },
    });

    if (!swap) {
      throw new NotFoundError('Scheduled swap not found');
    }


    if (swap.link.profile.userId !== userId) {
      throw new NotFoundError('Unauthorized');
    }

    if (swap.jobId) {
      const job = await linkSwapQueue.getJob(swap.jobId);
      if (job) {
        await job.remove();
      }
    }

    await prisma.scheduledSwap.update({
      where: { id: swapId },
      data: { status: 'cancelled' },
    })
  }

  // Activate backup link
  async activateBackupLink(
    linkId: string,
    profileId: string,
    userId: string
  )  {


    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const link = await prisma.link.findFirst({
      where: { id: linkId, profileId, deletedAt: null },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    const backupUrl = link.metadata?.backupUrl;

    if (!backupUrl) {
      throw new BadRequestError('No backup link configured');
    }

    // imp update main link to backup URL
    const updated = await prisma.link.update({
      where: { id: linkId },
      data: {
        url: backupUrl,
        metadata: {
          ...link.metadata,
          backupActivatedAt: new Date().toISOString(),
          originalUrl: link.url,
        },
      },
    });

    // Invalidate cache
    await cache.delete(`links:${profileId}`);

    emitLinkSwapped({
      type: 'backup_link_activated',
      linkId,
      profileId,
      timestamp: new Date(),
    });

    return updated;
  }
}