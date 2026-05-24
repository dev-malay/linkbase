import { prisma } from '@linkbase/db';

export class AudienceRepository {
  async getPersonalizationRules(profileId: string) {
    return await prisma.personalizationRule.findMany({
      where: { profileId, isActive: true },
      orderBy: { priority: 'desc' },
    });
  }

  async getCohorts(profileId: string, dateFrom: Date) {
    return await prisma.visitorCohort.findMany({
      where: {
        profileId,
        periodStartDate: { gte: dateFrom },
      },
      orderBy: { totalClicks: 'desc' },
    });
  }

  async getVisitorProfiles(profileId: string, limit: number) {
    return await prisma.visitorProfile.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getModel(profileId: string) {
    return await prisma.personalizationModel.findUnique({
      where: { profileId },
    });
  }

  async createModel(profileId: string) {
    return await prisma.personalizationModel.create({
      data: {
        profileId,
        lastTrainedAt: new Date(),
        featureWeights: {},
      },
    });
  }
}