import { prisma } from '@linkbase/db';

export class IntelligenceRepository {
  async getOptimization(profileId: string) {
    return await prisma.linkOptimization.findUnique({
      where: { profileId },
    });
  }

  async createOptimization(profileId: string) {
    return await prisma.linkOptimization.create({
      data: { profileId },
    });
  }

  async getClickPatterns(profileId: string) {
    return await prisma.clickPattern.findMany({
      where: { profileId },
      orderBy: { confidence: 'desc' },
    });
  }

  async createClickPattern(data: any) {
    return await prisma.clickPattern.create({ data });
  }

  async createLinkRanking(data: any) {
    return await prisma.linkRanking.create({ data });
  }

  async createOptimizationSuggestion(data: any) {
    return await prisma.optimizationSuggestion.create({ data });
  }

  async getABTest(testId: string) {
    return await prisma.linkOptimizationABTest.findUnique({
      where: { id: testId },
    });
  }
}