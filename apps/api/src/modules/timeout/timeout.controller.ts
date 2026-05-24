import { Request, Response } from 'express';
import { TimeoutService } from './timeout.service';
import { asyncHandler } from '../../utils/async-handler';

export class TimeoutController {
  private service: TimeoutService;

  constructor() {
    this.service = new TimeoutService();
  }

//crud

  getLinkTimeout = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.getLinkTimeout(linkId, userId);
    res.json({ success: true, data: timeout });
  });

  createLinkTimeout = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.createLinkTimeout(linkId, req.body, userId);
    res.status(201).json({ success: true, data: timeout });
  });

  updateLinkTimeout = asyncHandler(async (req: Request, res: Response) => {
    const { timeoutId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.updateLinkTimeout(timeoutId, req.body, userId);
    res.json({ success: true, data: timeout });
  });

  deleteLinkTimeout = asyncHandler(async (req: Request, res: Response) => {
    const { timeoutId } = req.params;
    const userId = req.user.id;

    await this.service.deleteLinkTimeout(timeoutId, userId);
    res.json({ success: true, message: 'Timeout deleted' });
  });

// time based 

  configureTimeBased = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.configureTimeBased(linkId, req.body, userId);
    res.json({ success: true, data: timeout });
  });

  configureRecurring = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.configureRecurring(linkId, req.body, userId);
    res.json({ success: true, data: timeout });
  });

  configureVisitorLimit = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.configureVisitorLimit(linkId, req.body, userId);
    res.json({ success: true, data: timeout });
  });

  getVisitorCount = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const count = await this.service.getVisitorCount(linkId, userId);
    res.json({ success: true, data: count });
  });

  resetVisitorCounter = asyncHandler(async (req: Request, res: Response) =>{
    const { linkId } = req.params;
    const userId = req.user.id;

    const result = await this.service.resetVisitorCounter(linkId, userId);
    res.json({ success: true, data: result });
  });

  // conditionals

  configureConditional = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.configureConditional(linkId, req.body, userId);
    res.json({ success: true, data: timeout });
  });

  // fallback and messagings 

  setFallbackLink = asyncHandler(async (req: Request, res: Response) => {
    const { timeoutId } = req.params;
    const { fallbackLinkId } = req.body;
    const userId = req.user.id;

    const timeout = await this.service.setFallbackLink(timeoutId, fallbackLinkId, userId);
    res.json({ success: true, data: timeout });
  });

  configureUrgencyMessage = asyncHandler(async (req: Request, res: Response) => {
    const { timeoutId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.configureUrgencyMessage(timeoutId, req.body, userId);
    res.json({ success: true, data: timeout });
  });

  // reminders and wh

  configureReminders = asyncHandler(async (req: Request, res: Response) => {
    const { timeoutId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.configureReminders(timeoutId, req.body,userId);
    res.json({ success: true, data: timeout });
  });

  configureWebhook = asyncHandler(async (req: Request, res: Response) => {
    const { timeoutId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.configureWebhook(timeoutId, req.body, userId);
    res.json({ success: true, data: timeout });
  });

  // scheduled changes 

  getScheduledChanges = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const changes = await this.service.getScheduledChanges(profileId, userId);
    res.json({ success: true, data: changes });
  });

  scheduleChange = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user.id;

    const scheduled = await this.service.scheduleChange(req.body, userId);
    res.status(201).json({ success: true, data: scheduled });
  });

  cancelScheduledChange = asyncHandler(async (req: Request, res: Response) => {
    const { changeId } = req.params;
    const userId = req.user.id;

    await this.service.cancelScheduledChange(changeId, userId);
    res.json({ success: true, message: 'Scheduled change cancelled' });
  });

  // archived 

  getArchivedTimeouts = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const archived = await this.service.getArchivedTimeouts(profileId, userId);
    res.json({ success: true, data: archived });
  });

  getArchivedDetails = asyncHandler(async (req: Request, res: Response) => {
    const { archivedId } = req.params;
    const userId = req.user.id;

    const details = await this.service.getArchivedDetails(archivedId, userId);
    res.json({ success: true, data: details });
  });

  reactivateArchived = asyncHandler(async (req: Request, res: Response) => {
    const { archivedId } = req.params;
    const userId = req.user.id;

    const timeout = await this.service.reactivateArchived(archivedId, req.body, userId);
    res.json({ success: true, data: timeout });
  });

  // variants 

  createVariant = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const variant = await this.service.createVariant(linkId, req.body, userId);
    res.status(201).json({ success: true, data: variant });
  });

  getVariants = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const variants = await this.service.getVariants(linkId, userId);
    res.json({ success: true, data: variants });
  });

  updateVariant = asyncHandler(async (req: Request, res: Response) => {
    const { variantId } = req.params;
    const userId = req.user.id;

    const variant = await this.service.updateVariant(variantId, req.body, userId);
    res.json({ success: true, data: variant });
  });

  startVariantABTest = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const test = await this.service.startVariantABTest(linkId, req.body, userId);
    res.status(201).json({ success: true, data: test });
  });

  // events 

  getExpirationEvents = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const events = await this.service.getExpirationEvents(profileId, userId);
    res.json({ success: true, data: events });
  });

  // bulk

  bulkScheduleChanges = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const { changes } = req.body;
    const userId = req.user.id;

    const result = await this.service.bulkScheduleChanges(profileId, changes, userId);
    res.json({ success: true, data: result });
  });
}