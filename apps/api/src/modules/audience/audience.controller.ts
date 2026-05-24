import { Request, Response } from 'express';
import { AudienceService } from './audience.service';
import { asyncHandler } from '../../utils/async-handler';

export class AudienceController {
  private service: AudienceService;

  constructor() {
    this.service = new AudienceService();
  }

      // core predictions 

  getPredictedLinkOrder = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;

    const prediction = await this.service.getPredictedLinkOrder(profileId, req.body);
    res.json({ success: true, data: prediction });
  });

    // personalisation rules 

  getPersonalizationRules = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const rules = await this.service.getPersonalizationRules(profileId, userId);
    res.json({ success: true, data: rules });
  });

  createPersonalizationRule = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const rule = await this.service.createPersonalizationRule(profileId, req.body, userId);
    res.status(201).json({ success: true, data: rule });
  });

  updatePersonalizationRule = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, ruleId } = req.params;
    const userId = req.user.id;

    const rule = await this.service.updatePersonalizationRule(
      profileId,
      ruleId,
      req.body,
      userId
    );
    res.json({ success: true, data: rule });
  });

  deletePersonalizationRule = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, ruleId } = req.params;
    const userId = req.user.id;

    await this.service.deletePersonalizationRule(profileId, ruleId, userId);
    res.json({ success: true, message: 'Rule deleted' });
  });

  reorderRules = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const { rules } = req.body;
    const userId = req.user.id;

    const result = await this.service.reorderRules(profileId, rules, userId);
    res.json({ success: true, data: result });
  });

//  cohort analysis 

  getCohorts = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const { period } = req.query;

    const cohorts = await this.service.getCohorts(
      profileId,
      userId,
      period as string | undefined
    );
    res.json({ success: true, data: cohorts });
  });

  getCohortDetails = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, cohortId } = req.params;
    const userId = req.user.id;

    const details = await this.service.getCohortDetails(profileId, cohortId, userId);
    res.json({ success: true, data: details });
  });

  getCohortComparison = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const comparison = await this.service.getCohortComparison(profileId, userId);
    res.json({ success: true, data: comparison });
  });

//  persolnalisation setings 

  getPersonalizationSettings = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const settings = await this.service.getPersonalizationSettings(profileId, userId);
    res.json({ success: true, data: settings });
  });

  updatePersonalizationSettings = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const settings = await this.service.updatePersonalizationSettings(
      profileId,
      req.body,
      userId)
    res.json({ success: true, data: settings });
  });

  togglePersonalization = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const result = await this.service.togglePersonalization(profileId, userId);
    res.json({ success: true, data: result });
  });

//  ml model 

  getModelInfo = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const model = await this.service.getModelInfo(profileId, userId);
    res.json({ success: true, data: model });
  });

  retrainModel = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const result = await this.service.retrainModel(profileId, userId);
    res.json({ success: true, data: result });
  });

  getModelMetrics = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const metrics = await this.service.getModelMetrics(profileId, userId);
    res.json({ success: true, data: metrics });
  });

//  visitor profiles 

  getRecentVisitors = asyncHandler(async (req: Request, res: Response) =>{
    const { profileId } = req.params;
    const userId = req.user.id;
    const { limit } = req.query;
    const visitors = await this.service.getRecentVisitors(
      profileId,
      userId,
      parseInt(limit as string) || 50
    );
    res.json({ success: true, data: visitors });
  });

  getVisitorProfileDetails = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, visitorProfileId } = req.params;
    const userId = req.user.id;
    const visitor = await this.service.getVisitorProfileDetails(
      profileId,
      visitorProfileId,
      userId
    );
    res.json({ success: true, data: visitor });
  });

//   ab testing 

  startABTest = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const test = await this.service.startABTest(profileId, req.body, userId);
    res.status(201).json({ success: true, data: test });
  });

  getActiveABTests = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const tests = await this.service.getActiveABTests(profileId, userId);
    res.json({ success: true, data: tests });
  });

  getABTestResults = asyncHandler(async (req: Request, res: Response) => {
    const { testId } = req.params;
    const userId = req.user.id;
    const results = await this.service.getABTestResults(testId, userId);
    res.json({ success: true, data: results });
  });

  endABTest = asyncHandler(async (req: Request, res: Response) =>{
    const { testId } = req.params;
    const userId = req.user.id;
    const result = await this.service.endABTest(testId, userId);
    res.json({ success: true, data: result });
  });

    // analytics and insights 

  getPersonalizationImpact = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const impact = await this.service.getPersonalizationImpact(profileId, userId);
    res.json({ success: true, data: impact });
  });

  getAudienceInsights = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const insights = await this.service.getAudienceInsights(profileId, userId);
    res.json({ success: true, data: insights });
  });

  getCustomAttributesSetup = asyncHandler(async(req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const setup = await this.service.getCustomAttributesSetup(profileId, userId);
    res.json({ success: true, data: setup });
  });

  configureCustomAttributes = asyncHandler(async(req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const config = await this.service.configureCustomAttributes(
      profileId,
      req.body,
      userId
    );
    res.json({ success: true, data: config });
  });
}