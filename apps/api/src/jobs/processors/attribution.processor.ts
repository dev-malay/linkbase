import { Job } from 'bull';
import { prisma } from '@linkbase/db';
import { cache } from '../../utils/cache';
import {
  stripeService,
  youtubeService,
  patreonService,
} from '../../integrations/attribution-services';
import { calculateLTV, detectFraud } from '../../utils/attribution-ml';

export async function processRevenue(job: Job) {
  const { revenueId, profileId, linkId } = job.data;

  // Fetch revenue record
  const revenue = await prisma.linkRevenue.findUnique({
    where: { id: revenueId },
  });

  if (!revenue) return;

  // Update customer LTV
  const customer = await prisma.customerLTV.findFirst({
    where: {
      linkId,
      customerId: revenue.customerId,
    },
  });

  if (customer) {
    const newTotal = customer.totalRevenue + revenue.amountCents;
    const estimatedLTV = calculateLTV(customer.firstPurchaseAmount, newTotal, customer.purchaseCount + 1);

    await prisma.customerLTV.update({
      where: { id: customer.id },
      data: {
        totalRevenue: newTotal,
        estimatedLTV,
        lastPurchaseDate: new Date(),
        purchaseCount: { increment: 1 },
      },
    });
  } else {
    const estimatedLTV = calculateLTV(
      revenue.amountCents,
      revenue.amountCents,
      1
    );

    await prisma.customerLTV.create({
      data: {
        linkId,
        profileId,
        customerId: revenue.customerId!,
        customerEmail: revenue.customerEmail,
        firstPurchaseDate: revenue.transactionDate,
        firstPurchaseAmount: revenue.amountCents,
        totalRevenue: revenue.amountCents,
        estimatedLTV,
      },
    });
  }

  // Invalidate cache
  await cache.delete(`revenue:${profileId}`);
}

export async function syncIntegration(job: Job) {
  const { profileId, service } = job.data;

  try{
    const config = await prisma.integrationConfig.findFirst({
      where: { profileId, service },
});

    if (!config) return;

    // Sync based on service
    let transactions: any[] = [];

    switch (service) {
      case 'stripe':
        transactions = await stripeService.getTransactions(config.accessToken!);
        break;
      case 'youtube':
        transactions = await youtubeService.getTransactions(config.accessToken!);
        break;
      case 'patreon':
        transactions = await patreonService.getTransactions(config.accessToken!);
        break;
    }

    // Process each transaction (would match to links and create revenue records)
    // ...

    // Update last synced time
    await prisma.integrationConfig.update({
      where: { id: config.id },
      data: { lastSyncedAt: new Date() },
    });
  } catch (error) {
    console.error('Integration sync error:', error);
  }
}

export async function detectFraudPatterns(job: Job) {
  const { profileId } = job.data;

  // Get recent clicks
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const recentClicks = await prisma.linkClick.findMany({
    where: {
      profileId,
      timestamp: { gte: thirtyMinutesAgo },
    },
  });

  // Group by link and check for fraud
  const clicksByLink: Record<string, any[]> = {};

  recentClicks.forEach((click) => {
    if (!clicksByLink[click.linkId]) {
      clicksByLink[click.linkId] = [];
    }
    clicksByLink[click.linkId].push(click);
  });

  for (const [linkId, clicks] of Object.entries(clicksByLink)) {
    const clicksPerSecond = clicks.length / 30; // 30-minute window

    if (clicksPerSecond > 10) {
      // Create fraud alert
      await prisma.fraudAlert.create({
        data: {
          profileId,
          linkId,
          alertType: 'bot_traffic',
          severity: 'high',
          description: `Detected ${clicksPerSecond.toFixed(1)} clicks/second (normal is < 1)`,
          evidence: {
            clicksPerSecond,
            sampleSize: clicks.length,
          },
        },
      });
    }
  }
}