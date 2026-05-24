import { prisma } from '@linkbase/db';

export class AttributionRepository {
  async getIntegrationConfigs(profileId: string) {
    return await prisma.integrationConfig.findMany({
      where: { profileId, isActive: true },
    });
  }

  async getLinkRevenue(linkId: string, dateFrom: Date) {
    return await prisma.linkRevenue.findMany({
      where: {
        linkId,
        transactionDate: { gte: dateFrom },
      },
    });
  }

  async getCustomerLTV(profileId: string) {
    return await prisma.customerLTV.findMany({
      where: { profileId },
    });
  }

  async createRevenueMetrics(data: any) {
    return await prisma.linkRevenueMetrics.create({ data });
  }

  async updateRevenueMetrics(id: string, data: any) {
    return await prisma.linkRevenueMetrics.update({
      where: { id },
      data,
    });
  }
}