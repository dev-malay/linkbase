export function parseRecurringRule(rule: string): any {
  const parts = rule.split(';');
  const config: any = {};

  parts.forEach((part) => {
    const [key, value] = part.split('=');
    config[key] = value;
  });

  if (!config.FREQ) {
    throw new Error('FREQ is required in recurring rule');
  }

  return config;
}

export function getNextOccurrence(rule: any, from: Date = new Date()): Date {
  const freq = rule.FREQ;
  const byday = rule.BYDAY?.split(',');
  const byhour = rule.BYHOUR ? parseInt(rule.BYHOUR) : 9;
  const byminute = rule.BYMINUTE ? parseInt(rule.BYMINUTE) : 0;

  const next = new Date(from);
  next.setHours(byhour, byminute, 0, 0);

  const dayMap: Record<string, number> = {
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
    SU: 0,
  };

  switch (freq) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;

    case 'WEEKLY':
      if (byday && byday.length > 0) {
        let daysAhead = 7;
        const currentDay = next.getDay();
        const targetDay = dayMap[byday[0]];

        if (targetDay > currentDay) {
          daysAhead = targetDay - currentDay;
        } else if (targetDay === currentDay) {
          daysAhead = 7;
        } else {
          daysAhead = 7 - (currentDay - targetDay);
        }

        next.setDate(next.getDate() + daysAhead);
      } else {
        next.setDate(next.getDate() + 7);
      }
      break;

    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;

    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

export function isRuleActive(
  rule: any,
  startDate?: Date,
  endDate?: Date,
  now: Date = new Date()
): boolean {
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;

  return true;
}