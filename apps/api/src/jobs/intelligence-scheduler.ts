import { linkOptimizationQueue } from './queues';



export async function scheduleIntelligenceJobs() {
  // Analyse clicks every hour
  await linkOptimizationQueue.add(
    'analyze-intelligence',
    { type: 'analyze-clicks' },
    {
      repeat: {
        pattern: '0 * * * *', 
      },
    }
  );

  // Generate suggestions daily
  await linkOptimizationQueue.add(
    'generate-suggestions',
    { type: 'generate-suggestion' },
    {
      repeat: {
        pattern: '0 0 * * *', //midnight
      },
    }
  );

  // Track ab tests continuously
  await linkOptimizationQueue.add(
    'track-ab-tests',
    { type: 'track-ab-test' },
    {
      repeat: {
        every: 5 * 60 * 1000, // Every 5 minutes
      },
    }
  );
}