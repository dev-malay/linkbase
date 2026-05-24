import { prisma } from '@linkbase/db';

export class TimeoutRepository {
  async getLinkTimeout(linkId: string) {
    return await prisma.linkTimeout.findUnique({
      where: { linkId },
      include: { fallbackLink: true },
    });
  }

  async getExpiredTimeouts() {
    return await prisma.linkTimeout.findMany({
      where: {
        isExpired: false,
        expiresAt: { lte: new Date() },
        isActive: true,
      },
    });
  }

  async getVisitorLimitReached() {
    return await prisma.linkTimeout.findMany({
      where: {
        timeoutType: 'visitor-count',
        isExpired: false,
        maxVisitorCount: { not: null },
      },
    });
  }

  async getRecurringTimeouts() {
    return await prisma.linkTimeout.findMany({
      where: {
        timeoutType: 'recurring',
        recurringRule: { not: null },
      },
    });
  }

  async createArchivedTimeout(data: any) {
    return await prisma.archivedLinkTimeout.create({ data });
  }

  async createTimeoutEvent(data: any) {
    return await prisma.timeoutExpirationEvent.create({ data });
  }
}