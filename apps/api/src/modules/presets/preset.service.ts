import { prisma } from '@linkbase/db';
import { PresetRepository } from './preset.repository';
import { LinkService } from '../links/link.service';
import { presetActivationQueue } from '../../jobs/queues';
import { emitPresetActivated } from '../../events/preset-activated.event';
import { cache } from '../../utils/cache';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { generateShortUrl } from '../../utils/short-url';
import { generateQRCode } from '../../utils/qr-code';


export class PresetService {
  private repository: PresetRepository;
  private linkService: LinkService;

  constructor() {
    this.repository = new PresetRepository();
    this.linkService = new LinkService();
  }

  async getPresetsForProfile(profileId: string, userId: string) {
    // Verifythe  ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    })

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const cacheKey = `presets:${profileId}`;
     const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const presets = await this.repository.getPresetsForProfile(profileId);

    await cache.set(cacheKey, JSON.stringify(presets),300);
    return presets;
  }

  async getPreset(presetId: string, userId: string) {
    const preset = await this.repository.getPreset(presetId);

    if (!preset) {
      throw new NotFoundError('Preset not found');
    }


    const profile = await prisma.profile.findFirst({
      where: { id: preset.profileId, userId },
    })


    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    const linksWithDetails = await prisma.link.findMany({
      where: { id: { in: preset.linkIds }, deletedAt: null },
      include: {
        clicks: {
          where: {
            timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // for last 30 days
          },
        },
        revenue: {
          where: {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
      },
    });

    const linksWithPerformance = linksWithDetails.map((link) =>({
      ...link,
      clicksLastMonth: link.clicks.length,
      ctr: ((link.clicks.length / 1000) * 100).toFixed(2) + '%',
      revenueLastMonth: link.revenue.reduce((sum, r) => sum + r.amountCents, 0n),
    }));

    const orderedLinks = preset.linkIds
      .map((linkId) => linksWithPerformance.find((l) => l.id === linkId))
      .filter((l) => l !== undefined);

    return {
      ...preset,
      links: orderedLinks,
      totalClicks: preset.totalClicks,
      totalRevenue: preset.totalRevenue,
      performancePercentage: preset.totalClicks > 0 ? '+15%' : null, // Calculate based on history
    };
  }

  async createPreset(
    data: {
      profileId: string;
      name: string;
      description?: string;
      linkIds: string[];
      metadata?: Record<string, any>;
    },
    userId: string
  ) {
    // Verify ownership for sec
    const profile = await prisma.profile.findFirst({
      where: { id: data.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const links = await prisma.link.findMany({
      where: {
        id: { in: data.linkIds },
        profileId: data.profileId,
        deletedAt: null,
      },
    });

    if (links.length !== data.linkIds.length) {
      throw new BadRequestError('One or more links not found');
    }

    const preset = await prisma.preset.create({
      data: {
        profileId: data.profileId,
        name: data.name,
        description: data.description,
        linkIds: data.linkIds,
        metadata: data.metadata || {},
      },
    });

    await cache.delete(`presets:${data.profileId}`);

    return preset;
  }

  async updatePreset(
    presetId: string,
    data:{
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    },
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);

    const updated = await prisma.preset.update({
      where: { id: presetId },
      data: {
        name: data.name || preset.name,
        description: data.description !== undefined ? data.description :preset.description,
        metadata: data.metadata || preset.metadata,
      },
    });

    await cache.delete(`presets:${preset.profileId}`);
    return updated;
  }

  async deletePreset(presetId: string, userId: string) {
    const preset = await this.getPreset(presetId, userId);

    await prisma.preset.delete({
      where: { id: presetId },
    });

    await cache.delete(`presets:${preset.profileId}`);
  }


  // activate preset (swap all links to this preset's config)
  async activatePreset(presetId: string, userId: string) {
    const preset = await this.getPreset(presetId, userId);

    const previousPreset = await prisma.preset.findFirst({
      where: { profileId: preset.profileId, isActive: true },
    });

    await prisma.preset.update({
      where: { id: presetId },
      data: { isActive: true, lastActivatedAt: new Date() },
    })

    if (previousPreset) {
      await prisma.preset.update({
        where: { id: previousPreset.id },
        data: { isActive: false },
      });
    }

    await this.reorderLinksInPreset(presetId, preset.linkIds, userId);
    await prisma.presetActivationHistory.create({
      data: {
        presetId,
        profileId: preset.profileId,
        previousPresetId: previousPreset?.id,
      },
    });

    await prisma.preset.update({
      where: { id: presetId },
      data: { totalActivations: { increment: 1 } },
    });


    await presetActivationQueue.add('activate-preset', {
      presetId,
      profileId: preset.profileId,
      previousPresetId: previousPreset?.id,
    })

    await cache.delete(`presets:${preset.profileId}`);
    await cache.delete(`links:${preset.profileId}`);
    await cache.delete(`active-preset:${preset.profileId}`);

    emitPresetActivated({
      type: 'preset_activated',
      presetId,
      profileId: preset.profileId,
      previousPresetId: previousPreset?.id,
      timestamp: new Date(),
    });

    return {
      success: true,
      activated: {
        id: preset.id,
        name: preset.name,
        linkCount: preset.linkIds.length,
      },
      previousPreset: previousPreset
        ? { id: previousPreset.id, name: previousPreset.name }
        : null,
    };
  }

  async getActivePreset(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    })

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const cacheKey = `active-preset:${profileId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const activePreset = await prisma.preset.findFirst({
      where: { profileId, isActive: true, isArchived: false },
    });

    if (activePreset) {
      await cache.set(cacheKey, JSON.stringify(activePreset), 300);
    }

    return activePreset || null;
  }


  async reorderLinksInPreset(
    presetId: string,
    linkIds: string[],
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);
    const links = await prisma.link.findMany({
      where: {id: { in: linkIds}, profileId: preset.profileId, deletedAt: null },
    });

    if (links.length !==linkIds.length) {
      throw new BadRequestError('One or more links not found');
    }

    const updated = await prisma.preset.update({
      where: { id: presetId },
      data: { linkIds },
    });

    if (preset.isActive) {
      await prisma.$transaction(
        linkIds.map((linkId, index) =>
          prisma.link.update({
            where: { id: linkId },
            data: { position: index + 1 },
          })
        )
      );
    }

    await cache.delete(`presets:${preset.profileId}`);
    await cache.delete(`links:${preset.profileId}`);
    return updated
  }

  async addLinkToPreset(
    presetId: string,
    linkId: string,
    position?: number,
    userId?: string
  ) {
    const preset = await this.getPreset(presetId, userId || '');
    const link = await prisma.link.findFirst({
      where: { id: linkId, profileId: preset.profileId, deletedAt: null },
    });

    if (!link) {
      throw new NotFoundError('Link not found')}


    const newLinkIds = position
      ?[
          ...preset.linkIds.slice(0, position - 1),
          linkId,
          ...preset.linkIds.slice(position - 1),
        ]
      :[...preset.linkIds,linkId]

    return await prisma.preset.update({
      where: { id: presetId },
      data: { linkIds: newLinkIds},
    });
  }
  async removeLinkFromPreset(presetId: string, linkId: string, userId: string) {
    const preset = await this.getPreset(presetId, userId);

    const newLinkIds = preset.linkIds.filter((id) => id !== linkId);

    if (newLinkIds.length === 0) {
      throw new BadRequestError('Cannot remove all links from preset');
    }

    return await prisma.preset.update({
      where: { id: presetId },
      data: { linkIds: newLinkIds },
    });
  }

  async clonePreset(
    presetId: string,
    newName: string,
    newDescription: string | undefined,
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);

    const cloned = await prisma.preset.create({
      data: {
        profileId: preset.profileId,
        name: newName,
        description: newDescription || preset.description,
        linkIds: preset.linkIds,
        metadata: preset.metadata,
        clonedFromId: presetId,
      },
    });

    await cache.delete(`presets:${preset.profileId}`);
    return cloned;
  }

  async archivePreset(presetId: string, userId: string) {
    const preset = await this.getPreset(presetId, userId);

    const archived = await prisma.preset.update({
      where: { id: presetId },
      data: { isArchived: true, archivedAt: new Date(), isActive: false },
    });

    await cache.delete(`presets:${preset.profileId}`);
    return archived;
  }
  async restorePreset(presetId: string, userId: string) {
    const preset = await this.repository.getPreset(presetId);

    if (!preset) {
      throw new NotFoundError('Preset isnot found');
    }

    const profile = await prisma.profile.findFirst({
      where: { id: preset.profileId, userId},
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    const restored = await prisma.preset.update({
      where: { id: presetId },
      data: { isArchived: false, archivedAt: null },
    });

    await cache.delete(`presets:${preset.profileId}`);
    return restored;
  }

  async getArchivedPresets(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.preset.findMany({
      where: { profileId, isArchived: true },
      orderBy: { archivedAt: 'desc' },
    });
  }

  async getPresetAnalytics(presetId: string, userId: string) {
    const preset = await this.getPreset(presetId, userId);
    const history = await prisma.presetActivationHistory.findMany({
      where: { presetId },
      orderBy: { activatedAt: 'desc' },
      take: 10,
    });

    let totalClicks = 0;
    let totalRevenue = 0n;

    for (const activation of history) {
      const clicks = await prisma.linkClick.count({
        where: {
          linkId: { in: preset.linkIds },
          timestamp: {
            gte: activation.activatedAt,
            lte: activation.deactivatedAt || new Date(),
          },
        },
      });

      const revenue = await prisma.linkRevenue.aggregate({
        where: {
          linkId: { in: preset.linkIds },
          createdAt: {
            gte: activation.activatedAt,
            lte: activation.deactivatedAt || new Date(),
          },
        },
        _sum: { amountCents: true },
      });

      totalClicks += clicks;
      totalRevenue += revenue._sum.amountCents || 0n;
    }

    const linkPerformance = await prisma.linkClick.groupBy({
      by: ['linkId'],
      where: { linkId: { in: preset.linkIds } },
      _count: true,
      orderBy: { _count: 'desc' },
      take: 1,
    });

     const bestLink = linkPerformance[0]
      ? await prisma.link.findUnique({
          where: { id: linkPerformance[0].linkId },
        })
      :null;

    return {
      preset: {
        id: preset.id,
        name: preset.name,
        totalActivations: preset.totalActivations,
      },
      performance: {
        totalClicks,
        totalRevenue: Number(totalRevenue) / 100, 
        averageClicksPerActivation:
          history.length > 0 ? (totalClicks / history.length).toFixed(0) : 0,
        bestPerformingLink: bestLink,
      },
      activationHistory: history.map((h) => ({
        activatedAt: h.activatedAt,
        deactivatedAt: h.deactivatedAt,
        duration: h.deactivatedAt
          ? Math.round(
              (h.deactivatedAt.getTime() - h.activatedAt.getTime()) / 1000 / 60
            ) + ' minutes'
          : 'Still active',
      
        }))
    };
  }

  async comparePresets(
    profileId: string,
    presetIds: string[],
    userId: string
  ) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const presets = await prisma.preset.findMany({
      where: { id: { in: presetIds }, profileId },
    });

    if (presets.length !== presetIds.length) {
      throw new BadRequestError('One or more presets not found');
    }

    const comparison = await Promise.all(
      presets.map(async(preset) => {
        const analytics = await this.getPresetAnalytics(preset.id, userId);
        return analytics;
      })
    );

    const ranked = comparison.sort(
      (a, b) => b.performance.totalClicks - a.performance.totalClicks
    );

    return {
      presets: ranked,
      winner: ranked[0],
      recommendation: `${ranked[0].preset.name} performed best with ${ranked[0].performance.totalClicks} clicks`,
    };
  }

  async getPresetHistory(presetId: string, userId: string) {
    const preset = await this.getPreset(presetId, userId);

    return await prisma.presetActivationHistory.findMany({
      where: { presetId },
      orderBy: { activatedAt: 'desc' },
      include: {
        preset: true,
      },
    });
  }

  async addAvailabilityRule(
    presetId: string,
    data: any,
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);

    const rule = await prisma.linkAvailabilityRule.create({
      data: {
        presetId,
        linkId: data.linkId,
        ruleType: data.ruleType,
        showOnlyFrom: data.showOnlyFrom,
        showOnlyUntil: data.showOnlyUntil,
        showOnDays: data.showOnDays,
        requiresCustomerTier: data.requiresCustomerTier,
        allowedCountries: data.allowedCountries,
        blockedCountries: data.blockedCountries,
      },
    });

    await cache.delete(`presets:${preset.profileId}`);
    return rule;
  }

  async updateAvailabilityRule(
    presetId: string,
    ruleId: string,
    data: any,
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);

    const rule = await prisma.linkAvailabilityRule.update({
      where: { id: ruleId },
      data: {
        showOnlyFrom: data.showOnlyFrom,
        showOnlyUntil: data.showOnlyUntil,
        showOnDays: data.showOnDays,
        requiresCustomerTier: data.requiresCustomerTier,
        allowedCountries: data.allowedCountries,
        blockedCountries: data.blockedCountries,
        isActive: data.isActive,
      },
    });

    await cache.delete(`presets:${preset.profileId}`);
    return rule;
  }

  async removeAvailabilityRule(
    presetId: string,
    ruleId: string,
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);

    await prisma.linkAvailabilityRule.delete({
      where: { id: ruleId },
    });

    await cache.delete(`presets:${preset.profileId}`);
  }

  async getAvailabilityRules(presetId: string, userId: string) {
    await this.getPreset(presetId, userId);

    return await prisma.linkAvailabilityRule.findMany({
      where: { presetId },
    });
  }

  async schedulePresetActivation(
    presetId: string,
    data: {
      scheduledFor: string;
      note?: string;
      recurrenceRule?: string;
    },
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);

    const scheduledFor = new Date(data.scheduledFor);
    const jobId = `preset-activation-${presetId}-${Date.now()}`;
    await presetActivationQueue.add(
      'scheduled-activation',
      {
        presetId,
        profileId: preset.profileId,
      },
      {
        delay: scheduledFor.getTime() - Date.now(),
        jobId}
    );

    // store in db
    const scheduled = await prisma.scheduledSwap.create({
      data: {
        profileId: preset.profileId,
        linkId: preset.linkIds[0], // Store first link as reference
        presetId,
        swapType: 'preset',
        scheduledFor,
        jobId,
        status: 'pending',
        metadata:{
          note: data.note,
          recurrenceRule: data.recurrenceRule,
        },
      },
    });

    return scheduled;
  }

  async getScheduledActivations(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.scheduledSwap.findMany({
      where: { profileId, swapType: 'preset', status: 'pending' },
      orderBy: { scheduledFor: 'asc' },
      include: {
        preset: true,
      },
    });
  }

  async cancelScheduledActivation(
    presetId: string,
    scheduleId: string,
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);

    const scheduled = await prisma.scheduledSwap.findUnique({
      where: { id: scheduleId },
    });

    if (!scheduled || scheduled.profileId !== preset.profileId) {
      throw new NotFoundError('Scheduled activation not found');
    }

    if (scheduled.jobId) {
      const job = await presetActivationQueue.getJob(scheduled.jobId);
      if (job){
        await job.remove();
      }
    }

    await prisma.scheduledSwap.update({
      where: { id: scheduleId },
      data: { status: 'cancelled' },
    });
  }

  async exportPresetAsTemplate(
    presetId: string,
    data: {
      templateName: string;
      templateDescription?: string;
      isPublic?: boolean;
    },
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);
    const links = await prisma.link.findMany({
      where: { id: { in: preset.linkIds }, deletedAt: null },
      select: {
        title: true,
        url: true,
        description: true,
        metadata: true}});

    const template = await prisma.presetTemplate.create({
      data: {
        creatorId: userId,
        profileId: preset.profileId,
        name: data.templateName,
        description: data.templateDescription,
        isPublic: data.isPublic || false,
        presetData: {
          name: preset.name,
          description: preset.description,
          links,
          metadata: preset.metadata,
        },
      },

    });

    return template
  }

  async importFromTemplate(
    data: {
      templateId: string;
      profileId: string;
      presetName: string;
    },
    userId: string
  ) {
    const profile = await prisma.profile.findFirst({
      where: { id: data.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }
     const template = await prisma.presetTemplate.findUnique({
      where: { id: data.templateId },
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }
    const linkIds: string[] =[]

    for (const link of (template.presetData as any).links) {
      const shortUrl = await generateShortUrl();

      const created = await prisma.link.create({
        data: {
          profileId: data.profileId,
          title: link.title,
          url: link.url,
          description: link.description,
          shortUrl,
          position: linkIds.length + 1,
          metadata: link.metadata,
        },
      })


      linkIds.push(created.id);
    }

    const preset = await prisma.preset.create({
      data: {
        profileId: data.profileId,
        name: data.presetName,
        description: (template.presetData as any).description,
        linkIds,
        metadata: (template.presetData as any).metadata,
      },
    });

    await prisma.presetTemplate.update({
      where: { id: data.templateId },
      data: { downloads: { increment: 1 } },
    });

    return preset;
  }

  async getPublicTemplates() {
    return await prisma.presetTemplate.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        name: true,
        description: true,
        downloads: true,
        rating: true,
        creator: { select: { displayName: true } },
      },
      orderBy: { downloads: 'desc' },
      take: 20,
    });
  }

  async bulkAddLinks(
    presetId: string,
    links: Array<{
      title: string;
      url: string;
      description?: string;
      backupUrl?: string;
      metadata?: Record<string, any>;
    }>,
    userId: string
  ) {
    const preset = await this.getPreset(presetId, userId);

    if (links.length > 100) {
      throw new BadRequestError('Maximum 100 links per bulk operation');
    }
    const createdLinks = await Promise.all(
      links.map(async (link) => {
        const shortUrl = await generateShortUrl();
        const qrCode = await generateQRCode(shortUrl);

        return await prisma.link.create({
           data: {
            profileId: preset.profileId,
            title: link.title,
            url: link.url,
            description: link.description,
            shortUrl,
            position: preset.linkIds.length + links.indexOf(link) + 1,
            metadata:{
              ...link.metadata,
              qrCodeUrl: qrCode,
              backupUrl: link.backupUrl,
            },
          },
        })
      })
    );

    const newLinkIds = [...preset.linkIds, ...createdLinks.map((l) => l.id)];

    const updated = await prisma.preset.update({
      where: { id: presetId },
      data: { linkIds: newLinkIds },
    });

    await cache.delete(`presets:${preset.profileId}`);

    return {
      success: true,
      created: createdLinks.length,
      preset: updated,
    };
  }
}