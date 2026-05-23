import { Router } from 'express';
import { IntelligenceController } from './intelligence.controller';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validator';
import { IntelligenceValidations } from './intelligence.validations';

const router = Router();
const controller = new IntelligenceController();

router.use(authMiddleware);


router.get('/profile/:profileId/settings',
  controller.getOptimizationSettings.bind(controller));

router.patch('/profile/:profileId/settings',
  validateRequest(IntelligenceValidations.updateSettings),
  controller.updateOptimizationSettings.bind(controller)
);

router.post('/profile/:profileId/toggle-auto-optimize',
  controller.toggleAutoOptimize.bind(controller)
);

router.get('/profile/:profileId/patterns',
  controller.getDetectedPatterns.bind(controller)
);

router.get('/profile/:profileId/patterns/:patternType/:dimension',
  controller.getPatternDetails.bind(controller)
);

router.get('/profile/:profileId/learnings',
  controller.getLearningsDashboard.bind(controller)
);

router.get('/profile/:profileId/suggestions',
  controller.getPendingSuggestions.bind(controller)
);
router.get('/:suggestionId',
  controller.getSuggestion.bind(controller)
);

router.post('/:suggestionId/approve',
  controller.approveSuggestion.bind(controller)
);

router.post('/:suggestionId/reject',
  validateRequest(IntelligenceValidations.rejectSuggestion),
  controller.rejectSuggestion.bind(controller)
);

// ranking history 
router.get('/profile/:profileId/ranking-history',
  controller.getRankingHistory.bind(controller)
);

// Get ranking performance
router.get('/profile/:profileId/ranking/:rankingId/performance',
  controller.getRankingPerformance.bind(controller)
);

// Compare two rankings
router.post('/profile/:profileId/compare-rankings',
  validateRequest(IntelligenceValidations.compareRankings),
  controller.compareRankings.bind(controller)
);

// revert to previous ranking
router.post('/:rankingId/revert',
  controller.revertToRanking.bind(controller)
)
// analytics n insightss 

router.get('/profile/:profileId/leaderboard',
  controller.getLinkLeaderboard.bind(controller)
);

router.get('/profile/:profileId/impact',
  controller.getOptimizationImpact.bind(controller));

router.get('/profile/:profileId/predict-ranking',
  validateRequest(IntelligenceValidations.predictRanking),
  controller.predictRankingForCampaign.bind(controller)
);

// manual overrides 

// set manualy (never put X above Y)
router.post('/profile/:profileId/rules',
  validateRequest(IntelligenceValidations.setRule),
  controller.setOptimizationRule.bind(controller)
)

router.get('/profile/:profileId/rules',
  controller.getOptimizationRules.bind(controller)
);

router.delete('/profile/:profileId/rules/:ruleId',
  controller.deleteOptimizationRule.bind(controller)
);

export default router;