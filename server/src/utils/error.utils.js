/**
 * Error handling utilities
 */

// Custom API Error class
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Error response handler
const errorResponse = (res, statusCode = 500, message = 'Internal Server Error') => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = {
  ApiError,
  errorResponse,
};
