import { Request, Response } from 'express';
import { PresetService } from './preset.service'
import { asyncHandler } from '../../utils/async-handler'

export class PresetController {
   private service: PresetService;

  constructor() {
    this.service = new PresetService()}

  getPresetsForProfile = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const presets = await this.service.getPresetsForProfile(profileId, userId);
    res.json({ success: true, data: presets });
  });


  getPreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;

    const preset = await this.service.getPreset(presetId, userId);
    res.json({ success: true, data: preset });
  });



  createPreset = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, name, description, linkIds, metadata } = req.body;
    const userId = req.user.id;

    const preset = await this.service.createPreset(
      { profileId, name, description, linkIds, metadata},
      userId
    );

    res.status(201).json({ success: true, data: preset });
  });

  updatePreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;

    const preset = await this.service.updatePreset(presetId, req.body, userId)
    res.json({ success:true, data: preset });
  });

  deletePreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;

    await this.service.deletePreset(presetId, userId);
    res.json({ success: true, message: 'Preset deleted' });
  });


  activatePreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;

    const result = await this.service.activatePreset(presetId, userId);
    res.json({ success: true, data: result });
  });

  getActivePreset = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const activePreset = await this.service.getActivePreset(profileId, userId);
    res.json({ success: true, data: activePreset });
  });

  reorderLinksInPreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const { linkIds } = req.body;
    const userId = req.user.id;

    const result = await this.service.reorderLinksInPreset(
      presetId,
      linkIds,
      userId
    );
    res.json({ success: true, data: result });
  });

  // add link to preset
  addLinkToPreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const { linkId, position } = req.body;
    const userId = req.user.id;

    const result = await this.service.addLinkToPreset(
      presetId,
      linkId,
      position,
      userId
    );
    res.json({ success: true, data: result });
  });

  removeLinkFromPreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId, linkId } = req.params;
    const userId = req.user.id;

    const result = await this.service.removeLinkFromPreset(
      presetId,
      linkId,
      userId
    );
    res.json({ success: true, data: result });
  });

  clonePreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const { newName, newDescription } = req.body;
    const userId = req.user.id;

    const cloned = await this.service.clonePreset(
      presetId,
      newName,
      newDescription,
      userId
    );
    res.status(201).json({ success: true, data: cloned });
  });

  archivePreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;

    const result = await this.service.archivePreset(presetId, userId);
    res.json({ success: true, data: result });
  });

  restorePreset = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;

    const result = await this.service.restorePreset(presetId, userId);
    res.json({ success: true, data: result });
  });


  getArchivedPresets = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const presets = await this.service.getArchivedPresets(profileId, userId);
    res.json({ success: true, data: presets });
  });


   getPresetAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;

    const analytics = await this.service.getPresetAnalytics(presetId, userId);
    res.json({ success: true, data: analytics });
  });

  comparePresets = asyncHandler(async (req:Request, res: Response) => {
    const { profileId } = req.params;
    const { presetIds } = req.body;
    const userId = req.user.id;

    const comparison = await this.service.comparePresets(
      profileId,
      presetIds,
      userId
    )
    res.json({ success: true, data: comparison })
  });



  getPresetHistory = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;

    const history = await this.service.getPresetHistory(presetId, userId);
    res.json({ success: true, data: history });
  });


  addAvailabilityRule = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;

    const rule = await this.service.addAvailabilityRule(presetId, req.body, userId);
    res.status(201).json({ success: true, data: rule });
  });

  updateAvailabilityRule = asyncHandler(async (req: Request, res: Response) => {
    const { presetId, ruleId } = req.params;
    const userId = req.user.id;

    const rule = await this.service.updateAvailabilityRule(
      presetId,
      ruleId,
      req.body,
      userId
    );
    res.json({ success: true, data: rule });
  });

  removeAvailabilityRule = asyncHandler(async (req: Request, res: Response) => {
    const { presetId, ruleId } = req.params;
    const userId = req.user.id;

    await this.service.removeAvailabilityRule(presetId, ruleId, userId);
    res.json({ success: true, message: 'Rule removed' 

    })

  })

  getAvailabilityRules = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const userId = req.user.id;
    const rules = await this.service.getAvailabilityRules(presetId, userId);
    res.json({ success: true, data: rules })
  });

  exportPresetAsTemplate = asyncHandler(async (req:Request, res:Response) =>{
    const { presetId } = req.params;
    const userId = req.user.id;

    const template = await this.service.exportPresetAsTemplate(
      presetId,
      req.body,
      userId
    );
    res.status(201).json({ success:true, data: template});
  })

  importFromTemplate = asyncHandler(async (req:Request, res:Response) =>{
    const userId = req.user.id;
    const preset = await this.service.importFromTemplate(req.body, userId);
    res.status(201).json({success:true, data:preset})
  });



  getPublicTemplates = asyncHandler(async (req: Request, res: Response) => {
    const templates = await this.service.getPublicTemplates();
    res.json({ success: true, data: templates });
  });

  bulkAddLinks = asyncHandler(async (req: Request, res: Response) => {
    const { presetId } = req.params;
    const { links } = req.body;
    const userId = req.user.id;

    const result = await this.service.bulkAddLinks(presetId, links, userId);
    res.status(201).json({ success: true, data: result });
  })
}