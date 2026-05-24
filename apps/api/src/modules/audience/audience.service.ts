import { prisma } from '@linkbase/db';
import { AudienceRepository } from './audience.repository';
import { audiencePredictionQueue } from '../../jobs/queues';
import { cache } from '../../utils/cache';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { 
  extractVisitorProfile,
  computeVisitorHash,
  predictOptimalLinkOrder 
} from '../../utils/audience-ml';
import { geolocationService } from '../../integrations/geolocation';
import { calculateStatisticalSignificance } from '../../utils/statistics';

export class AudienceService {
  private repository: AudienceRepository;

  constructor() {
    this.repository = new AudienceRepository();
  }

//  core prediction engine 

  async getPredictedLinkOrder(
    profileId: string,
    visitorData: {
      sessionId: string;
      referrer?: string;
      country?: string;
      deviceType?: string;
      browser?: string;
      os?: string;
      customAttributes?: Record<string, any>;
    }
  ) {
    // Get profile
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { links: { where: { deletedAt: null }, orderBy: { position: 'asc' } } },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Check if personalization is enabled
    if (!profile.isPersonalizationEnabled) {
      // Return default order
      return {
        links: profile.links.map((l) => l.id),
        personalized: false,
      };
    }

    // Extract and enrich visitor profile
    let visitorProfile = await this.extractVisitorProfile(profileId, visitorData);

    // Get ml model predictions
    const model = await prisma.personalizationModel.findUnique({
      where: { profileId },
    });

    let mlPredictedOrder: string[] | null = null;
    if (model) {
      mlPredictedOrder = await this.getPredictionFromModel(
        profileId,
        visitorProfile
      );
    }

    // Apply personalization rules
    const rules = await prisma.personalizationRule.findMany({
      where: { profileId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    let appliedRules: string[] = [];
    let personalizationOrder: string[] | null = null;

    for (const rule of rules) {
      if (this.matchesRule(visitorProfile, rule)) {
        personalizationOrder = rule.linkOrder;
        appliedRules.push(rule.id);

        // Update rule application count
        await prisma.personalizationRule.update({
          where: { id: rule.id },
          data: {
            applicationsCount: { increment: 1 },
            lastAppliedAt: new Date(),
          },
        });

        break; // First matching rule wins
      }
    }

    // Final order: manual rules > ml predictions > default
    const finalOrder = personalizationOrder || mlPredictedOrder || profile.links.map((l) => l.id);

    // Store visitor profile with prediction
    await prisma.visitorProfile.create({
      data: {
        profileId,
        sessionId: visitorData.sessionId,
        referrer: visitorProfile.referrer,
        country: visitorProfile.country,
        city: visitorProfile.city,
        deviceType: visitorProfile.deviceType,
        browser: visitorProfile.browser,
        os: visitorProfile.os,
        timeOfDay: visitorProfile.timeOfDay,
        dayOfWeek: visitorProfile.dayOfWeek,
        hour: visitorProfile.hour,
        isReturning: visitorProfile.isReturning,
        previousClickedLinks: visitorProfile.previousClickedLinks,
        lastVisitAt: visitorProfile.lastVisitAt,
        customAttributes: visitorData.customAttributes,
        predictedLinkOrder: finalOrder,
        appliedRules,
      },
    });

    // Queue cohort update
    await audiencePredictionQueue.add('update-cohorts', {
      profileId,
      visitorProfile,
    });

    return {
      links: finalOrder.map((linkId) => {
        const link = profile.links.find((l) => l.id === linkId);
        return {
          id: linkId,
          title: link?.title || 'Unknown',
          url: link?.url || '#',
          position: finalOrder.indexOf(linkId) + 1,
        };
      }),
      personalized: true,
      appliedRules,
      confidence: personalizationOrder ? 0.9 : mlPredictedOrder ? 0.6 : 0.5,
    };
  }

   // helper mthds

  private async extractVisitorProfile(
    profileId: string,
    visitorData: any
  ): Promise<any> {
    // Enrich with geolocation
    let geoData = null;
    if (visitorData.country) {
      geoData = {
        country: visitorData.country,
        city: visitorData.city,
      };
    }

    // Check if returning visitor
    const previousVisit = await prisma.visitorProfile.findFirst({
      where: {
        profileId,
        // Match by approximate criteria (simplified)
        referrer: visitorData.referrer,
        deviceType: visitorData.deviceType,
        country: visitorData.country,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    // Determine time of day
    const hour = new Date().getHours();
    let timeOfDay = 'morning';
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
    else if (hour >= 22 || hour < 6) timeOfDay = 'night';

    // Determine day of week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[new Date().getDay()];

    return {
      referrer: visitorData.referrer?.toLowerCase() || 'direct',
      country: visitorData.country,
      city: visitorData.city,
      deviceType: visitorData.deviceType || 'desktop',
      browser: visitorData.browser,
      os: visitorData.os,
      timeOfDay,
      dayOfWeek,
      hour,
      isReturning: !!previousVisit,
      previousClickedLinks: previousVisit?.previousClickedLinks || [],
      lastVisitAt: previousVisit?.createdAt,

    };
  }

  private matchesRule(visitorProfile: any, rule: any): boolean {
    const value = rule.conditionValue.toLowerCase();

    switch (rule.conditionType) {
      case 'referrer':
        return rule.matchExactly
          ? visitorProfile.referrer === value
          : visitorProfile.referrer.includes(value);

      case 'device':
        return visitorProfile.deviceType === value;

      case 'country':
        return visitorProfile.country === value.toUpperCase();

      case 'time':
        return visitorProfile.timeOfDay === value;

      case 'behavior':
        return value === 'returning' ? visitorProfile.isReturning : !visitorProfile.isReturning;

      case 'custom':
        // Implement custom matching logic
        return true;

      default:
        return false;
    }
  }

  private async getPredictionFromModel(
    profileId: string,
    visitorProfile: any
  ): Promise<string[] | null>{
    try {
      const model = await prisma.personalizationModel.findUnique({
        where: { profileId },
      });

      if (!model) return null;

      // In production, this would call actual ml model
      // For now return predictions based on learned patterns

      const patterns = await prisma.clickPattern.findMany({
        where: { profileId },
        orderBy: { confidence: 'desc' },
        take: 5,
      });

      if (patterns.length === 0) return null;



      // Build link scores based on patterns
      const linkScores: Record<string, number> = {};

      patterns.forEach((pattern) => {
        const prefs = pattern.linkPreferences as Record<string, number>;
        Object.entries(prefs).forEach(([linkId, score]) => {
          linkScores[linkId] = (linkScores[linkId] || 0) + score * pattern.confidence;
        });
      });

      // Return links sorted by score
      return Object.entries(linkScores)
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0]);
    } catch (error) {
      console.error('Model prediction error:', error);
      return null;
    }
  }

  // personalisation rules 

  async getPersonalizationRules(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.personalizationRule.findMany({
      where: { profileId },
      orderBy: { priority: 'desc' },
    });
  }

  async createPersonalizationRule(profileId: string, data: any, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Verify links exist
    const links = await prisma.link.findMany({
      where: { id: { in: data.linkOrder }, profileId, deletedAt: null },
    });

    if (links.length !== data.linkOrder.length) {
      throw new BadRequestError('One or more links not found')}

    const rule = await prisma.personalizationRule.create({
      data: {
        profileId,
        name: data.name,
        description: data.description,
        conditionType: data.conditionType,
        conditionValue: data.conditionValue,
        linkOrder: data.linkOrder,
        priority: data.priority || 100,
        matchExactly: data.matchExactly || false,
      },
    });

    // Clear the cache
    await cache.delete(`personalization-rules:${profileId}`);

    return rule;
  }

  async updatePersonalizationRule(
    profileId: string,
    ruleId: string,
    data: any,
    userId: string
  ) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const rule = await prisma.personalizationRule.findFirst({
      where: { id: ruleId, profileId },
    });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    // Verify links if updating linkorder
    if (data.linkOrder) {
      const links = await prisma.link.findMany({
        where: { id: { in: data.linkOrder }, profileId, deletedAt: null },
      });

      if (links.length !== data.linkOrder.length) {
        throw new BadRequestError('One or more links not found');
      }
    }

    const updated = await prisma.personalizationRule.update({
      where: { id: ruleId },
      data: {
        name: data.name || rule.name,
        description: data.description !== undefined ? data.description : rule.description,
        linkOrder: data.linkOrder || rule.linkOrder,
        priority: data.priority !== undefined ? data.priority : rule.priority,
        isActive: data.isActive !== undefined ? data.isActive : rule.isActive,
      },
    });

    await cache.delete(`personalization-rules:${profileId}`);
    return updated;
  }

  async deletePersonalizationRule(profileId: string, ruleId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const rule = await prisma.personalizationRule.findFirst({
      where: { id: ruleId, profileId },
    });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    await prisma.personalizationRule.delete({
      where: { id: ruleId },
    });

    await cache.delete(`personalization-rules:${profileId}`);
  }

  async reorderRules(profileId: string, rules: Array<{ ruleId: string; priority: number }>, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Update priorities
    await prisma.$transaction(
      rules.map((rule) =>
        prisma.personalizationRule.update({
          where: { id: rule.ruleId },
          data: { priority: rule.priority },
        })
      )
    );

    await cache.delete(`personalization-rules:${profileId}`);
    return { success: true, reordered: rules.length };
  }

  // cohort analysis 

  async getCohorts(profileId: string, userId: string, period?: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const dateFrom = period === 'week' 
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      : period === 'month'
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // default: day

    const cohorts = await prisma.visitorCohort.findMany({
      where: {
        profileId,
        periodStartDate: { gte: dateFrom },
      },
      orderBy: { totalClicks: 'desc' },
    });

    return cohorts.map((cohort) => ({
      ...cohort,
      improvementPercentage:
        cohort.ctrBeforePersonalization && cohort.ctrAfterPersonalization
          ? (
              ((cohort.ctrAfterPersonalization - cohort.ctrBeforePersonalization) /
                cohort.ctrBeforePersonalization) *
              100
            ).toFixed(1) + '%'
          : 'N/A',
    }));
  }

  async getCohortDetails(profileId: string, cohortId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const cohort = await prisma.visitorCohort.findFirst({
      where: { id: cohortId, profileId },
      include: {
        visitors: {
          select: {
            id: true,
            referrer: true,
            deviceType: true,
            clickedLinkId: true,
            clickedAt: true,
          },
        },
      },
    });

    if (!cohort) {
      throw new NotFoundError('Cohort not found');
    }

    return cohort;
  }

  async getCohortComparison(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const cohorts = await prisma.visitorCohort.findMany({
      where: { profileId },
      orderBy: { totalClicks: 'desc' },
      take: 10,
    });

    return {
      cohorts: cohorts.map((cohort) => ({
        name: cohort.cohortName,
        type: cohort.cohortType,
        value: cohort.cohortValue,
        visitors: cohort.totalVisitors,
        clicks: cohort.totalClicks,
        ctr: (cohort.ctr * 100).toFixed(2) + '%',
        revenue: Number(cohort.totalRevenue) / 100,
        improvement: cohort.improvementPercentage,
        topLink: cohort.topLinkId,
      })),
      bestPerformingCohort: cohorts[0]?.cohortName,
      avgCTR: (
        cohorts.reduce((sum, c) => sum + c.ctr, 0) / cohorts.length
      ).toFixed(2) + '%',
    };
  }

    // peresonalisation setings 

  async getPersonalizationSettings(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return {
      profileId,
      isPersonalizationEnabled: profile.isPersonalizationEnabled,
    };
  }

  async updatePersonalizationSettings(
    profileId: string,
    data: any,
    userId: string
  ) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const updated = await prisma.profile.update({
      where: { id: profileId },
      data: {
        isPersonalizationEnabled: data.isPersonalizationEnabled !== undefined
          ? data.isPersonalizationEnabled
          : profile.isPersonalizationEnabled,
      },
    });

    return {
      isPersonalizationEnabled: updated.isPersonalizationEnabled,
    };
  }

  async togglePersonalization(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const updated = await prisma.profile.update({
      where: { id: profileId },
      data: { isPersonalizationEnabled: !profile.isPersonalizationEnabled }});

    return { isPersonalizationEnabled: updated.isPersonalizationEnabled };
  }

// ml model 



  async getModelInfo(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    let model = await prisma.personalizationModel.findUnique({
      where: { profileId },
    });

    if (!model) {
      // Create default model
      model = await prisma.personalizationModel.create({
        data: {
          profileId,
          lastTrainedAt: new Date(),
          featureWeights: {},
        },
      });
    }

    return {
      version: model.version,
      accuracy: (model.accuracy * 100).toFixed(1) + '%',
      samplesUsed: model.samplesUsed,
      lastTrainedAt: model.lastTrainedAt,
      lastEvaluatedAt: model.lastEvaluatedAt,
    };
  }

  async retrainModel(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Queue model retraining job
    await audiencePredictionQueue.add('retrain-model', {
      profileId,
    });

    return {
      status: 'retraining',
      message: 'Model retraining queued',
    };
  }

  async getModelMetrics(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const model = await prisma.personalizationModel.findUnique({
      where: { profileId },
    });

    if (!model) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
      };
    }

    // In production, calculate actual metrics
    return {
      accuracy: (model.accuracy * 100).toFixed(1) + '%',
      precision: (Math.random() * 0.3 + 0.7).toFixed(2), // Placeholder
      recall: (Math.random() * 0.3 + 0.7).toFixed(2),
      f1Score: (Math.random() * 0.3 + 0.7).toFixed(2),
      samplesUsed: model.samplesUsed,
    };
  }

// visitior profiles 

  async getRecentVisitors(profileId: string, userId: string, limit: number = 50) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.visitorProfile.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        sessionId: true,
        referrer: true,
        country: true,
        deviceType: true,
        timeOfDay: true,
        isReturning: true,
        predictedLinkOrder: true,
        clickedLinkId: true,
        clickedAt: true,
        createdAt: true,
      },
    });
  }

  async getVisitorProfileDetails(profileId: string, visitorProfileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const visitor = await prisma.visitorProfile.findFirst({
      where: { id: visitorProfileId, profileId },
    });

    if (!visitor) {
      throw new NotFoundError('Visitor profile not found');
    }

    return visitor;
  }

// ab 

  async startABTest(profileId: string, data: any, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const test = await prisma.personalizationABTest.create({
      data: {
        profileId,
        cohortValue: data.cohortValue,
        orderA: data.orderA,
        orderB: data.orderB,
      },
    });

    // Cache test for fast lookup
    await cache.set(`ab-test:${profileId}:${data.cohortValue}`, JSON.stringify(test), 3600);

    return test;
  }

  async getActiveABTests(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.personalizationABTest.findMany({
      where: { profileId, status: 'running' },
    });
  }

  async getABTestResults(testId: string, userId: string) {
    const test = await prisma.personalizationABTest.findUnique({
      where: { id: testId },
      include: { profile: true },
    });

    if (!test) {
      throw new NotFoundError('A/B test not found');
    }

    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: test.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    return {
      test,
      results: {
        variantA: {
          clicks: test.variantAClicks,
          ctr: (test.variantACTR * 100).toFixed(2) + '%',
        },
        variantB: {
          clicks: test.variantBClicks,
          ctr: (test.variantBCTR * 100).toFixed(2) + '%',
        },
        winner: test.winner,
        isSignificant: test.isSignificant,
        confidence: test.pValue ? ((1 - test.pValue) * 100).toFixed(1) + '%' : 'N/A',
      },
    };
  }

  async endABTest(testId: string, userId: string) {
    const test = await prisma.personalizationABTest.findUnique({
      where: { id: testId },
      include: { profile: true },
    });

    if (!test) {
      throw new NotFoundError('A/B test not found');
    }

    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: test.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    // Determine winner
    let winner: 'A' | 'B' | null = null;
    if (test.variantACTR > test.variantBCTR) {
      winner = 'A';
    } else if (test.variantBCTR > test.variantACTR) {
      winner = 'B';
    }

    // Calculate p-value
    const pValue = calculateStatisticalSignificance(
      test.variantAClicks,
      test.variantBClicks,
      test.variantACTR,
      test.variantBCTR
    );

    const updated = await prisma.personalizationABTest.update({
      where: { id: testId },
      data: {
        status: 'completed',
        endedAt: new Date(),
        winner,
        pValue,
        isSignificant: pValue < 0.05,
      },
    });

    await cache.delete(`ab-test:${test.profileId}:${test.cohortValue}`);
    return updated;
  }

//  analytics and insights 

  async getPersonalizationImpact(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Compare cohort CTRs before and after personalization
    const cohorts = await prisma.visitorCohort.findMany({
      where: { profileId },
    });

    const cohortWithData = cohorts.filter(
      (c) => c.ctrBeforePersonalization && c.ctrAfterPersonalization
    );

    if (cohortWithData.length === 0) {
      return {
        status: 'collecting_data',
        message: 'Not enough data yet. Personalization is learning.',
      };
    }

    const avgImprovement =
      cohortWithData.reduce((sum, c) => {
        return (
          sum +
          (((c.ctrAfterPersonalization! - c.ctrBeforePersonalization!) /
            c.ctrBeforePersonalization!) *
            100)
        );
      }, 0) / cohortWithData.length;

    const totalClicksBefore = cohorts.reduce(
      (sum, c) => sum + (c.ctrBeforePersonalization ? c.totalClicks / c.ctrBeforePersonalization : 0),
      0
    );
    const totalClicksAfter = cohorts.reduce((sum, c) => sum + c.totalClicks, 0);

    return {
      avgCTRImprovement: avgImprovement.toFixed(1) + '%',
      estimatedClicksGained: Math.round(totalClicksAfter - totalClicksBefore),
      estimatedRevenueGained: cohorts.reduce(
        (sum, c) => sum + Number(c.totalRevenue),
        0
      ) / 100,
      cohortCount: cohortWithData.length,
      bestPerforming: cohortWithData.sort(
        (a, b) => (b.ctrAfterPersonalization || 0) - (a.ctrAfterPersonalization || 0)
      )[0]?.cohortName,
    };
  }

  async getAudienceInsights(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Get top referrers
    const topReferrers = await prisma.visitorProfile.groupBy({
      by: ['referrer'],
      where: { profileId },
      _count: true,
      orderBy: { _count: 'desc' },
      take: 5,
    });

    // Get top devices
    const topDevices = await prisma.visitorProfile.groupBy({
      by: ['deviceType'],
      where: { profileId },
      _count: true,
      orderBy: { _count: 'desc' },
    });

    // Get top countries
    const topCountries = await prisma.visitorProfile.groupBy({
      by: ['country'],
      where: { profileId },
      _count: true,
      orderBy: { _count: 'desc' },
      take: 5,
    });

    return {
      topReferrers: topReferrers.map((r) => ({
        name: r.referrer || 'Direct',
        visitors: r._count,
      })),
      deviceDistribution: topDevices.map((d) => ({
        device: d.deviceType || 'Unknown',
        count: d._count,
      })),
      topCountries: topCountries.map((c) => ({
        country: c.country || 'Unknown',
        visitors: c._count,
      })),
      returningVisitorRate:
        ((await prisma.visitorProfile.count({
          where: { profileId, isReturning: true },
        })) /
          (await prisma.visitorProfile.count({
            where: { profileId },
          }))) *
        100,
    };
  }

  async getCustomAttributesSetup(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Return available CRM integrations
    const integrations = await prisma.integration.findMany({
      where: { profileId, isConnected: true },
      select: {
        service: true,
        metadata: true,
      },
    });

    return {
      availableIntegrations: integrations.map((i) => ({
        service: i.service,
        isConfigured: !!i.metadata,
      })),
      supportedServices: ['stripe', 'mailchimp', 'custom_webhook'],
    };
  }

  async configureCustomAttributes(profileId: string, data: any, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Verify integration exists
    const integration = await prisma.integration.findFirst({
      where: { profileId, service: data.mappingType, isConnected: true },
    });

    if (!integration) {
      throw new NotFoundError('Integration not configured');
    }

    // Update integration with custom attribute config
    const updated = await prisma.integration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...integration.metadata,
          customAttributes: {
            [data.attributeName]: data.mappingConfig,
          },
        },
      },
    });

    return updated;
  }
}