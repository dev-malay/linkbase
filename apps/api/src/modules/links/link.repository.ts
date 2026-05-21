import { prisma } from '@linkbase/db';

export class LinkRepository {
  async getLinksForProfile(profileId: string) {
    return await prisma.link.findMany({
      where: { profileId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        title: true,
        url: true,
        shortUrl: true,
        description: true,
        position: true,
        isActive: true,
        clickCount: true,
        revenueCents: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getLink(linkId: string) {
    return await prisma.link.findUnique({
      where: { id: linkId },
    });
  }

  async getLinksByProfileWithAnalytics(profileId: string) {
    return await prisma.link.findMany({
      where: { profileId, deletedAt: null },
      orderBy: { position: 'asc' },
      include: {
        clicks: {
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
            },
          },
          select: {
            id: true,
            timestamp: true,
            referrer: true,
            deviceType: true,
            country: true,
          },
        },
        revenue: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
          select: {
            amountCents: true,
          },
        },
      },
    });
  }

  async updateLinkPosition(linkId: string, position: number) {
    return await prisma.link.update({
      where: { id: linkId },
      data: { position },
    });
  }
}