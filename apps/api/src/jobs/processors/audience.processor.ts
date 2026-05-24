import { Job } from 'bull';
import { prisma } from '@linkbase/db';
import { cache } from '../../utils/cache';

export async function updateCohorts(job: Job) {
  const { profileId, visitorProfile } = job.data;

  // Group visitor into appropriate cohorts
  const cohortDefinitions = [
    { type: 'referrer', value: visitorProfile.referrer },
    { type: 'device', value: visitorProfile.deviceType },
    { type: 'country', value: visitorProfile.country },
    { type: 'time', value: visitorProfile.timeOfDay },
  ];

  for (const def of cohortDefinitions.filter((d) => d.value)) {
    await prisma.visitorCohort.upsert({
      where: {
        profileId_cohortType_cohortValue_periodStartDate: {
          profileId,
          cohortType: def.type,
          cohortValue: def.value,
          periodStartDate: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      create: {
        profileId,
        cohortName: `${def.type}: ${def.value}`,
        cohortType: def.type,
        cohortValue: def.value,
        totalVisitors: 1,
        periodStartDate: new Date(new Date().setHours(0, 0, 0, 0)),
      },
      update: {
        totalVisitors: { increment: 1 }},
    });
  }

  await cache.delete(`cohorts:${profileId}`);
}

export async function retrainModel(job: Job) {
  const { profileId } = job.data;

  // Retrain ml model based on recent visitor data
  // Simplified- just update last trained timestamp
  await prisma.personalizationModel.upsert({
    where: { profileId },
    create: {
      profileId,
      lastTrainedAt: new Date(),
      featureWeights: {},
    },
    update: {
      lastTrainedAt: new Date(),
      version: { increment: 1 },
    },
  });

  await cache.delete(`model:${profileId}`);
}