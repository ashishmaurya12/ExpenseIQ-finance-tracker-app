const anomalyService = require('../services/anomalyService');

async function getAnomalies(req, res, next) {
  try {
    const anomalies = await anomalyService.detectAnomalies(req.user.id);
    res.status(200).json({
      success: true,
      count: anomalies.length,
      anomalies
    });
  } catch (err) {
    next(err);
  }
}

async function analyzeAnomalies(req, res, next) {
  try {
    const result = await anomalyService.analyzeAnomalies(req.user.id);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAnomalies,
  analyzeAnomalies
};
