import { prisma } from '@linkbase/db';
import { IntelligenceRepository } from './intelligence.repository';
import { linkOptimizationQueue } from '../../jobs/queues';
import { emitLinkOptimized } from '../../events/link-optimized.event';
import { cache } from '../../utils/cache';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { calculateStatisticalSignificance } from '../../utils/statistics';
import { generateOptimalRanking } from '../../utils/ranking-algorithm';

export class IntelligenceService {
  private repository: IntelligenceRepository;

  constructor() {
    this.repository = new IntelligenceRepository();
  }
// optimization settings 

  async getOptimizationSettings(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    let optimization = await prisma.linkOptimization.findUnique({
      where: { profileId },
    });

    // Create default if doesn't exist
    if (!optimization) {
      optimization = await prisma.linkOptimization.create({
        data: {
          profileId,
          isAutoOptimizeEnabled: true,
          optimizationFrequency: 'hourly',
          confidenceThreshold: 100,
          requiresApproval: false,
        },
      });
    }

    return optimization;
  }

  async updateOptimizationSettings(
    profileId: string,
    data: any,
    userId: string
  ) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Get or create settings
    let optimization = await prisma.linkOptimization.findUnique({
      where: { profileId },
    });

    if (!optimization) {
      optimization = await prisma.linkOptimization.create({
        data: { profileId },
      });
    }

    // Update
    const updated = await prisma.linkOptimization.update({
      where: { profileId },
      data: {
        isAutoOptimizeEnabled: data.isAutoOptimizeEnabled !== undefined
          ? data.isAutoOptimizeEnabled
          : optimization.isAutoOptimizeEnabled,
        optimizationFrequency: data.optimizationFrequency || optimization.optimizationFrequency,
        confidenceThreshold: data.confidenceThreshold !== undefined
          ? data.confidenceThreshold
          : optimization.confidenceThreshold,
        requiresApproval: data.requiresApproval !== undefined
          ? data.requiresApproval
          : optimization.requiresApproval,
        seasonalAdjustmentEnabled: data.seasonalAdjustmentEnabled !== undefined
          ? data.seasonalAdjustmentEnabled
          : optimization.seasonalAdjustmentEnabled,
      },
    });

    await cache.delete(`optimization-settings:${profileId}`);
    return updated}

  async toggleAutoOptimize(profileId: string, userId: string) {
    const optimization = await this.getOptimizationSettings(profileId, userId);

    const updated = await prisma.linkOptimization.update({
      where: { profileId },
      data: { isAutoOptimizeEnabled: !optimization.isAutoOptimizeEnabled },
    });

    await cache.delete(`optimization-settings:${profileId}`);
    return updated;
  }

// pattern detectionn and learnings 

  async getDetectedPatterns(
    profileId: string,
    userId: string,
    patternType?: string
  ){
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const where: any = { profileId };
    if (patternType){
      where.patternType = patternType}

    return await prisma.clickPattern.findMany({
      where,
      orderBy: {confidence:'desc'},
    });
  }

  async getPatternDetails(
    profileId: string,
    patternType: string,
    dimension: string,
    userId: string ){
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const pattern = await prisma.clickPattern.findUnique({
      where: {
        optimizationId_patternType_dimension: {
          optimizationId: (await this.getOptimizationSettings(profileId, userId)).id,
          patternType,
          dimension,
        },
      },
    });

    if (!pattern) {
      throw new NotFoundError('Pattern not found');
    }

    return pattern;
  }

  async getLearningsDashboard(profileId: string, userId: string){
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile){
      throw new NotFoundError('Profile not found');
}

    const cacheKey = `learnings:${profileId}`;
    const cached = await cache.get(cacheKey);
     if (cached) return JSON.parse(cached)

    const optimization = await this.getOptimizationSettings(profileId, userId);

    // get top patterns
    const topPatterns = await prisma.clickPattern.findMany({
      where: { profileId },
      orderBy: { confidence: 'desc' },
      take: 10,
    });

    // get recent optimizations
    const recentRankings = await prisma.linkRanking.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // calculate insights
    const insights = topPatterns
      .filter((p) => p.insight)
      .map((p) => ({
        type: p.patternType,
        dimension: p.dimension,
        insight: p.insight,
        confidence: (p.confidence * 100).toFixed(0) + '%',
        sampleSize: p.sampleSize,
      }));

    // get current optimal ranking
    const currentLinks = await prisma.link.findMany({
      where: { profileId, deletedAt: null },
      select: {
        id: true,
        title: true,
        position: true,
        clickCount: true,
        revenueCents: true,
      },
    });

    const dashboard = {
      isAutoOptimizeEnabled: optimization.isAutoOptimizeEnabled,
      optimizationFrequency: optimization.optimizationFrequency,
      confidenceThreshold: optimization.confidenceThreshold,
      totalPatternsDetected: topPatterns.length,
      topInsights: insights,
      recentOptimizations: recentRankings.map((r) => ({
        appliedAt: r.appliedAt,
        reason: r.reason,
        confidence: (r.confidence * 100).toFixed(0) + '%',
        clicksAfter: r.clicksAfterApplied,
      })),
      currentRanking: currentLinks.sort((a, b) => a.position - b.position),
    };

    await cache.set(cacheKey, JSON.stringify(dashboard), 300);
    return dashboard;
  }

   // optimization suggestions 

  async generateOptimizationSuggestion(profileId: string, userId: string) {
    const optimization = await this.getOptimizationSettings(profileId, userId);

    // Get recent clicks (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const clicks = await prisma.linkClick.findMany({
      where: {
        profileId,
        timestamp: { gte: sevenDaysAgo },
      },
      select: {
        linkId: true,
        timestamp: true},
    });

    if (clicks.length < optimization.minimalClicksForReorder) {
      return null; // Not enough data
    }

    // Calculate click distribution per link
    const clickCounts: Record<string, number> = {};
    clicks.forEach((click) => {
      clickCounts[click.linkId] = (clickCounts[click.linkId] || 0) + 1;
    })

    // Get current ranking
    const currentLinks = await prisma.link.findMany({
      where: { profileId, deletedAt: null },
      orderBy: { position: 'asc' },
    });

    // Generate optimal ranking
    const optimalRanking = Object.entries(clickCounts)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    // Add links not in recent clicks
    const currentRankingIds = currentLinks.map((l) => l.id);
    const missingLinks = currentRankingIds.filter((id) => !optimalRanking.includes(id));
    const suggestedRanking = [...optimalRanking, ...missingLinks];

    // Calculate projected impact
    const currentClicks = clicks.length;
    const projectedClicks = clicks.length * 1.2; // Estimate 20% improvement
    const projectedGain = Math.round(projectedClicks - currentClicks);

    // Get confidence score
    const confidence = Math.min(clicks.length / optimization.confidenceThreshold, 1);

    // Check if this is significantly different from current ranking
    const isSuggestingChange =
      JSON.stringify(suggestedRanking) !== JSON.stringify(currentRankingIds);

    if (!isSuggestingChange) {
      return null; // No change needed
    }

    // create the suggestion
    const suggestion = await prisma.optimizationSuggestion.create({
      data: {
        optimizationId: optimization.id,
        profileId,
        suggestedRanking,
        reason: `Based on click patterns from the last 7 days`,
        projectedClickGain: projectedGain,
        confidence,
        currentRankingClicks: currentClicks,
        suggestedRankingClicks: projectedClicks,
      },
    });

    return suggestion;
  }

  async getPendingSuggestions(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.optimizationSuggestion.findMany({
      where: { profileId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSuggestion(suggestionId: string, userId: string) {
    const suggestion = await prisma.optimizationSuggestion.findUnique({
      where: { id: suggestionId },
      include: { profile: true },
    });

    if (!suggestion) {
      throw new NotFoundError('Suggestion not found');
    }

    const profile = await prisma.profile.findFirst({
      where: { id: suggestion.profileId, userId }});

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    return suggestion
  }

  async approveSuggestion(suggestionId: string, userId: string) {
    const suggestion = await this.getSuggestion(suggestionId, userId);

    // Get optimization
    const optimization = await prisma.linkOptimization.findUnique({
      where: { id: suggestion.optimizationId },
    });

    if (!optimization) {
      throw new NotFoundError('Optimization not found');
    }

    // Create ranking record
    const ranking = await prisma.linkRanking.create({
      data: {
        optimizationId: suggestion.optimizationId,
        profileId: suggestion.profileId,
        ranking: suggestion.suggestedRanking,
        reason: 'auto-optimize',
        confidence: suggestion.confidence,
        appliedAt: new Date(),
      },
    });

    // Apply the ranking (update link positions)
    await prisma.$transaction(
      suggestion.suggestedRanking.map((linkId, index) =>
        prisma.link.update({
          where: { id: linkId },
          data: { position: index + 1 },
        })
      )
    );

    // Update suggestion status
    await prisma.optimizationSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'approved',
        appliedAt: new Date(),
        approvedAt: new Date(),
      },
 })

    // Update optimization current ranking
    await prisma.linkOptimization.update({
      where: { id: suggestion.optimizationId },
      data: { currentOptimalRanking: suggestion.suggestedRanking },
    });

    // Queue job for async processing
    await linkOptimizationQueue.add('apply-optimization', {
      profileId: suggestion.profileId,
      rankingId: ranking.id,
    });

    // invalidate caches
    await cache.delete(`learnings:${suggestion.profileId}`);
    await cache.delete(`links:${suggestion.profileId}`);

    // Emit event
    emitLinkOptimized({
      type: 'optimization_applied',
      profileId: suggestion.profileId,
      rankingId: ranking.id,
      timestamp: new Date(),
    });

    return {
      success: true,
      ranking,
      message: 'Optimization applied',
    }}


  async rejectSuggestion(suggestionId: string, reason: string | undefined, userId: string){
    const suggestion = await this.getSuggestion(suggestionId, userId);

    await prisma.optimizationSuggestion.update({
      where: { id: suggestionId },
       data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    })}

     // ranking history 

  async getRankingHistory(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.linkRanking.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getRankingPerformance(profileId: string, rankingId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const ranking = await prisma.linkRanking.findFirst({
      where: { id: rankingId, profileId },
    });

    if (!ranking) {
      throw new NotFoundError('Ranking not found');
    }

    // Get links in this ranking with performance data
    const links = await prisma.link.findMany({
      where: { id: { in: ranking.ranking }, deletedAt: null },
      include: {
        clicks: {
          where: {
            timestamp: {
              gte: ranking.appliedAt || new Date(Date.now() - 24 * 60 * 60 * 1000),
              lte: ranking.endedAt || new Date(),
            },
          },
        },
        revenue: {
          where: {
            createdAt: {
              gte: ranking.appliedAt || new Date(Date.now() - 24 * 60 * 60 * 1000),
              lte: ranking.endedAt || new Date(),
            },
          },
        },
      },
    });

    // Reorder to match ranking order
    const orderedLinks = ranking.ranking
      .map((linkId) => links.find((l) => l.id === linkId))
      .filter((l) => l !== undefined);

    return {
      ranking,
      links: orderedLinks.map((link) => ({
        id: link!.id,
        title: link!.title,
        clicks: link!.clicks.length,
        revenue: link!.revenue.reduce((sum, r) => sum + r.amountCents, 0n),
        ctr: ((link!.clicks.length / 1000) * 100).toFixed(2) + '%',
      })),
    };
  }

  async compareRankings(
    profileId: string,
    rankingId1: string,
    rankingId2: string,
    userId: string
  ){
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const ranking1 = await prisma.linkRanking.findFirst({
      where: { id: rankingId1, profileId }})

    const ranking2 = await prisma.linkRanking.findFirst({
      where: { id: rankingId2, profileId }});

     if (!ranking1 || !ranking2) {
      throw new NotFoundError('One or both rankings not found');
    }

    return {
      ranking1: {
        ...ranking1,
        performanceMetrics: {
          clicks: ranking1.clicksAfterApplied,
          revenue: ranking1.revenueAfterApplied,
          ctr: ranking1.ctrAfterApplied,
        },
      },
      ranking2: {
        ...ranking2,
        performanceMetrics: {
          clicks: ranking2.clicksAfterApplied,
          revenue: ranking2.revenueAfterApplied,
          ctr: ranking2.ctrAfterApplied,
        },
      },
      winner:
        ranking2.clicksAfterApplied > ranking1.clicksAfterApplied
          ? 'ranking2'
          : 'ranking1',
      improvement: {
        clickDifference:
          ranking2.clicksAfterApplied - ranking1.clicksAfterApplied,
        revenueDifference:
          ranking2.revenueAfterApplied - ranking1.revenueAfterApplied,
        percentageImprovement: (
          ((ranking2.clicksAfterApplied - ranking1.clicksAfterApplied) /
            ranking1.clicksAfterApplied) *
          100
        ).toFixed(1) + '%',
      },
    };
  }

  async revertToRanking(rankingId: string, userId: string) {
    const ranking = await prisma.linkRanking.findUnique({
      where: { id: rankingId },
      include: { profile: true }})

    if (!ranking) {
      throw new NotFoundError('Ranking not found');
    }
    const profile = await prisma.profile.findFirst({
      where: { id: ranking.profileId, userId},
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    // Apply the ranking
    await prisma.$transaction(
      ranking.ranking.map((linkId, index) =>
        prisma.link.update({
          where: { id: linkId },
          data: { position: index + 1 },
        }))
    )

    // Invalidate cache
    await cache.delete(`links:${ranking.profileId}`);

    return { success: true, ranking };
  }
// ab testing 
  async startABTest(
    profileId: string,
    variantRanking: string[],
    splitPercentage: number = 50,
    minSampleSize: number = 500,
    userId: string){
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId }});

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }
    const currentLinks = await prisma.link.findMany({
      where: { profileId, deletedAt: null },
      orderBy: { position: 'asc' },
    });

    const controlRanking = currentLinks.map((l) => l.id);
    const test = await prisma.linkOptimizationABTest.create({
      data: {
        profileId,
        name: `A/B Test - ${new Date().toLocaleDateString()}`,
        controlRanking,
        variantRanking,
        splitPercentage,
        minSampleSize,
      },
    });

    // Store in cache for fast access during reqs
    await cache.set(
      `ab-test:${profileId}`,
      JSON.stringify({
        testId: test.id,
        controlRanking,
        variantRanking,
        splitPercentage,
      }),
      3600
    );

    return test;
  }

  async getABTestStatus(testId: string, userId: string) {
    const test = await prisma.linkOptimizationABTest.findUnique({
      where: { id: testId },
      include: { profile: true },
    });

    if (!test) {
      throw new NotFoundError('A/B test not found');
    }
    const profile = await prisma.profile.findFirst({
      where: { id: test.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }
    const totalClicks = test.controlClicks + test.variantClicks;
    const progress = Math.round((totalClicks / test.minSampleSize) * 100);

    return {
      ...test,
      progress: Math.min(progress, 100),
      isComplete: totalClicks >= test.minSampleSize,
      sampleSizeRemaining: Math.max(0, test.minSampleSize - totalClicks),
    };
  }

  async getActiveABTests(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found')}
    return await prisma.linkOptimizationABTest.findMany({
      where: { profileId, status: 'running' }})
    
    }

  async endABTest(testId: string, userId: string) {
    const test = await this.getABTestStatus(testId, userId);

    // determine winner based on CTR
    let winner: 'control' | 'variant' | 'tie' = 'tie';
    if (test.controlCTR > test.variantCTR) {
      winner = 'control';
    } else if (test.variantCTR > test.controlCTR) {
      winner = 'variant';
    }

    // Calculate p-value (simple chi-square)
    const pValue = calculateStatisticalSignificance(
      test.controlClicks,
      test.variantClicks,
      test.controlCTR,
      test.variantCTR
    );

    const updated = await prisma.linkOptimizationABTest.update({
      where: { id: testId },
      data: {
        status: 'completed',
        endedAt: new Date(),
        winner,
        pValue,
      },
    });

    // clearcache
    await cache.delete(`ab-test:${test.profileId}`);

    return updated;
  }

  async getABTestResults(testId: string, userId: string){
    const test = await this.getABTestStatus(testId, userId);

    return {
      test,
      results: {
        controlPerformance: {
          clicks: test.controlClicks,
          ctr: (test.controlCTR * 100).toFixed(2) + '%',
          revenue: test.controlRevenue,
        },
        variantPerformance: {
          clicks: test.variantClicks,
          ctr: (test.variantCTR * 100).toFixed(2) + '%',
          revenue: test.variantRevenue},
        winner: test.winner,
         isSignificant: test.pValue && test.pValue < 0.05,
         confidence: test.pValue ? ((1 - test.pValue) * 100).toFixed(1) + '%' : 'N/A',
      },
    };
  }

  async applyABTestWinner(testId: string, userId: string) {
    const test = await this.getABTestStatus(testId, userId);

    if (test.status !== 'completed') {
      throw new BadRequestError('A/B test is still running');
    }

    // get win ranking
    const winningRanking =
      test.winner === 'variant' ? test.variantRanking : test.controlRanking;

    // apply win ranking
    await prisma.$transaction(
      winningRanking.map((linkId, index) =>
        prisma.link.update({
          where: { id: linkId },
          data: { position: index + 1 },
        })
      )
    );

    // Update test status
    await prisma.linkOptimizationABTest.update({
      where: { id: testId },
      data: { status: 'winner_selected' },
    });

    await cache.delete(`links:${test.profileId}`)
    return {
      success: true,
      winner: test.winner,
      ranking: winningRanking}
  }

// analytics and sights 

  async getLinkLeaderboard(profileId: string, userId: string, days: number = 7){
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const links = await prisma.link.findMany({
      where: { profileId, deletedAt: null },
      include: {
        clicks: {
          where: { timestamp: { gte: dateFrom } },
        },
        revenue: {
          where: { createdAt: { gte: dateFrom } },
        },
      },
    });

    // Calculate metrics and sort
    const leaderboard = links
      .map((link) => ({
        id: link.id,
        title: link.title,
        position: link.position,
        clicks: link.clicks.length,
        ctr: ((link.clicks.length / 1000) * 100).toFixed(2) + '%',
        revenue: Number(link.revenue.reduce((sum, r) => sum + r.amountCents, 0n)) / 100,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    return leaderboard;
  }

  async getOptimizationImpact(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Get all rankings
    const rankings = await prisma.linkRanking.findMany({
      where: { profileId },
      orderBy: { appliedAt: 'desc' },
      take: 10,
    });

    // Calculate impact
    let totalClicksImprovement = 0;
    let totalRevenueImprovement = 0n;

    for (let i = 0; i < rankings.length - 1; i++) {
      const current = rankings[i];
      const previous = rankings[i + 1];

      if (current.appliedAt && previous.appliedAt) {
        totalClicksImprovement += current.clicksAfterApplied - previous.clicksAfterApplied;
        totalRevenueImprovement +=
          current.revenueAfterApplied - previous.revenueAfterApplied;
      }
    }

    return {
      totalOptimizationsApplied: rankings.length,
      totalClicksGained: totalClicksImprovement,
      totalRevenueGained: Number(totalRevenueImprovement) / 100,
      percentageImprovement: rankings.length > 0
        ? (
            (totalClicksImprovement /
              rankings[rankings.length - 1].clicksAfterApplied) *
            100
          ).toFixed(1) + '%'
        : 'N/A',
    };
  }

  async predictRankingForCampaign(
    profileId: string,
    season?: string,
    timeframe?: string,
    userId?: string
  ) {
    if (userId) {
      const profile = await prisma.profile.findFirst({
        where: { id: profileId, userId },
      });

      if (!profile) {
        throw new NotFoundError('Profile not found');
      }
    }

    // Get historical data for season
    const patterns = await prisma.clickPattern.findMany({
      where: {
        profileId,
        ...(season && { dimension: season }),
      },
      orderBy: { confidence: 'desc' },
    });

    if (patterns.length === 0) {
      throw new BadRequestError('No historical data for this season');
    }

    // Generate predictive ranking from patterns
    const linkScores: Record<string, number> = {};

    patterns.forEach((pattern) => {
      const prefs = pattern.linkPreferences as Record<string, number>;
      Object.entries(prefs).forEach(([linkId, score]) => {
        linkScores[linkId] = (linkScores[linkId] || 0) + score;
      });
    });

    const predictedRanking = Object.entries(linkScores)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    return {
      predictedRanking,
      basis: `Based on ${season || 'historical'} data`,
      confidence: patterns[0]?.confidence || 0.5,
      patterns: patterns.map((p) => ({
        type: p.patternType,
        dimension: p.dimension,
        insight: p.insight,
      })),
    };
  }
// manual overrides 
  async setOptimizationRule(profileId: string, data: any, userId: string) {
    // For now store rules in Linkoptimization metadata
    const optimization = await this.getOptimizationSettings(profileId, userId);

    const rules = (optimization.metadata as any)?.rules || [];

    rules.push({
      id: `rule-${Date.now()}`,
      type: data.type,
      linkId: data.linkId,
      targetLinkId: data.targetLinkId,
      reason: data.reason,
      createdAt: new Date(),
    });

    await prisma.linkOptimization.update({
      where: { profileId },
      data: {
        metadata: {
          ...optimization.metadata,
          rules,
        },
      },
    });

    return rules[rules.length - 1];
  }

  async getOptimizationRules(profileId: string, userId: string) {
    const optimization = await this.getOptimizationSettings(profileId, userId);
    return (optimization.metadata as any)?.rules || [];
  }

  async deleteOptimizationRule(profileId: string, ruleId: string, userId: string) {
    const optimization = await this.getOptimizationSettings(profileId, userId);
    const rules = (optimization.metadata as any)?.rules || [];

    const filtered = rules.filter((r: any) => r.id !== ruleId);

    await prisma.linkOptimization.update({
      where: { profileId },
      data: {
        metadata: {
          ...optimization.metadata,
          rules: filtered,
        },
      },
    });
  }
}