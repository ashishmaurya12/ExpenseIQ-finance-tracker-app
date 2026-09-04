/**
 * Centralized error-handling middleware.
 * Catches all errors thrown in route handlers and returns a consistent JSON response.
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID or format for field: ${err.path}`;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {}).map(e => e.message).join(' ');
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request payload too large. Maximum allowed size is 100kb.';
  } else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON body in request.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorHandler;
