import Queue from 'bull';
import redis from 'redis';

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