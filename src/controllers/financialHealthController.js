const financialHealthService = require('../services/financialHealthService');

async function getFinancialHealth(req, res, next) {
  try {
    const health = await financialHealthService.calculateHealthScore(req.user.id);
    res.status(200).json({
      success: true,
      health,
      financialHealth: health,
      ...health
    });
  } catch (err) {
    next(err);
  }
}

async function getRecommendations(req, res, next) {
  try {
    const recommendations = await financialHealthService.getRecommendations(req.user.id);
    res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFinancialHealth,
  getRecommendations
};
