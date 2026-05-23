import { Router } from 'express';
import { PresetController } from './preset.controller';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validator';
import { PresetValidations } from './preset.validations';

const router = Router();
const controller = new PresetController();

router.use(authMiddleware );

router.get('/profile/:profileId',
  controller.getPresetsForProfile.bind(controller)

);

router.get('/:presetId',
  controller.getPreset.bind(controller)
);

router.post('/',
  validateRequest(PresetValidations.createPreset),
  controller.createPreset.bind(controller)
);

router.patch('/:presetId',
  validateRequest(PresetValidations.updatePreset),
  controller.updatePreset.bind(controller)
);
router.delete('/:presetId',
  controller.deletePreset.bind(controller)
)

// presetactivator
router.post('/:presetId/activate',
  controller.activatePreset.bind(controller)
);

router.get('/profile/:profileId/active',
  controller.getActivePreset.bind(controller)
);





router.post('/:presetId/reorder-links',
  validateRequest(PresetValidations.reorderLinksInPreset),
  controller.reorderLinksInPreset.bind(controller)
);

router.post('/:presetId/add-link',
  validateRequest(PresetValidations.addLinkToPreset),
  controller.addLinkToPreset.bind(controller)
);

router.delete('/:presetId/link/:linkId',
  controller.removeLinkFromPreset.bind(controller)
);
router.post('/:presetId/clone',
  validateRequest(PresetValidations.clonePreset),
  controller.clonePreset.bind(controller)
);

router.post('/:presetId/archive',
  controller.archivePreset.bind(controller)
);

router.post('/:presetId/restore',
  controller.restorePreset.bind(controller)
);

router.get('/profile/:profileId/archived',
  controller.getArchivedPresets.bind(controller)
);




// analytics 
router.get('/:presetId/analytics',
  controller.getPresetAnalytics.bind(controller)
)

router.post('/profile/:profileId/compare',
  validateRequest(PresetValidations.comparePresets),
  controller.comparePresets.bind(controller)
);

router.get('/:presetId/history',
  controller.getPresetHistory.bind(controller)
);


router.post('/:presetId/availability-rule',
  validateRequest(PresetValidations.addAvailabilityRule),
  controller.addAvailabilityRule.bind(controller)
);

router.patch('/:presetId/availability-rule/:ruleId',
  validateRequest(PresetValidations.updateAvailabilityRule),
  controller.updateAvailabilityRule.bind(controller)
);

router.delete('/:presetId/availability-rule/:ruleId',
  controller.removeAvailabilityRule.bind(controller)
);


router.get('/:presetId/availability-rules',
  controller.getAvailabilityRules.bind(controller)
);


router.post('/:presetId/schedule-activation',
  validateRequest(PresetValidations.schedulePresetActivation),
  controller.schedulePresetActivation.bind(controller)
);

router.get('/profile/:profileId/scheduled-activations',
  controller.getScheduledActivations.bind(controller)
);

router.delete('/:presetId/scheduled-activation/:scheduleId',
  controller.cancelScheduledActivation.bind(controller)
);








// templates below 
router.post('/:presetId/export-template',
  validateRequest(PresetValidations.exportTemplate),
  controller.exportPresetAsTemplate.bind(controller)
);

router.post('/import-template',
  validateRequest(PresetValidations.importTemplate),
  controller.importFromTemplate.bind(controller)
);

router.get('/templates/public',
  controller.getPublicTemplates.bind(controller))

router.post('/:presetId/bulk-add-links',
  validateRequest(PresetValidations.bulkAddLinks),
  controller.bulkAddLinks.bind(controller)
);

export default router