const cashFlowService = require('../services/cashFlowService');

async function getForecast(req, res, next) {
  try {
    const { months } = req.query;
    const parsedMonths = months ? parseInt(months, 10) : 3;

    if (months && (!Number.isFinite(parsedMonths) || parsedMonths < 1 || parsedMonths > 12)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_HORIZON', message: '"months" must be an integer between 1 and 12.' }
      });
    }

    const serviceForecast = await cashFlowService.getForecast(req.user.id, parsedMonths);
    const forecastMonths = serviceForecast.forecast.map(f => ({
      month: f.month,
      projectedIncome: f.expectedIncome,
      projectedExpense: f.expectedExpenses,
      projectedNetCashFlow: f.expectedNet,
      upperNetBound: f.upperBound,
      lowerNetBound: f.lowerBound,
      ...f
    }));

    const totalProjInc = forecastMonths.reduce((acc, f) => acc + f.projectedIncome, 0);
    const totalProjExp = forecastMonths.reduce((acc, f) => acc + f.projectedExpense, 0);
    const count = forecastMonths.length || 1;

    const forecastObj = {
      horizonMonths: serviceForecast.horizonMonths,
      historicalMonthsCount: serviceForecast.historicalMonthsCount,
      confidence: serviceForecast.confidence,
      confidenceReason: serviceForecast.confidenceReason,
      modelConfidence: serviceForecast.confidence === 'high' ? 'High' : serviceForecast.confidence === 'low' ? 'Low' : 'Medium',
      averages: {
        projectedIncome: Math.round((totalProjInc / count) * 100) / 100,
        projectedExpense: Math.round((totalProjExp / count) * 100) / 100,
        projectedNetCashFlow: Math.round(((totalProjInc - totalProjExp) / count) * 100) / 100
      },
      forecastMonths,
      historicalMonths: []
    };

    res.status(200).json({
      success: true,
      forecast: forecastObj,
      ...forecastObj
    });
  } catch (err) {
    next(err);
  }
}

async function getRisk(req, res, next) {
  try {
    const serviceRisk = await cashFlowService.getRisk(req.user.id);
    const risks = serviceRisk.reasons.map(r => ({
      type: r.title,
      message: r.message,
      severity: String(r.severity).toUpperCase(),
      ...r
    }));

    const riskEvaluation = {
      hasHighRisk: serviceRisk.riskLevel === 'high',
      riskLevel: serviceRisk.riskLevel,
      risks,
      reasonsCount: serviceRisk.reasonsCount
    };

    res.status(200).json({
      success: true,
      riskEvaluation,
      ...riskEvaluation
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getForecast,
  getRisk
};
