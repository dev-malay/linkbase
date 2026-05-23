import { linkSwapQueue, analyticsQueue } from './queues';
import { processLinkSwap, processScheduledSwap } from './processors/link-swap.processor';

import { processPresetActivation, processScheduledPresetActivation } from './processors/preset-activation.processor';

presetActivationQueue.process('activate-preset', 5, processPresetActivation);
presetActivationQueue.process('scheduled-activation', 5, processScheduledPresetActivation);
linkSwapQueue.process('execute-swap', 5, processLinkSwap);
linkSwapQueue.process('scheduled-swap', 5, processScheduledSwap);

export { linkSwapQueue, analyticsQueue}