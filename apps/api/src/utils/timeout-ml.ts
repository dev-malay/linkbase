export function parseRecurringRule(rule: string): any {
  // Simple iCalendar-like parsing
  // Format: "FREQ=WEEKLY;BYDAY=MO,FR;BYHOUR=09"

  const parts = rule.split(';');
  const config: any = {};

  parts.forEach((part) => {
    const [key, value] = part.split('=');
    config[key] = value;
  });

  return config;
}

export function getNextOccurrence(rule: any, from: Date = new Date()): Date {
  // Calculate next occurrence based on recurring rule
  const freq = rule.FREQ; // DAILY, WEEKLY, MONTHLY, YEARLY
  const byday = rule.BYDAY?.split(',');
  const byhour = rule.BYHOUR ? parseInt(rule.BYHOUR) : 0;

  const next = new Date(from);

  switch (freq) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      if (byhour) next.setHours(byhour, 0, 0, 0);
      break;

    case 'DAILY':
      next.setDate(next.getDate() + 1);
      if (byhour) next.setHours(byhour, 0, 0, 0);
      break;

    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      if (byhour) next.setHours(byhour, 0, 0, 0);
      break;
  }

  return next;
}

export function shouldLinkBeVisible

export function shouldLinkBeVisible(timeout: any): boolean {
  if (!timeout.isActive) return false;
  if (timeout.isExpired) return false;

  // Time-based checks
  if (timeout.visibleFrom && new Date() < timeout.visibleFrom) {
    return false;
  }

  if (timeout.visibleUntil && new Date() > timeout.visibleUntil) {
    return false;
  }

  if (timeout.expiresAt && new Date() > timeout.expiresAt) {
    return false;
  }

  // Visitor count checks
  if (
    timeout.timeoutType === 'visitor-count' &&
    timeout.maxVisitorCount &&
    timeout.currentVisitorCount >= timeout.maxVisitorCount
  ) {
    return false;
  }

  return true;
}

export function calculateUrgencyMessage(timeout: any): string | null {
  if (!timeout.showUrgencyBadge) return null;

  // Time-based urgency
  if (timeout.expiresAt) {
    const now = Date.now();
    const expiresAt = timeout.expiresAt.getTime();
    const diff = expiresAt - now;

    if (diff < 0) return null;

    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 24) {
      return `${Math.ceil(hours / 24)} days remaining`;
    } else if (hours > 0) {
      return `${hours} hours remaining`;
    } else if (minutes > 0) {
      return `${minutes} minutes remaining`;
    } else {
      return 'Expires soon!';
    }
  }

  // Visitor count urgency
  if (
    timeout.timeoutType === 'visitor-count' &&
    timeout.maxVisitorCount
  ) {
    const remaining = timeout.maxVisitorCount - timeout.currentVisitorCount;
    return `${remaining} spots remaining`;
  }

  return timeout.urgencyMessage || null;
}

export async function shouldSendReminder(
  timeout: any,
  reminderType: 'day' | 'hour'
): Promise<boolean> {
  if (!timeout.expiresAt) return false;

  const now = Date.now();
  const expiresAt = timeout.expiresAt.getTime();
  const diff = expiresAt - now;

  if (reminderType === 'day') {
    const reminderDays = timeout.reminderEmailDays || [1];
    for (const days of reminderDays) {
      const reminderTime = days * 24 * 60 * 60 * 1000;
      // Check if we're within 1 hour of the reminder time
      if (
        Math.abs(diff - reminderTime) < 60 * 60 * 1000 &&
        diff > 0
      ) {
        return true;
      }
    }
  }

  if (reminderType === 'hour') {
    const reminderHours = timeout.reminderEmailHours || [];
    for (const hours of reminderHours) {
      const reminderTime = hours * 60 * 60 * 1000;
      if (
        Math.abs(diff - reminderTime) < 60 * 1000 &&
        diff > 0
      ) {
        return true;
      }
    }
  }

  return false;
}