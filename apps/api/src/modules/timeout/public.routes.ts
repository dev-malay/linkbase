import { Router } from 'express';
import { prisma } from '@linkbase/db';
import { shouldLinkBeVisible, calculateUrgencyMessage } from '../../utils/timeout-ml';

const router = Router();

// Check if link is visible (called when rendering profile page)
router.post('/:profileId/check-visibility', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { linkIds } = req.body;

    const timeouts = await prisma.linkTimeout.findMany({
      where: {
        linkId: { in: linkIds },
      },
    });

    const visibility: Record<string, any> = {};

    for (const linkId of linkIds) {
      const timeout = timeouts.find((t) => t.linkId === linkId);

      if (!timeout) {
        visibility[linkId] = { visible: true };
      } else {
        const isVisible = shouldLinkBeVisible(timeout);
        const urgencyMessage = calculateUrgencyMessage(timeout);

        visibility[linkId] = {
          visible: isVisible,
          urgencyMessage,
          fallbackLinkId: isVisible ? null : timeout.fallbackLinkId,
        };
      }
    }

    res.json({ success: true, data: visibility });
  } catch (error) {
    console.error('Visibility check error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;