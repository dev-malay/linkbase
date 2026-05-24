import { prisma } from '@linkbase/db';
import { AttributionRepository } from './attribution.repository';
import { attributionQueue } from '../../jobs/queues';
import { cache } from '../../utils/cache';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import {
  matchTransactionToLink,
  calculateCPCR,
  calculateLTV,
  detectFraud,
} from '../../utils/attribution-ml';
import {
  stripeService,
  youtubeService,
  patreonService,
  gumroadService,
  mailchimpService,
} from '../../integrations/attribution-services';

export class AttributionService {
  private repository: AttributionRepository;

  constructor() {
    this.repository = new AttributionRepository();
  }

// web hooks handlers

  async handleWebhook(profileId: string, source: string, payload: any) {
    try {
      // Log webhook
      const log = await prisma.webhookLog.create({
        data: {
          profileId,
          source,
          event: payload.type,
          requestBody: payload,
          status: 'pending',
        },
      });

      // Get profile's integration config
      const integration = await prisma.integrationConfig.findFirst({
        where: { profileId, service: source, isActive: true },
      });

      if (!integration) {
        throw new Error('Integration not configured');
      }

      // Process webhook based on source
      let transactionData = null;

      switch (source) {
        case 'stripe':
          transactionData = await this.processStripeWebhook(payload, integration);
          break;
        case 'patreon':
          transactionData = await this.processPatreonWebhook(payload, integration);
          break;
        case 'youtube':
          transactionData = await this.processYouTubeWebhook(payload, integration);
          break;
        case 'gumroad':
          transactionData = await this.processGumroadWebhook(payload, integration);
          break;
        case 'mailchimp':
          transactionData = await this.processMailchimpWebhook(payload, integration);
          break;
        default:
          transactionData = await this.processCustomWebhook(payload, integration);
      }

      if (!transactionData) {
        throw new Error('Could not process transaction');
      }

      // Match transaction to link
      const linkId = await matchTransactionToLink(
        profileId,
        transactionData,
        integration.attributionWindowDays
      );

      if (!linkId) {
        throw new Error('Could not attribute transaction to a link');
      }

      // Create revenue record
      const revenue = await prisma.linkRevenue.create({
        data: {
          linkId,
          profileId,
          transactionId: transactionData.transactionId,
          source,
          amountCents: transactionData.amountCents,
          currency: transactionData.currency || 'USD',
          attributionType: transactionData.attributionType || 'webhook',
          customerId: transactionData.customerId,
          customerEmail: transactionData.customerEmail,
          transactionDate: new Date(transactionData.transactionDate),
          metadata: transactionData.metadata,
        },
      });

      // Update webhook log
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          attributedLinkId: linkId,
          attributedRevenue: transactionData.amountCents,
        },
      });

      // Queue async processing
      await attributionQueue.add('process-revenue', {
        revenueId: revenue.id,
        profileId,
        linkId,
      });

      // Invalidate caches
      await cache.delete(`revenue:${profileId}`);
      await cache.delete(`revenue-link:${linkId}`);

      return {
        success: true,
        revenue,
        linkId,
      };
    } catch (error) {
      // Log error
      await prisma.webhookLog.update({
        where: { profileId, source, requestBody: payload },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  private async processStripeWebhook(payload: any, integration: any) {
    // Stripe webhook handling
    const event = payload.data.object;

    switch (payload.type) {
      case 'charge.succeeded':
        return {
          transactionId: event.id,
          amountCents: event.amount,
          currency: event.currency?.toUpperCase() || 'USD',
          customerId: event.customer,
          customerEmail: event.billing_details?.email,
          transactionDate: new Date(event.created * 1000),
          attributionType: 'webhook',
          metadata: {
            stripeChargeId: event.id,
            stripeCustomerId: event.customer,
          },
        };

      case 'payment_intent.succeeded':
        return {
          transactionId: event.id,
          amountCents: event.amount,
          currency: event.currency?.toUpperCase() || 'USD',
          customerId: event.customer,
          transactionDate: new Date(event.created * 1000),
          attributionType: 'webhook',
          metadata: {
            stripePaymentIntentId: event.id,
          },
        };

      default:
        return null;
    }
  }

  private async processPatreonWebhook(payload: any, integration: any) {
    // Patreon webhook handling
    const data = payload.data;

    if (payload.type === 'pledges:create') {
      return {
        transactionId: data.id,
        amountCents: Math.round(data.amount_cents),
        currency: 'USD',
        customerId: data.patron_id,
        transactionDate: new Date(data.created_at),
        attributionType: 'webhook',
        metadata: {
          patreonPledgeId: data.id,
          tier: data.tier_id,
        },
      };
    }

    return null;
  }

  private async processYouTubeWebhook(payload: any, integration: any) {
    // YouTube webhook handling
    // Would typically handle Super Chat, channel membership, etc.
    const data = payload.data;

    return {
      transactionId: data.transactionId,
      amountCents: data.amountMicros / 10000, // Convert micros to cents
      currency: data.currency,
      customerId: data.channelId,
      transactionDate: new Date(data.transactionTime),
      attributionType: 'webhook',
      metadata: {
        youtubeTransactionId: data.transactionId,
        type: data.type, // 'superChat', 'channelMembership', etc
      },
    };
  }

  private async processGumroadWebhook(payload: any, integration: any) {
    // Gumroad webhook handling
    const data = payload.data;

    return {
      transactionId: data.id,
      amountCents: Math.round(data.price * 100),
      currency: 'USD',
      customerId: data.purchaser_email,
      customerEmail: data.purchaser_email,
      transactionDate: new Date(data.created_at),
      attributionType: 'webhook',
      metadata: {
        gumroadProductId: data.product_id,
        productName: data.product_name,
      },
    };
  }

  private async processMailchimpWebhook(payload: any, integration: any) {
    // Mailchimp webhook handling (email signups)
    const data = payload.data;

    if (payload.type === 'subscribe') {
      return {
        transactionId: data.id,
        amountCents: 0, // Email signups are typically free
        currency: 'USD',
        customerEmail: data.email,
        transactionDate: new Date(),
        attributionType: 'webhook',
        metadata: {
          mailchimpListId: data.list_id,
          emailAddress: data.email,
        },
      };
    }

    return null;
  }

  private async processCustomWebhook(payload: any, integration: any) {
    // Generic webhook processing
    const config = integration.metadata as any;

    return {
      transactionId: payload.transactionId || payload.id,
      amountCents: payload.amountCents || 0,
      currency: payload.currency || 'USD',
      customerId: payload.customerId,
      customerEmail: payload.customerEmail,
      transactionDate: new Date(payload.transactionDate),
      attributionType: 'webhook',
      metadata: payload.metadata || {},
    };
  }

  // integrations

  async getIntegrations(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const configs = await prisma.integrationConfig.findMany({
      where: { profileId },
      select: {
        service: true,
        isActive: true,
        lastSyncedAt: true,
        metadata: true,
        createdAt: true,
      },
    });

    return configs;
  }

  async configureIntegration(profileId: string, data: any, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Validate token with third-party service
    let isValid = false;

    switch (data.service) {
      case 'stripe':
        isValid = await stripeService.validateToken(data.accessToken);
        break;
      case 'youtube':
        isValid = await youtubeService.validateToken(data.accessToken);
        break;
      case 'patreon':
        isValid = await patreonService.validateToken(data.accessToken);
        break;
      case 'gumroad':
        isValid = await gumroadService.validateToken(data.accessToken);
        break;
      case 'mailchimp':
        isValid = await mailchimpService.validateToken(data.accessToken);
        break;
      default:
        isValid = true;
    }

    if (!isValid) {
      throw new BadRequestError('Invalid credentials for this service');
    }

    // Upsert integration config
    const config = await prisma.integrationConfig.upsert({
      where: {
        profileId_service: { profileId, service: data.service },
      },
      create: {
        profileId,
        service: data.service,
        accessToken: data.accessToken,
        metadata: data.config || {},
      },
      update: {
        accessToken: data.accessToken,
        metadata: data.config || {},
        isActive: true,
      },
    });

    // Queue initial sync
    await attributionQueue.add('sync-integration', {
      profileId,
      service: data.service,
    });

    return config;
  }

  async disconnectIntegration(profileId: string, service: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const config = await prisma.integrationConfig.findFirst({
      where: { profileId, service },
    });

    if (!config) {
      throw new NotFoundError('Integration not found');
    }

    await prisma.integrationConfig.update({
      where: { id: config.id },
      data: { isActive: false },
    });

    await cache.delete(`integrations:${profileId}`);
  }

  async getIntegrationStatus(profileId: string, service: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const config = await prisma.integrationConfig.findFirst({
      where: { profileId, service },
    });

    if (!config) {
      throw new NotFoundError('Integration not found');
    }

    return {
      service,
      isActive: config.isActive,
      lastSyncedAt: config.lastSyncedAt,
      syncFrequency: config.syncFrequency,
    };
  }

  async syncIntegration(profileId: string, service: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const config = await prisma.integrationConfig.findFirst({
      where: { profileId, service },
    });

    if (!config) {
      throw new NotFoundError('Integration not found');
    }

    // Queue sync job
    await attributionQueue.add('sync-integration', {
      profileId,
      service,
    });

    return { status: 'syncing', message: 'Integration sync queued' };
  }

  // rev dashboard

  async getRevenueByLink(profileId: string, userId: string, days: number = 30) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const cacheKey = `revenue:${profileId}:${days}`;
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get links with revenue
    const links = await prisma.link.findMany({
      where: { profileId, deletedAt: null },
      include: {
        revenue: {
          where: { transactionDate: { gte: dateFrom } },
        },
        clicks: {
          where: { timestamp: { gte: dateFrom } },
        },
      },
    });

    const revenueByLink = links.map((link) => {
      const totalRevenue = link.revenue.reduce((sum, r) => sum + r.amountCents, 0n);
      const clicks = link.clicks.length;
      const conversions = link.revenue.length;
      const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
      const cpcr = clicks > 0 ? Number(totalRevenue) / clicks / 100 : 0; // Convert to dollars

      return {
        linkId: link.id,
        title: link.title,
        position: link.position,
        clicks,
        conversions,
        totalRevenue: Number(totalRevenue) / 100, // Convert to dollars
        conversionRate: conversionRate.toFixed(2) + '%',
        cpcr: cpcr.toFixed(2),
        aov: conversions > 0 ? (Number(totalRevenue) / conversions / 100).toFixed(2) : '0',
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    await cache.set(cacheKey, JSON.stringify(revenueByLink), 300);
    return revenueByLink;
  }

  async getLinkRevenueDetails(profileId: string, linkId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const link = await prisma.link.findFirst({
      where: { id: linkId, profileId, deletedAt: null },
      include: {
        revenue: {
          orderBy: { transactionDate: 'desc' },
          take: 100,
        },
        clicks: {
          select: { timestamp: true },
        },
      },
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    // Calculate metrics
    const totalRevenue = link.revenue.reduce((sum, r) => sum + r.amountCents, 0n);
    const clicks = link.clicks.length;

    return {
      linkId,
      title: link.title,
      totalClicks: clicks,
      totalRevenue: Number(totalRevenue) / 100,
      conversionCount: link.revenue.length,
      conversionRate: clicks > 0 ? ((link.revenue.length / clicks) * 100).toFixed(2) + '%' : '0%',
      aov: link.revenue.length > 0 ? (Number(totalRevenue) / link.revenue.length / 100).toFixed(2) : '0',
      cpcr: clicks > 0 ? (Number(totalRevenue) / clicks / 100).toFixed(2) : '0',
      recentTransactions: link.revenue.slice(0, 10).map((r) => ({
        transactionId: r.transactionId,
        amount: Number(r.amountCents) / 100,
        source: r.source,
        date: r.transactionDate,
      })),
    };
  }

  async getClicksVsRevenue(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const links = await prisma.link.findMany({
      where: { profileId, deletedAt: null },
      include: {
        clicks: true,
        revenue: true,
      },
    });

    const comparison = links.map((link) => {
      const totalRevenue = link.revenue.reduce((sum, r) => sum + r.amountCents, 0n);
      const clicks = link.clicks.length;
      const clickPercentage = links.reduce((s) => s + s.clicks.length, 0) > 0
        ? ((clicks / links.reduce((s) => s + s.clicks.length, 0)) * 100).toFixed(1)
        : '0';
      const revenuePercentage = links.reduce((s) => s + Number(s.revenue.reduce((sum, r) => sum + r.amountCents, 0n)), 0) > 0
        ? ((Number(totalRevenue) / links.reduce((s) => s + Number(s.revenue.reduce((sum, r) => sum + r.amountCents, 0n)), 0)) * 100).toFixed(1)
        : '0';

      return {
        linkId: link.id,
        title: link.title,
        clicks,
        revenue: Number(totalRevenue) / 100,
        clickPercentage: parseFloat(clickPercentage) + '%',
        revenuePercentage: parseFloat(revenuePercentage) + '%',
        efficiency: (Number(totalRevenue) / clicks / 100).toFixed(2),
      };
    });

    return comparison;
  }

  // cohort rev analysis

  async getCohortRevenue(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const cohorts = await prisma.cohortRevenueMetrics.findMany({
      where: { profileId },
      orderBy: { revenue: 'desc' },
    });

    return cohorts.map((cohort) => ({
      cohortType: cohort.cohortType,
      cohortValue: cohort.cohortValue,
      clicks: cohort.clicks,
      revenue: Number(cohort.revenue) / 100,
      conversions: cohort.conversions,
      conversionRate: cohort.conversionRate.toFixed(2) + '%',
      aov: Number(cohort.aov) / 100,
      newCustomers: cohort.newCustomers,
      avgCustomerLTV: cohort.totalCustomerLTV > 0
        ? (Number(cohort.totalCustomerLTV) / cohort.newCustomers / 100).toFixed(2)
        : '0',
    }))
 }

  async getCohortRevenueDetails(
    profileId: string,
    cohortType: string,
    cohortValue: string,
    userId: string
   ){
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const cohorts = await prisma.cohortRevenueMetrics.findMany({
      where: { profileId, cohortType, cohortValue },
      orderBy: { date: 'desc' },
      take: 30,
    });

    if (cohorts.length === 0) {
      throw new NotFoundError('No data for this cohort');
    }

    return {
      cohortType,
      cohortValue,
      data: cohorts.map((c) => ({
        date: c.date,
        clicks: c.clicks,
        revenue: Number(c.revenue) / 100,
        conversions: c.conversions,
        conversionRate: c.conversionRate.toFixed(2) + '%',
      })),
      summary: {
        totalClicks: cohorts.reduce((s, c) => s + c.clicks, 0),
        totalRevenue: cohorts.reduce((s, c) => s + Number(c.revenue), 0n) / 100n,
        avgConversionRate:
          (cohorts.reduce((s, c) => s + c.conversionRate, 0) / cohorts.length).toFixed(2) + '%',
      },
    };
  }

  // time base trends

  async getRevenueTrends(profileId: string, userId: string, days: number = 30) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const metrics = await prisma.linkRevenueMetrics.findMany({
      where: {
        profileId,
        date: { gte: dateFrom },
      },
      orderBy: { date: 'asc' },
    });

    // Aggregate by day
    const byDay: Record<string, any> = {};

    metrics.forEach((m) => {
      const dayKey = m.date.toISOString().split('T')[0];
      if (!byDay[dayKey]) {
        byDay[dayKey] = {
          date: dayKey,
          clicks: 0,
          revenue: 0n,
          conversions: 0,
        };
      }
      byDay[dayKey].clicks += m.clicks;
      byDay[dayKey].revenue += m.totalRevenue;
      byDay[dayKey].conversions += m.conversionCount;
    });

    return Object.values(byDay).map((d: any) => ({
      ...d,
      revenue: Number(d.revenue) / 100,
    }));
  }

  async getRevenueByTime(profileId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const metrics = await prisma.linkRevenueMetrics.findMany({
      where: { profileId },
    });

    // Aggregate by hr
    const byHour: Record<number, any> = {};

    for (let i = 0; i < 24; i++) {
      byHour[i] = {
        hour: i,
        clicks: 0,
        revenue: 0n,
        conversions: 0,
      };
    }

    metrics.forEach((m) => {
      byHour[m.hour].clicks += m.clicks;
      byHour[m.hour].revenue += m.totalRevenue;
      byHour[m.hour].conversions += m.conversionCount;
    });

    return Object.values(byHour).map((h: any) => ({
      ...h,
      revenue: Number(h.revenue) / 100,
      timeOfDay: h.hour < 12 ? 'morning' : h.hour < 17 ? 'afternoon' : h.hour < 22 ? 'evening' : 'night',
    }));
  }

  // ltv tracking

  async getLTVMetrics(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const customers = await prisma.customerLTV.findMany({
      where: { profileId },
    });

    if (customers.length === 0) {
      return {
        totalCustomers: 0,
        avgLTV: 0,
        totalLTV: 0,
        activeSubscribers: 0,
        churnRate: 0,
      };
    }

    const activeCustomers = customers.filter((c) => c.isActive).length;
    const totalLTV = customers.reduce((sum, c) => sum + c.estimatedLTV, 0n);
    const avgLTV = totalLTV / BigInt(customers.length);
    const churnedCustomers = customers.filter((c) => c.churnedAt).length;
    const churnRate = (churnedCustomers / customers.length) * 100;

    return {
      totalCustomers: customers.length,
      activeCustomers,
      avgLTV: Number(avgLTV) / 100,
      totalLTV: Number(totalLTV) / 100,
      activeSubscribers: customers.filter((c) => c.isSubscriber && c.isActive).length,
      churnRate: churnRate.toFixed(1) + '%',
      mrrTotal: customers.reduce((sum, c) => sum + c.monthlyRecurringRevenue, 0n),
    };
  }

  async getLinkLTV(profileId: string, linkId: string, userId: string) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const customers = await prisma.customerLTV.findMany({
      where: { linkId, profileId },
    });

    if (customers.length === 0) {
      return {
        linkId,
        averageLTV: 0,
        totalLTV: 0,
        customerCount: 0,
      };
    }

    const totalLTV = customers.reduce((sum, c) => sum + c.estimatedLTV, 0n);
    const avgLTV = totalLTV / BigInt(customers.length);

    return {
      linkId,
      averageLTV: Number(avgLTV) / 100,
      totalLTV: Number(totalLTV) / 100,
      customerCount: customers.length,
      avgPurchaseCount: (customers.reduce((sum, c) => sum + c.purchaseCount, 0) / customers.length).toFixed(1),
      subscriptionRate: ((customers.filter((c) => c.isSubscriber).length / customers.length) * 100).toFixed(1) + '%',
    };
  }

  // forecasting

  async getRevenueForecast(profileId: string, userId: string, days: number = 7) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Get historical data (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const historicalMetrics = await prisma.linkRevenueMetrics.findMany({
      where: {
        profileId,
        date: { gte: thirtyDaysAgo },
      },
    });

    if (historicalMetrics.length === 0) {
      return {
        projectedRevenue: 0,
        projectedClicks: 0,
        projectedConversions: 0,
        confidence: 0,
        method: 'insufficient_data',
      };
    }

    // Simple linear regression
    const dailyRevenue: Record<string, bigint> = {};
    const dailyClicks: Record<string, number> = {};

    historicalMetrics.forEach((m) => {
      const dayKey = m.date.toISOString().split('T')[0];
      dailyRevenue[dayKey] = (dailyRevenue[dayKey] || 0n) + m.totalRevenue;
      dailyClicks[dayKey] = (dailyClicks[dayKey] || 0) + m.clicks;
    });

    const avgDailyRevenue =
      Object.values(dailyRevenue).reduce((sum, r) => sum + r, 0n) / BigInt(Object.keys(dailyRevenue).length);
    const avgDailyClicks =
      Object.values(dailyClicks).reduce((sum, c) => sum + c, 0) / Object.keys(dailyClicks).length;

    const projectedRevenue = Number(avgDailyRevenue * BigInt(days)) / 100;
    const projectedClicks = Math.round(avgDailyClicks * days);

    return {
      period: `${days} days`,
      projectedRevenue: projectedRevenue.toFixed(2),
      projectedClicks,
      projectedConversions: Math.round(projectedClicks * 0.02), // Assume 2% conversion
      confidence: 0.65,
      method: 'moving_average',
      disclaimer: 'Based on historical data. Actual results may vary.',
    };
  }

  async getLinkForecast(profileId: string, linkId: string, userId: string){
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const metrics = await prisma.linkRevenueMetrics.findMany({
      where: {
        linkId,
        profileId,
        date: { gte: thirtyDaysAgo },
      },
    });

    if (metrics.length === 0) {
      return { linkId, forecast: 'insufficient_data' };
    }

    const avgRevenue = metrics.reduce((sum, m) => sum + m.totalRevenue, 0n) / BigInt(metrics.length);
    const avgClicks = metrics.reduce((sum, m) => sum + m.clicks, 0) / metrics.length;
    return {
      linkId,
      projectedWeeklyRevenue: (Number(avgRevenue) * 7 / 100).toFixed(2),
      projectedWeeklyClicks: Math.round(avgClicks * 7),
      avgConversionRate: metrics[0]?.conversionRate.toFixed(2)}}

  // attribution setngs

  async getAttributionSettings(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Return default settings (could be stored in profile metadata)
    return {
      profileId,
      attributionWindowDays: 7,
      attributionModel: 'last_click',
      fraudDetectionEnabled: true,
    };
  }

  async updateAttributionSettings(profileId: string, data: any, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Update profile metadata with settings
    const updated = await prisma.profile.update({
      where: { id: profileId },
      data: {
        // Store in metadata or create a settings model
      },
    });

    return { success: true };
  }

  // frauds detect

  async getFraudAlerts(profileId: string, userId: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return await prisma.fraudAlert.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveFraudAlert(alertId: string, resolution: string, notes: string | undefined, userId: string) {
    const alert = await prisma.fraudAlert.findUnique({
      where: { id: alertId },
      include: { profile: true },
    });

    if (!alert) {
      throw new NotFoundError('Alert not found');
    }

    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: alert.profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Unauthorized');
    }

    return await prisma.fraudAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        reviewedAt: new Date(),
        resolution: notes,
      },
    });
  }

  // log

  async getWebhookLogs(profileId: string, userId: string, limit: number = 50, source?: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const where: any = { profileId };
    if (source) {
      where.source = source;
    }

    return await prisma.webhookLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

//   reports 

  async exportRevenueReport(profileId: string, userId: string, format: string, days: number) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const revenue = await this.getRevenueByLink(profileId, userId, days);

    if (format === 'csv') {
      const header = 'Link,Clicks,Conversions,Revenue,Conversion Rate,CPCR,AOV\n';
      const rows = revenue
        .map(
          (r) =>
            `"${r.title}",${r.clicks},${parseFloat(r.conversionRate)},${r.totalRevenue},${r.conversionRate},${r.cpcr},${r.aov}`
        )
        .join('\n');

      return header + rows;
    }

    return JSON.stringify(revenue, null, 2);
  }

  async exportLTVReport(profileId: string, userId: string, format: string) {
    // Verify ownership
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    const customers = await prisma.customerLTV.findMany({
      where: { profileId },
    });

    if (format === 'csv') {
      const header = 'Customer ID,Link ID,First Purchase,Total Revenue,LTV\n';
      const rows = customers
        .map(
          (c) =>
            `${c.customerId},${c.linkId},${c.firstPurchaseDate},${Number(c.totalRevenue) / 100},${Number(c.estimatedLTV) / 100}`
        )
        .join('\n');

      return header + rows;
    }

    return JSON.stringify(customers, null, 2);
  }
}