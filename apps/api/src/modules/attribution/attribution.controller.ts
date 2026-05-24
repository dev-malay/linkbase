import { Request, Response } from 'express';
import { AttributionService } from './attribution.service';
import { asyncHandler } from '../../utils/async-handler';

export class AttributionController {
  private service: AttributionService;

  constructor() {
    this.service = new AttributionService();
  }

  // wh

  handleWebhook = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, source } = req.params;

    const result = await this.service.handleWebhook(profileId, source, req.body)
    res.json({ success: true, data: result });
  });

  // integration

  getIntegrations = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const integrations = await this.service.getIntegrations(profileId, userId);
    res.json({ success: true, data: integrations })
  });

  configureIntegration = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const integration = await this.service.configureIntegration(
      profileId,
      req.body,
      userId
    );
    res.status(201).json({ success: true, data: integration });
  });

  disconnectIntegration = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, service } = req.params;
    const userId = req.user.id;
    await this.service.disconnectIntegration(profileId, service, userId);
    res.json({ success: true, message: 'Integration disconnected' });
  });

  getIntegrationStatus = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, service } = req.params;
    const userId = req.user.id;

    const status = await this.service.getIntegrationStatus(profileId, service, userId);
    res.json({ success: true, data: status });
  });

  syncIntegration = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, service } = req.params;
    const userId = req.user.id;

    const result = await this.service.syncIntegration(profileId, service, userId);
    res.json({ success: true, data: result });
  });

  // revenue dashboard 

  getRevenueByLink = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const { days } = req.query;

    const revenue = await this.service.getRevenueByLink(
      profileId,
      userId,
      parseInt(days as string) || 30
    );
    res.json({ success: true, data: revenue });
  });

  getLinkRevenueDetails = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, linkId } = req.params;
    const userId = req.user.id;

    const details = await this.service.getLinkRevenueDetails(profileId, linkId, userId);
    res.json({ success: true, data: details });
  });

  getClicksVsRevenue = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const comparison = await this.service.getClicksVsRevenue(profileId, userId);
    res.json({ success: true, data: comparison });
  });

  // cohort rev analysis

  getCohortRevenue = asyncHandler(async(req: Request, res: Response) => {
    const { profileId } = req.params
    const userId = req.user.id;

    const revenue = await this.service.getCohortRevenue(profileId, userId);
    res.json({ success: true, data: revenue })});

  getCohortRevenueDetails =asyncHandler(async (req: Request, res: Response) => {
    const { profileId, cohortType, cohortValue } = req.params;
    const userId = req.user.id;

    const details = await this.service.getCohortRevenueDetails(
      profileId,
      cohortType,
      cohortValue,
      userId
    );
    res.json({ success: true, data: details });
  });

  // timebased trends 

  getRevenueTrends = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const { days } = req.query;

    const trends = await this.service.getRevenueTrends(
      profileId,
      userId,
      parseInt(days as string) || 30
    );
    res.json({ success: true, data: trends });
  })

  getRevenueByTime = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const breakdown = await this.service.getRevenueByTime(profileId, userId);
    res.json({ success: true, data: breakdown });
  });

  // ltv

  getLTVMetrics = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const metrics = await this.service.getLTVMetrics(profileId, userId);
    res.json({ success: true, data: metrics });
  });

  getLinkLTV = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, linkId } = req.params;
    const userId = req.user.id;

    const ltv = await this.service.getLinkLTV(profileId, linkId, userId);
    res.json({ success: true, data: ltv });
  });

  // forecastin

  getRevenueForecast = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const { days } = req.query;

    const forecast = await this.service.getRevenueForecast(
      profileId,
      userId,
      parseInt(days as string) || 7
    );
    res.json({ success: true, data: forecast });
  });

  getLinkForecast = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, linkId } = req.params;
    const userId = req.user.id;

    const forecast = await this.service.getLinkForecast(profileId, linkId, userId);
    res.json({ success: true, data: forecast });
  });

  // settings

  getAttributionSettings = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const settings = await this.service.getAttributionSettings(profileId, userId);
    res.json({ success: true, data: settings });
  });

  updateAttributionSettings = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const settings = await this.service.updateAttributionSettings(
      profileId,
      req.body,
      userId
    );
    res.json({ success: true, data: settings });
  });


  getFraudAlerts = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;

    const alerts = await this.service.getFraudAlerts(profileId, userId);
    res.json({ success: true, data: alerts });
  });

  resolveFraudAlert = asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;
    const { resolution, notes } = req.body;
    const userId = req.user.id;

    const result = await this.service.resolveFraudAlert(alertId, resolution, notes, userId);
    res.json({ success: true, data: result });
  });

// Logs 

  getWebhookLogs = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const { limit, source } = req.query;

    const logs = await this.service.getWebhookLogs(
      profileId,
      userId,
      parseInt(limit as string) || 50,
      source as string | undefined
    );
    res.json({ success: true, data: logs });
  });

//  reports 

  exportRevenueReport = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const { format, days } = req.query;

    const report = await this.service.exportRevenueReport(
      profileId,
      userId,
      format as string || 'json',
      parseInt(days as string) || 30
    );

    res.setHeader('Content-Type',format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-report.${format === 'csv' ? 'csv' : 'json'}"`);
    res.send(report);
  });

  exportLTVReport = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    const userId = req.user.id;
    const { format } = req.query;

    const report = await this.service.exportLTVReport(
      profileId,
      userId,
      format as string || 'json'
    );

    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ltv-report.${format === 'csv' ? 'csv' : 'json'}"`);
    res.send(report);
  });
}