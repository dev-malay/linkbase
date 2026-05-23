import { Job } from 'bull';
import { prisma } from '@linkbase/db';
import { cache } from '../../utils/cache'
import { emitPresetActivated } from '../../events/preset-activated.event';
import { sendWebhook } from '../../integrations/webhooks';
import { invalidateCDNCache } from '../../integrations/cdn'



interface PresetActivationJobData {
  presetId: string;
  profileId: string;
  previousPresetId?: string;
}

export async function processPresetActivation(
  job: Job<PresetActivationJobData>
) {
  const { presetId, profileId, previousPresetId } = job.data;

  try{
    job.progress(10);

    const preset = await prisma.preset.findUnique({
      where: { id: presetId },
      include: { profile: true },
    });

    if (!preset) {
      throw new Error('Preset not found');
}

    job.progress(20);

    const links = await prisma.link.findMany({
      where: { id: { in: preset.linkIds }, deletedAt: null },
    });

    job.progress(40);

    await prisma.$transaction(
      preset.linkIds.map((linkId, index) =>
        prisma.link.update({
          where: { id: linkId },
          data: { position: index + 1 },
        })
      )
    );

    job.progress(60);

    await cache.delete(`links:${profileId}`);
    await cache.delete(`active-preset:${profileId}`);
    await cache.delete(`presets:${profileId}`);

    job.progress(70);
    await invalidateCDNCache(`/${preset.profile.username}`);

    job.progress(80);

    // Send webhooks
    const webhooks = await prisma.webhook.findMany({
      where: { profileId, isActive: true },
    });

    for (const webhook of webhooks) {
      if (webhook.eventType === 'preset_activated' || webhook.eventType === '*') {
        await sendWebhook(webhook, {
          event: 'preset_activated',
          data: {
            presetId,
            profileId,
            linkCount: preset.linkIds.length,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    job.progress(90);

    // Emit the  event
    emitPresetActivated({
      type: 'preset_activated',
      presetId,
      profileId,
      previousPresetId,
      timestamp: new Date(),
    });

    job.progress(100);

    return {
      success: true,
      preset: {
        id: preset.id,
        name: preset.name,
        linksSwapped: preset.linkIds.length,
      },
    };
  } catch (error) {
    console.error('Preset activation processor error:', error);
    throw error;
  }
}

export async function processScheduledPresetActivation(
  job: Job<PresetActivationJobData>
) {
  const { presetId, profileId } = job.data;

  try {
    // activate the preset
    await processPresetActivation(job);

    // update scheduled swap status
    await prisma.scheduledSwap.updateMany({
      where: { presetId, status: 'pending' },
      data: { status: 'completed', executedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    console.error('Scheduled preset activation error:', error);

    await prisma.scheduledSwap.updateMany({
      where: { presetId, status: 'pending' },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}