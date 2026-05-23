import { Job } from 'bull';
import { prisma } from '@linkbase/db';
import { cache } from '../../utils/cache';
import { IntelligenceService } from '../../modules/intelligence/intelligence.service';

interface IntelligenceJobData {
  profileId: string;
  type: 'analyze-clicks' | 'generate-suggestion' | 'apply-optimization' | 'track-ab-test';
}

const intelligenceService = new IntelligenceService();

export async function processIntelligenceJob(job: Job<IntelligenceJobData>) {
  const { profileId, type } = job.data;

  try {
    job.progress(10);

    switch (type) {
      case 'analyze-clicks':
        await analyzeClicks(profileId);
        break;

      case 'generate-suggestion':
        await generateSuggestion(profileId);
        break;

      case 'apply-optimization':
        await applyOptimization(profileId);
        break;

      case 'track-ab-test':
        await trackABTest(profileId);
        break;
    }

    job.progress(100);
    return { success: true };
  } catch (error) {
    console.error(`Intelligence job ${type} failed:`, error);
    throw error;
  }
}

async function analyzeClicks(profileId: string) {
  // Get clicks from last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const clicks = await prisma.linkClick.findMany({
    where: {
      profileId,
      timestamp: { gte: oneHourAgo },
    },
  });

  if (clicks.length < 10) {
    return; // Not enough data
  }

  // Analyze patterns
  const optimization = await prisma.linkOptimization.findUnique({
    where: { profileId },
  });

  if (!optimization) {
    return;
  }

  // Time of day pattern
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  const timeClicks: Record<string, number> = {};
  clicks.forEach((click) => {
    timeClicks[click.linkId] = (timeClicks[click.linkId] || 0) + 1;
  });

  // update or create pattern
  const topLink = Object.entries(timeClicks).sort((a, b) => b[1] - a[1])[0];

  await prisma.clickPattern.upsert({
    where: {
      optimizationId_patternType_dimension: {
        optimizationId: optimization.id,
        patternType: 'time-of-day',
        dimension: timeOfDay,
      },
    },
    create: {
      optimizationId: optimization.id,
      profileId,
      patternType: 'time-of-day',
      dimension: timeOfDay,
      linkPreferences: timeClicks,
      confidence: Math.min(clicks.length / 100, 1),
      sampleSize: clicks.length,
      topLinkId: topLink ? topLink[0] : undefined,
      topLinkScore: topLink ? topLink[1] : 0,
      insight: `${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)} audience clicks most on link ID: ${topLink?.[0]}`,
    },
    update: {
      linkPreferences: timeClicks,
      confidence: Math.min(clicks.length / 100, 1),
      sampleSize: clicks.length,
      topLinkId: topLink ? topLink[0] : undefined,
      topLinkScore: topLink ? topLink[1] : 0,
    },
  });

  // Invalidate cache
  await cache.delete(`learnings:${profileId}`);
}

async function generateSuggestion(profileId: string) {
  try {
    await intelligenceService.generateOptimizationSuggestion(profileId, ''); // Empty userId for background job
  } catch (error) {
    console.log('No suggestion generated (likely insufficient data)');
  }
}

async function applyOptimization(profileId: string) {
  // mark tge links with performance metrics
  const links = await prisma.link.findMany({
    where: { profileId, deletedAt: null },
    include: {
      clicks: {
        where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      },
      revenue: {
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      },
    },
  });

  // update click count and revenue
  for (const link of links) {
    await prisma.link.update({
      where: { id: link.id },
      data: {
        clickCount: link.clicks.length,
        revenueCents: link.revenue.reduce((sum, r) => sum + r.amountCents, 0n),
      },
    });
  }

  await cache.delete(`links:${profileId}`);
}

async function trackABTest(profileId: string) {
  const activeTest = await prisma.linkOptimizationABTest.findFirst({
    where: { profileId, status: 'running' },
  });

  if (!activeTest) {
    return}

  // Get recent clicks for this profile
  const recentClicks = await prisma.linkClick.findMany({
    where: {
      profileId,
      timestamp: { gte: activeTest.startedAt },
      linkId: { in: [...activeTest.controlRanking, ...activeTest.variantRanking] },
    },
  });

  // Split based on AB test config
  const splitIndex = Math.floor(
    (activeTest.splitPercentage / 100) * recentClicks.length
  );

  const controlClicks = recentClicks.slice(0, splitIndex);
  const variantClicks = recentClicks.slice(splitIndex);

  // calculate metrics
  const controlLinkClicks: Record<string, number> = {};
  const variantLinkClicks: Record<string, number> = {};

  controlClicks.forEach((click) => {
    controlLinkClicks[click.linkId] = (controlLinkClicks[click.linkId] || 0) + 1;
  });

  variantClicks.forEach((click) =>{
    variantLinkClicks[click.linkId] = (variantLinkClicks[click.linkId] || 0) + 1;
  });

  const controlCTR = controlClicks.length > 0 ? controlClicks.length / 1000 : 0;
  const variantCTR = variantClicks.length > 0 ? variantClicks.length / 1000 : 0;

  // update test results
  await prisma.linkOptimizationABTest.update({
    where: { id: activeTest.id },
    data: {
      controlClicks: controlClicks.length,
      variantClicks: variantClicks.length,
      controlCTR,
      variantCTR},
  });

  // Check if we should autoend the test
  if (
    controlClicks.length + variantClicks.length >=
    activeTest.minSampleSize
  ) {
    await prisma.linkOptimizationABTest.update({
      where: { id: activeTest.id },
      data: {
        status: 'completed',
        endedAt: new Date(),
      },
    })}
    
}