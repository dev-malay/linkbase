import { prisma } from '@linkbase/db';

export async function evaluateCondition(
  profileId: string,
  visitorData: any,
  condition: {
    conditionType: string;
    conditionValue: string;
    conditionMetadata?: any;
  }
): Promise<boolean> {
  switch (condition.conditionType) {
    case 'user_segment':
      return evaluateUserSegment(profileId, visitorData, condition.conditionValue);

    case 'subscription_status':
      return evaluateSubscriptionStatus(visitorData, condition.conditionValue);

    case 'purchase_history':
      return evaluatePurchaseHistory(profileId, visitorData, condition.conditionValue);

    case 'custom':
      return evaluateCustomCondition(condition.conditionMetadata);

    default:
      return true;
  }
}

async function evaluateUserSegment(
  profileId: string,
  visitorData: any,
  segment: string
): Promise<boolean> {
  // Check if visitor is in specific segment
  // This would typically query CRM or customer data
  // Simplified implementation:

  const visitor = await prisma.visitorProfile.findFirst({
    where: {
      profileId,
      sessionId: visitorData.sessionId,
    },
  });

  if (!visitor) return false;

  // Check against segment value (e.g., "vip_customers")
  return visitor.customAttributes?.[segment] === true;
}

function evaluateSubscriptionStatus(
  visitorData: any,
  status: string
): boolean {
  // Check if customer has specific subscription status
  // "free_tier", "premium", "annual", etc.

  return visitorData.subscriptionStatus === status;
}

async function evaluatePurchaseHistory(
  profileId: string,
  visitorData: any,
  condition: string
): Promise<boolean> {
  // "has_purchased", "high_value_customer", "repeat_buyer"

  if (condition === 'has_purchased') {
    const purchases = await prisma.linkRevenue.count({
      where: {
        profileId,
        customerId: visitorData.customerId,
      },
    });
    return purchases > 0;
  }

  if (condition === 'repeat_buyer') {
    const purchases = await prisma.linkRevenue.count({
      where: {
        profileId,
        customerId: visitorData.customerId,
      },
    });
    return purchases > 1;
  }

  if (condition === 'high_value_customer') {
    const revenue = await prisma.linkRevenue.aggregate({
      where: {
        profileId,
        customerId: visitorData.customerId,
      },
      _sum: { amountCents: true },
    });
    return (revenue._sum.amountCents || 0) > 50000; // $500+
  }

  return false;
}

function evaluateCustomCondition(metadata: any): boolean {
  // Custom condition logic
  if (!metadata) return true;

  // Could implement custom expression evaluator here
  return true;
}