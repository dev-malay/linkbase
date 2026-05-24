import Queue from 'bull';
import redis from 'redis';
import { redis } from '../config/redis';
import { Queue } from 'bull';

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});


// Create queues

export const linkSwapQueue = new Queue('link-swap', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export const analyticsQueue = new Queue('analytics', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})



// Global error handlers


linkSwapQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

analyticsQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

export { redisClient };

export const linkOptimizationQueue = new Queue('link-optimization', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
});




export const timeoutQueue = new Queue('timeout', {
  redis: redis.options,
});

timeoutQueue.process('monitor-timeout', 5, require('./processors/timeout.processor').monitorTimeout);
timeoutQueue.process('execute-scheduled-change', 5, require('./processors/timeout.processor').executeScheduledChange);
timeoutQueue.process('start-variant-test', 2, require('./processors/timeout.processor').startVariantTest);
timeoutQueue.process('increment-visitor-count', 10, require('./processors/timeout.processor').incrementVisitorCount);