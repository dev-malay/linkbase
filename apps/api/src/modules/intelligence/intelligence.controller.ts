import { Request, Response } from 'express';
import { IntelligenceService } from './intelligence.service';
import { asyncHandler } from '../../utils/async-handler'



export class IntelligenceController {
  private service: IntelligenceService;


  constructor(){
   this.service = new IntelligenceService()}
  getOptimizationSettings = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const settings = await this.service.getOptimizationSettings(profileId, userId);
    res.json({ success: true, data: settings });
  });

  updateOptimizationSettings = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const updated = await this.service.updateOptimizationSettings(
      profileId,
      req.body,
      userId
    );
    res.json({ success: true, data: updated });
  });

  toggleAutoOptimize = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const result = await this.service.toggleAutoOptimize(profileId, userId);
    res.json({ success: true, data: result });
  })


// patern detection and learning 

  getDetectedPatterns = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const { patternType } = req.query;

    const patterns = await this.service.getDetectedPatterns(
      profileId,
      userId,
      patternType as string |undefined
    );
    res.json({ success: true, data: patterns});
  });

  getPatternDetails = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, patternType, dimension } = req.params;
    const userId = req.user.id;
    const details = await this.service.getPatternDetails(
       profileId,
      patternType,
      dimension,
      userId
    )
    res.json({ success:true, data: details});
  });

  getLearningsDashboard = asyncHandler(async (req:Request, res:Response) =>{
    const { profileId } = req.params;
    const userId = req.user.id;

    const dashboard = await this.service.getLearningsDashboard(profileId, userId);
    res.json({ success: true, data: dashboard });
  });


// optimize suggestions 

  getPendingSuggestions = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const suggestions = await this.service.getPendingSuggestions(profileId, userId);
    res.json({ success: true, data: suggestions });
  });

  getSuggestion = asyncHandler(async(req: Request, res: Response) =>{
    const { suggestionId } = req.params;
    const userId = req.user.id;
    const suggestion = await this.service.getSuggestion(suggestionId, userId);
    res.json({ success: true, data: suggestion });
  });

  approveSuggestion = asyncHandler(async (req: Request, res: Response) => {
    const { suggestionId } = req.params;
    const userId = req.user.id;

    const result = await this.service.approveSuggestion(suggestionId, userId);
    res.json({ success: true, data: result });
  });

  rejectSuggestion = asyncHandler(async (req: Request, res: Response) => {
    const { suggestionId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    await this.service.rejectSuggestion(suggestionId, reason, userId);
    res.json({ success: true, message: 'Suggestion rejected' });
  });

// ranking history 
  getRankingHistory = asyncHandler(async (req: Request, res:Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const history = await this.service.getRankingHistory(profileId, userId);
    res.json({ success: true, data: history })
  });

  getRankingPerformance = asyncHandler(async (req: Request, res:Response) =>{
    const { profileId, rankingId } = req.params;
    const userId = req.user.id
    const performance = await this.service.getRankingPerformance(
      profileId,
      rankingId,
      userId
    );
    res.json({ success: true, data: performance })
  });

  compareRankings = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const { rankingId1, rankingId2 } = req.body;
    const userId = req.user.id;

    const comparison = await this.service.compareRankings(
      profileId,
      rankingId1,
      rankingId2,
      userId
    );
    res.json({ success: true, data: comparison });
  });

  revertToRanking = asyncHandler(async (req: Request, res: Response) => {
    const { rankingId } = req.params;
    const userId = req.user.id;

    const result = await this.service.revertToRanking(rankingId, userId);
    res.json({ success: true, data: result });
  });



// ab tests 

  startABTest = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const { variantRanking, splitPercentage, minSampleSize } = req.body;
    const userId = req.user.id;

    const test = await this.service.startABTest(
      profileId,
      variantRanking,
      splitPercentage,
      minSampleSize,
      userId
    );
    res.status(201).json({ success: true, data: test });
  });

  getABTestStatus = asyncHandler(async (req: Request, res: Response) => {
    const { testId } = req.params;
    const userId = req.user.id;

    const status = await this.service.getABTestStatus(testId, userId);
    res.json({ success: true, data: status });
  });

  getActiveABTests = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const tests = await this.service.getActiveABTests(profileId, userId);
    res.json({ success: true, data: tests });
  });

  endABTest = asyncHandler(async (req: Request, res: Response) => {
    const { testId } = req.params;
    const userId = req.user.id;

    const result = await this.service.endABTest(testId, userId);
    res.json({ success: true, data: result });
  });

  getABTestResults = asyncHandler(async (req: Request, res: Response) => {
    const { testId } = req.params;
    const userId = req.user.id;

    const results = await this.service.getABTestResults(testId, userId);
    res.json({ success: true, data: results });
  });

  applyABTestWinner = asyncHandler(async (req: Request, res: Response) => {
    const { testId } = req.params;
    const userId = req.user.id;

    const result = await this.service.applyABTestWinner(testId, userId);
    res.json({ success: true, data: result });
  })



// analytics n insights 

  getLinkLeaderboard = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const { days } = req.query;

    const leaderboard = await this.service.getLinkLeaderboard(
      profileId,
      userId,
      parseInt(days as string) || 7
    );
    res.json({ success: true, data: leaderboard });
  });

  getOptimizationImpact = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const impact = await this.service.getOptimizationImpact(profileId, userId);
    res.json({ success: true, data: impact });
  });

  predictRankingForCampaign = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const { season, timeframe } = req.query;
    const userId = req.user.id;

    const prediction = await this.service.predictRankingForCampaign(
      profileId,
      season as string | undefined,
      timeframe as string | undefined,
      userId
    );
    res.json({ success: true, data: prediction });
  });

// manual overrides 

  setOptimizationRule = asyncHandler(async (req: Request, res:Response) =>{
    const { profileId } = req.params;
    const userId = req.user.id;

    const rule = await this.service.setOptimizationRule(profileId, req.body, userId);
    res.status(201).json({ success: true, data: rule });
  });

  getOptimizationRules = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const rules = await this.service.getOptimizationRules(profileId, userId);
    res.json({ success: true, data: rules });
  });

  deleteOptimizationRule = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, ruleId } = req.params;
    const userId = req.user.id;
    await this.service.deleteOptimizationRule(profileId, ruleId, userId);
    res.json({ success: true, message: 'Rule deleted' })
  })

}