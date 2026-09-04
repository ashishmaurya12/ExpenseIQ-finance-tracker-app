const { getChatReply, generatePersonalizedInsights } = require('../services/aiService');
const { AI_ENABLED } = require('../config/config');

/**
 * POST /api/ai/chat
 * Send user query to AI Financial Assistant
 */
async function chat(req, res, next) {
  try {
    if (!AI_ENABLED) {
      return res.status(503).json({
        success: false,
        message: 'AI features are currently unavailable.'
      });
    }

    const { message, history } = req.body || {};

    // Input Validation
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid non-empty message is required.'
      });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Message length exceeds the maximum limit of 500 characters.'
      });
    }

    // User ID is strictly derived from authenticated JWT (req.user.id)
    const userId = req.user.id;

    const result = await getChatReply(userId, trimmedMessage, history);

    return res.status(200).json({
      success: true,
      reply: result.reply
    });
  } catch (err) {
    const statusCode = err.statusCode || 503;
    const clientMessage = statusCode === 503 
      ? (err.message || 'AI assistant is temporarily unavailable.')
      : 'An unexpected error occurred while processing your AI request.';

    return res.status(statusCode).json({
      success: false,
      message: clientMessage
    });
  }
}

/**
 * GET /api/ai/insights
 * Retrieve 3-5 personalized AI financial insights
 */
async function getPersonalizedInsights(req, res, next) {
  try {
    if (!AI_ENABLED) {
      return res.status(503).json({
        success: false,
        message: 'AI features are currently unavailable.'
      });
    }

    const userId = req.user.id;
    const insights = await generatePersonalizedInsights(userId);

    return res.status(200).json({
      success: true,
      insights: insights || []
    });
  } catch (err) {
    const statusCode = err.statusCode || 503;
    const clientMessage = statusCode === 503 
      ? (err.message || 'AI insights are temporarily unavailable.')
      : 'An unexpected error occurred while generating AI insights.';

    return res.status(statusCode).json({
      success: false,
      message: clientMessage
    });
  }
}

module.exports = {
  chat,
  getPersonalizedInsights
};
