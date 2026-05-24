import { Router } from 'express';
import { AttributionController } from './attribution.controller';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validator';
import { AttributionValidations } from './attribution.validations';

const router = Router();
const controller = new AttributionController();

// public webhook endpoint (no auth)
router.post('/webhook/:profileId/:source',
  validateRequest(AttributionValidations.webhook),
  controller.handleWebhook.bind(controller)
);

router.use(authMiddleware);

// integrations 

// Get connected integrations
router.get('/profile/:profileId/integrations',
  controller.getIntegrations.bind(controller)
);

// Connect/configure integration
router.post('/profile/:profileId/integrations',
  validateRequest(AttributionValidations.configureIntegration),
  controller.configureIntegration.bind(controller)
);

// Disconnect integration
router.delete('/profile/:profileId/integrations/:service',
  controller.disconnectIntegration.bind(controller)
);

// Get integration status
router.get('/profile/:profileId/integrations/:service/status',
  controller.getIntegrationStatus.bind(controller)
);

// Manually sync integration
router.post('/profile/:profileId/integrations/:service/sync',
  controller.syncIntegration.bind(controller)
);

// revenue dash 

// Get revenue by link
router.get('/profile/:profileId/revenue',
  controller.getRevenueByLink.bind(controller)
);

// Get revenue metrics for specific link
router.get('/profile/:profileId/revenue/:linkId',
  controller.getLinkRevenueDetails.bind(controller)
);

// Get clicks vs revenue comparison
router.get('/profile/:profileId/clicks-vs-revenue',
  controller.getClicksVsRevenue.bind(controller)
);

// cohort revenue analysis 

// Get revenue by cohort
router.get('/profile/:profileId/cohort-revenue',
  controller.getCohortRevenue.bind(controller)
);

// Get specific cohort revenue details
router.get('/profile/:profileId/cohort-revenue/:cohortType/:cohortValue',
  controller.getCohortRevenueDetails.bind(controller)
);

// time bases revenue trends 

// Get revenue trends over time
router.get('/profile/:profileId/revenue-trends',
  controller.getRevenueTrends.bind(controller)
);

// Get time-of-day revenue breakdown
router.get('/profile/:profileId/revenue-by-time',
  controller.getRevenueByTime.bind(controller)
);

// customer ltv 

// Get customer lifetime value metrics
router.get('/profile/:profileId/ltv-metrics',
  controller.getLTVMetrics.bind(controller)
);

// Get LTV by link
router.get('/profile/:profileId/ltv/:linkId',
  controller.getLinkLTV.bind(controller)
);

// forecastings

// Get revenue forecast
router.get('/profile/:profileId/forecast',
  controller.getRevenueForecast.bind(controller)
);

// Get forecast for specific link
router.get('/profile/:profileId/forecast/:linkId',
  controller.getLinkForecast.bind(controller)
);

// attribution settings 

// Get attribution settings
router.get('/profile/:profileId/settings',
  controller.getAttributionSettings.bind(controller)
);

// Update attribution settings
router.patch('/profile/:profileId/settings',
  validateRequest(AttributionValidations.updateSettings),
  controller.updateAttributionSettings.bind(controller)
);

// fraud detect

// Get fraud alerts
router.get('/profile/:profileId/fraud-alerts',
  controller.getFraudAlerts.bind(controller)
);

// Resolve fraud alert
router.post('/fraud-alerts/:alertId/resolve',
  validateRequest(AttributionValidations.resolveFraudAlert),
  controller.resolveFraudAlert.bind(controller)
);

// webhook logs 

// Get webhook logs
router.get('/profile/:profileId/webhook-logs',
  controller.getWebhookLogs.bind(controller)
);

// reports

// Export revenue report
router.get('/profile/:profileId/export/revenue-report',
  controller.exportRevenueReport.bind(controller)
);

// Export customer LTV report
router.get('/profile/:profileId/export/ltv-report',
  controller.exportLTVReport.bind(controller)
);

export default router;