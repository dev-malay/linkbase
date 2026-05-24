import crypto from 'crypto';

export function extractVisitorProfile(visitorData: any){
  const hour = new Date().getHours();
  let timeOfDay = 'morning';
  if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
  else if (hour >= 22 || hour < 6) timeOfDay = 'night';

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = days[new Date().getDay()];

  return {
    referrer: visitorData.referrer?.toLowerCase() || 'direct',
    country: visitorData.country,
    deviceType: visitorData.deviceType || 'desktop',
    browser: visitorData.browser,
    os: visitorData.os,
    timeOfDay,
    dayOfWeek,
    hour,
  };
}

export function computeVisitorHash(visitorProfile: any): string {
  const key = `${visitorProfile.referrer}-${visitorProfile.country}-${visitorProfile.deviceType}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function predictOptimalLinkOrder(
  linkScores: Record<string, number>,
  currentLinks: string[]
): string[] {

  // sort links by ML-predicted scores
  const scored = currentLinks.map((linkId) => ({
    linkId,
    score: linkScores[linkId] || 0,
  }));

  return scored.sort((a, b) => b.score - a.score).map((item) => item.linkId);
}