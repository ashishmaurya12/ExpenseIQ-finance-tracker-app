const rateLimit = require('express-rate-limit');

/**
 * Strict rate limiter for authentication routes (login / register).
 * Prevents brute-force attacks while allowing reasonable dev usage.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
  }
});

/**
 * General rate limiter for standard API routes.
 */
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

/**
 * Dedicated rate limiter for AI chat and insights endpoints.
 * Protects against excessive OpenAI API costs and spam.
 */
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit to 30 AI requests per 15 minutes
  keyGenerator: (req) => (req.user && req.user.id ? `user_${req.user.id}` : req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests from this user account. Please wait a few minutes before trying again.'
  }
});


module.exports = {
  authRateLimiter,
  apiRateLimiter,
  aiRateLimiter
};

