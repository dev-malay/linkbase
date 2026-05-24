import {prisma} from '@linkbase/db';

export async function matchTransactionToLink(
  profileId: string,
  transactionData: any,
  attributionWindowDays: number
): Promise<string | null> {
  // Match transaction to link using UTM params, session Id, or customer email
  const cutoffDate = new Date(
    Date.now() - attributionWindowDays * 24 * 60 * 60 * 1000
  );

  // Try matching by UTM source
  if (transactionData.utmSource) {
    const link = await prisma.link.findFirst({
      where: {
        profileId,
        metadata: {
          path: ['utmSource'],
          equals: transactionData.utmSource,
        },
      },
    });
    if (link) return link.id;
  }

  // Try matching by customer email (for returning customers)
  if (transactionData.customerEmail) {
    const previousClick = await prisma.linkClick.findFirst({
      where: {
        profile: { id: profileId },
        timestamp: { gte: cutoffDate },
        // Match by email (would need to store in clicks)
      },
      orderBy: { timestamp: 'desc' },
    });
    if (previousClick) return previousClick.linkId;
  }

  // Default: attribute to top performer
  const topLink = await prisma.link.findFirst({
    where: { profileId },
    orderBy: { position: 'asc' },
  });

  return topLink?.id || null;
}

export function calculateCPCR(
  totalRevenue: bigint,
  clicks: number
): number {
  if (clicks === 0) return 0;
  return Number(totalRevenue) / clicks / 100;
}

export function calculateLTV(
  firstPurchase: bigint,
  totalRevenue: bigint,
  purchaseCount: number
): bigint {
  if (purchaseCount === 0) return firstPurchase;
  // Simple LTV calculation
  const avgPurchaseValue = totalRevenue / BigInt(purchaseCount);
  return firstPurchase + avgPurchaseValue * BigInt(12); // Estimate 12 future purchases
}

export async function detectFraud(
  profileId: string,
  linkId: string,
  recentClicks: any[]
): Promise<boolean> {
  // Detect bot traffic, impossible CTR, etc.
  if (recentClicks.length === 0) return false;

  // Check for impossible click rate (1000+ clicks/second)
  const timeRange = recentClicks[recentClicks.length - 1].timestamp.getTime() -
    recentClicks[0].timestamp.getTime();
  const clicksPerSecond = (recentClicks.length / timeRange) * 1000;

  if (clicksPerSecond > 10) {
    return true;
  }

  // Check for same IP making multiple clicks in 10 seconds
  const ipsInWindow: Record<string, number> = {};
  recentClicks.forEach((click) => {
    const ip = click.ipHash;
    ipsInWindow[ip] = (ipsInWindow[ip] || 0) + 1;
  });

  for (const [ip, count] of Object.entries(ipsInWindow)) {
    if (count > 50) {
      return true;
    }
  }

  return false
}