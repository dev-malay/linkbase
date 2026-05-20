import { Request, Response } from 'express';
import { LinkService } from './link.service';
import { LinkRepository } from './link.repository';
import { asyncHandler } from '../../utils/async-handler';

export class LinkController {
  private service: LinkService;
  private repository: LinkRepository;

  constructor() {
    this.repository = new LinkRepository();
    this.service = new LinkService(this.repository);
  }

  // Get all links for a profile
  getLinksForProfile = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const links = await this.service.getLinksForProfile(profileId, userId);
    res.json({ success: true, data: links });
  });

  // get single link

   getLink = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const link = await this.service.getLink(linkId, userId);
    res.json({ success: true, data: link });
  });

  // create new link
  createLink = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, title, url, description, position, backupUrl } = req.body;
    const userId = req.user.id;

    const link = await this.service.createLink(
      {
        profileId,
        title,
        url,
        description,
        position,
        backupUrl,
      },
      userId
    );

    res.status(201).json({ success: true, data: link });
  });

  // Update link
  updateLink = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const link = await this.service.updateLink(linkId, req.body, userId);
    res.json({ success: true, data: link });
  });


  // Delete link

  deleteLink = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    await this.service.deleteLink(linkId, userId);
    res.json({ success: true, message: 'Link deleted' });
  });

  // live link control endpointss

  // one tap  SWAP : Swap featured link to a different one
  swapLink = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const { profileId, swapWithLinkId } = req.body;
    const userId = req.user.id;

    const result = await this.service.swapLink(
      linkId,
      profileId,
      swapWithLinkId,
      userId
    );

    res.json({
      success: true,
      data: result,
      message: 'Link swapped successfully',
    });
  });

  // preview the link before swapping
  previewLink = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const preview = await this.service.previewLink(linkId, userId);
    res.json({ success: true, data: preview });
  })


  // Reorder multiple links at once
  reorderLinks = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const { links } = req.body;
    const userId = req.user.id;

    const result = await this.service.reorderLinks(profileId, links, userId);
    res.json({ success: true, data: result });
  });



  // Get swap history (  for undo feature )
  getSwapHistory = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const history = await this.service.getSwapHistory(profileId, userId);
    res.json({ success: true, data: history });
  })



  // undo recent swap
  undoSwap = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.body;
    const userId = req.user.id;

    const result = await this.service.undoSwap(profileId, userId);
    res.json({
      success: true,
      data: result,
      message: 'Swap undone',
    });
  });

  // get analytics for swap comparison
  getSwapAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const userId = req.user.id;

    const analytics = await this.service.getSwapAnalytics(linkId, userId);
    res.json({ success: true, data: analytics });
  });

  // schedule a link swap for future time
  scheduleSwap = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const { profileId, scheduledFor, swapWithLinkId, note } = req.body;
    const userId = req.user.id;

    const scheduled = await this.service.scheduleSwap(
      {
        linkId,
        profileId,
        scheduledFor: new Date(scheduledFor),
        swapWithLinkId,
        note,
      },
      userId
    );

    res.status(201).json({
      success: true,
      data: scheduled,
      message: 'Swap scheduled',
    });
  });

  // get all scheduled swaps for profile
  getScheduledSwaps = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const scheduled = await this.service.getScheduledSwaps(
      profileId,
      userId
    );
    res.json({ success: true, data: scheduled });
  });
 





   // cancel a scheduled swap
  cancelScheduledSwap = asyncHandler(async (req: Request, res: Response) => {
    const { swapId } = req.params;
    const userId = req.user.id;

    await this.service.cancelScheduledSwap(swapId, userId);
    res.json({ success: true, message: 'Scheduled swap cancelled' });
  });

  // activate backup link (if the  primary breaks)
  activateBackupLink = asyncHandler(async (req: Request, res: Response) => {
    const { linkId } = req.params;
    const { profileId } = req.body;
    const userId = req.user.id;

    const result = await this.service.activateBackupLink(
      linkId,
      profileId,
      userId
    );

    res.json({
      success: true,
      data: result,
      message: 'Backup link activated',
    });
  });
 
}