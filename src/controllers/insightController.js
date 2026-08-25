const { generateInsights } = require('../utils/insightEngine');

/**
 * GET /api/insights
 */
async function getInsights(req, res, next) {
  try {
    const data = await generateInsights(req.user.id);
    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getInsights };
