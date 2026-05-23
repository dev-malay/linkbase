export function calculateStatisticalSignificance(
  clicks1: number,
  clicks2: number,
  ctr1: number,
  ctr2: number
): number {
    
  // Simple chi-square approximation
  const observed = [clicks1, clicks2];
  const totalClicks = clicks1 + clicks2;
  
  if (totalClicks < 30) {
    return 1; // Not enough data
  }

  const expected1 = totalClicks * 0.5;
  const expected2 = totalClicks * 0.5;

  const chiSquare =
    Math.pow(clicks1 - expected1, 2) / expected1 +
    Math.pow(clicks2 - expected2, 2) / expected2;

  // Rough p-value estimation
  // For 1 degree of freedom: p=0.05 at chi-square=3.841
  return chiSquare > 3.841 ? 0.01 : 0.5;
}

export function calculateConfidenceScore(sampleSize: number, threshold: number): number {
  return Math.min(sampleSize / threshold, 1);
}