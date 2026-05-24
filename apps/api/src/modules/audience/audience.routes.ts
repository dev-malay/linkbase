import { Router } from 'express';
import { AudienceController } from './audience.controller';
import { authMiddleware } from '../../middleware/auth'
import { validateRequest } from '../../middleware/validator';
import { AudienceValidations } from './audience.validations';

const router = Router();
const controller = new AudienceController();

// pub route (no auth needed for public profile)
router.post('/:profileId/predict',
  validateRequest(AudienceValidations.predictLinkOrder),
  controller.getPredictedLinkOrder.bind(controller)
);

// Protected routes
router.use(authMiddleware);

// for personalisation rules 

// Get all rules
router.get('/profile/:profileId/rules',
  controller.getPersonalizationRules.bind(controller)
);

// create 
router.post('/profile/:profileId/rules',
  validateRequest(AudienceValidations.createRule),
  controller.createPersonalizationRule.bind(controller)
);

// update 
router.patch('/profile/:profileId/rules/:ruleId',
  validateRequest(AudienceValidations.updateRule),
  controller.updatePersonalizationRule.bind(controller)
)

// Delete rule
router.delete('/profile/:profileId/rules/:ruleId',
  controller.deletePersonalizationRule.bind(controller)
);

// Reorder rules by priority
router.post('/profile/:profileId/rules/reorder',
  validateRequest(AudienceValidations.reorderRules),
  controller.reorderRules.bind(controller)
);


      // cohort analysis 

// Get cohorts
router.get('/profile/:profileId/cohorts',
  controller.getCohorts.bind(controller)
);

// Get cohort details
router.get('/profile/:profileId/cohorts/:cohortId',
  controller.getCohortDetails.bind(controller)
);

// Get cohort performance comparison
router.get('/profile/:profileId/cohort-comparison',
  controller.getCohortComparison.bind(controller)
);


// personalistaion setings 

// Get personalization settings
router.get('/profile/:profileId/settings',
  controller.getPersonalizationSettings.bind(controller)
);

// Update personalization settings
router.patch('/profile/:profileId/settings',
  validateRequest(AudienceValidations.updateSettings),
  controller.updatePersonalizationSettings.bind(controller)
);

// Toggle personalization
router.post('/profile/:profileId/toggle',
  controller.togglePersonalization.bind(controller)
);



// ml model 
// Get model info
router.get('/profile/:profileId/model',
  controller.getModelInfo.bind(controller)
);

// Retrain model
router.post('/profile/:profileId/model/retrain',
  controller.retrainModel.bind(controller)
);

// Get model accuracy metrics
router.get('/profile/:profileId/model/metrics',
  controller.getModelMetrics.bind(controller)
);



// visitor profile 

// Get recent visitor profiles
router.get('/profile/:profileId/visitors',
  controller.getRecentVisitors.bind(controller)
);

// Get visitor profile details
router.get('/profile/:profileId/visitors/:visitorProfileId',
  controller.getVisitorProfileDetails.bind(controller)
);

// ab testing 

// Start ab test for cohort
router.post('/profile/:profileId/ab-test/start',
  validateRequest(AudienceValidations.startABTest),
  controller.startABTest.bind(controller)
);

// Get active ab tests
router.get('/profile/:profileId/ab-tests/active',
  controller.getActiveABTests.bind(controller)
);

// Get ab test results
router.get('/ab-test/:testId/results',
  controller.getABTestResults.bind(controller)
);

// end ab test
router.post('/ab-test/:testId/end',
  controller.endABTest.bind(controller)
);

// anlaytics and insights 

// Get personalization impact
router.get('/profile/:profileId/impact',
  controller.getPersonalizationImpact.bind(controller)
);

// Get audience insights
router.get('/profile/:profileId/insights',
  controller.getAudienceInsights.bind(controller)
);

// Get custom attributes setup
router.get('/profile/:profileId/custom-attributes',
  controller.getCustomAttributesSetup.bind(controller)
)

// Configure custom attribute mapping
router.post('/profile/:profileId/custom-attributes',
  validateRequest(AudienceValidations.configureCustomAttributes),
  controller.configureCustomAttributes.bind(controller)
);


export default router