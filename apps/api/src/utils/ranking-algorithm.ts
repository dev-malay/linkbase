export function generateOptimalRanking(
  clickDistribution: Record<string, number>,
  currentRanking: string[]
): string[] {
    
  // Sort by clicks descending
  const optimalOrder = Object.entries(clickDistribution)
    .sort((a, b) => b[1] - a[1])
    .map(([linkId]) => linkId);

  // Add links not in distribution
  const missing = currentRanking.filter((id) => !optimalOrder.includes(id));

  return [...optimalOrder, ...missing];
}