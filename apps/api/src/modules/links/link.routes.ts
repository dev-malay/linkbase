import { Router } from 'express';
import { LinkController } from './link.controller';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validator';
import { LinkValidations } from './link.validations';

const router = Router();
const controller = new LinkController();

// remember - All routes protected by auth
router.use(authMiddleware);

router.get('/profile/:profileId', 
  controller.getLinksForProfile.bind(controller)
);

router.get('/:linkId', 
  controller.getLink.bind(controller)
);

router.post('/', 
  validateRequest(LinkValidations.createLink),
  controller.createLink.bind(controller)
);

router.patch('/:linkId', 
  validateRequest(LinkValidations.updateLink),
  controller.updateLink.bind(controller)
);

router.delete('/:linkId', 
  controller.deleteLink.bind(controller)
);

// liveLinkEndpoinsts
router.post('/:linkId/swap', 
  validateRequest(LinkValidations.swapLink),
  controller.swapLink.bind(controller)
);

router.get('/:linkId/preview', 
  controller.previewLink.bind(controller)
);

router.post('/profile/:profileId/reorder', 
  validateRequest(LinkValidations.reorderLinks),
  controller.reorderLinks.bind(controller)
);

router.get('/profile/:profileId/swap-history', 
  controller.getSwapHistory.bind(controller)
);

router.post('/:linkId/undo-swap', 
  controller.undoSwap.bind(controller)
);

router.get('/:linkId/swap-analytics', 
  controller.getSwapAnalytics.bind(controller)
);

router.post('/:linkId/schedule-swap', 
  validateRequest(LinkValidations.scheduleSwap),
  controller.scheduleSwap.bind(controller)
);

router.get('/profile/:profileId/scheduled-swaps', 
  controller.getScheduledSwaps.bind(controller)
);

router.delete('/scheduled/:swapId', 
  controller.cancelScheduledSwap.bind(controller)
);

router.post('/:linkId/activate-backup', 
  controller.activateBackupLink.bind(controller)
);

export default router;