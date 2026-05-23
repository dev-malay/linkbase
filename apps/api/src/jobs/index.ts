import { linkSwapQueue, analyticsQueue } from './queues';
import { processLinkSwap, processScheduledSwap } from './processors/link-swap.processor';

import { processPresetActivation, processScheduledPresetActivation } from './processors/preset-activation.processor';
import { processIntelligenceJob } from './processors/intelligence.processor';
import { scheduleIntelligenceJobs } from './intelligence-scheduler';



linkOptimizationQueue.process('analyze-intelligence', 2, processIntelligenceJob);
linkOptimizationQueue.process('generate-suggestions', 2, processIntelligenceJob);
linkOptimizationQueue.process('apply-optimization', 2, processIntelligenceJob);
linkOptimizationQueue.process('track-ab-test', 2, processIntelligenceJob);

// Schedule recurring jobs on startup
scheduleIntelligenceJobs().catch(console.error);


presetActivationQueue.process('activate-preset', 5, processPresetActivation);
presetActivationQueue.process('scheduled-activation', 5, processScheduledPresetActivation);
linkSwapQueue.process('execute-swap', 5, processLinkSwap);
linkSwapQueue.process('scheduled-swap', 5, processScheduledSwap);

export { linkSwapQueue, analyticsQueue}