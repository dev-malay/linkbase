import { Router } from 'express';
import { TimeoutController } from './timeout.controller';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validator';
import { TimeoutValidations } from './timeout.validations';

const router = Router();
const controller = new TimeoutController();

router.use(authMiddleware);

// timeout config 

// Get timeout for link
router.get('/link/:linkId',
  controller.getLinkTimeout.bind(controller)
);

// Create/configure timeout
router.post('/link/:linkId',
  validateRequest(TimeoutValidations.createTimeout),
  controller.createLinkTimeout.bind(controller)
);

// Update timeout
router.patch('/timeout/:timeoutId',
  validateRequest(TimeoutValidations.updateTimeout),
  controller.updateLinkTimeout.bind(controller)
);

// Delete timeout
router.delete('/timeout/:timeoutId',
  controller.deleteLinkTimeout.bind(controller)
);

// time config

// Configure time-based expiration
router.post('/link/:linkId/time-based',
  validateRequest(TimeoutValidations.configureTimeBased),
  controller.configureTimeBased.bind(controller)
);

// Configure recurring schedule
router.post('/link/:linkId/recurring',
  validateRequest(TimeoutValidations.configureRecurring),
  controller.configureRecurring.bind(controller)
);

//  visitor count limits 

// Configure visitor count limit
router.post('/link/:linkId/visitor-limit',
  validateRequest(TimeoutValidations.configureVisitorLimit),
  controller.configureVisitorLimit.bind(controller)
);

// Get current visitor count
router.get('/link/:linkId/visitor-count',
  controller.getVisitorCount.bind(controller)
);

// Reset visitor counter
router.post('/link/:linkId/reset-counter',
  controller.resetVisitorCounter.bind(controller)
);


// Configure conditional rules
router.post('/link/:linkId/conditional',
  validateRequest(TimeoutValidations.configureConditional),
  controller.configureConditional.bind(controller)
);

// fallback and msgs

// Configure fallback link
router.post('/timeout/:timeoutId/fallback',
  validateRequest(TimeoutValidations.setFallback),
  controller.setFallbackLink.bind(controller)
);

// Configure urgency messaging
router.patch('/timeout/:timeoutId/urgency',
  validateRequest(TimeoutValidations.configureUrgency),
  controller.configureUrgencyMessage.bind(controller)
);

// reminders and wh

// Configure reminder emails
router.post('/timeout/:timeoutId/reminders',
  validateRequest(TimeoutValidations.configureReminders),
  controller.configureReminders.bind(controller)
);

// Configure expiration webhook
router.post('/timeout/:timeoutId/webhook',
  validateRequest(TimeoutValidations.configureWebhook),
  controller.configureWebhook.bind(controller)
);

// scheduled changes

// Get scheduled changes
router.get('/profile/:profileId/scheduled-changes',
  controller.getScheduledChanges.bind(controller)
);

// Schedule a link change
router.post('/schedule-change',
  validateRequest(TimeoutValidations.scheduleChange),
  controller.scheduleChange.bind(controller)
);

// Cancel scheduled change
router.delete('/scheduled/:changeId',
  controller.cancelScheduledChange.bind(controller)
);

// archives history
// Get archived timeouts
router.get('/profile/:profileId/archived',
  controller.getArchivedTimeouts.bind(controller)
);

// Get archived timeout details
router.get('/archived/:archivedId',
  controller.getArchivedDetails.bind(controller)
);

// Reactivate archived timeout
router.post('/archived/:archivedId/reactivate',
  validateRequest(TimeoutValidations.reactivateArchived),
  controller.reactivateArchived.bind(controller)
);

// link variant

// Create link variant
router.post('/link/:linkId/variant',
  validateRequest(TimeoutValidations.createVariant),
  controller.createVariant.bind(controller)
);

// Get variants
router.get('/link/:linkId/variants',
  controller.getVariants.bind(controller)
);

// Update variant
router.patch('/variant/:variantId',
  validateRequest(TimeoutValidations.updateVariant),
  controller.updateVariant.bind(controller)
);

// Start ab test for variants
router.post('/link/:linkId/ab-test',
  validateRequest(TimeoutValidations.startABTest),
  controller.startVariantABTest.bind(controller)
)

// Get expiration events
router.get('/profile/:profileId/events',
  controller.getExpirationEvents.bind(controller)
)

// Bulk schedule link changes
router.post('/profile/:profileId/bulk-schedule',
  validateRequest(TimeoutValidations.bulkSchedule),
  controller.bulkScheduleChanges.bind(controller)
);

export default router;