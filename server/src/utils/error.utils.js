/**
 * Error utilities for standardizing error responses across the application
 */

/**
 * Creates a standardized error response object
 * @param {string} title - A short title for the error
 * @param {string} message - A more detailed explanation of the error
 * @param {Object} options - Optional additional details about the error
 * @returns {Object} Standardized error response object
 */
function getErrorResponse(title, message, options = {}) {
  const response = {
    success: false,
    error: {
      title: title || 'Error',
      message: message || 'An unexpected error occurred'
    }
  };

  // Add code if provided
  if (options.code) {
    response.error.code = options.code;
  }

  // Add any additional details
  if (options.details) {
    response.error.details = options.details;
  }
  
  // Add retryable flag if specified
  if (options.retryable !== undefined) {
    response.error.retryable = !!options.retryable;
  }

  return response;
}

/**
 * Standard error codes used throughout the application
 */
const ErrorCodes = {
  AUTHENTICATION: 'auth_error',
  AUTHORIZATION: 'permission_denied',
  VALIDATION: 'validation_error',
  NOT_FOUND: 'not_found',
  SERVER_ERROR: 'server_error',
  RATE_LIMIT: 'rate_limit_exceeded',
  BAD_REQUEST: 'bad_request'
};

/**
 * Creates a standardized API error with status code and message
 * @param {string} message - Error message
 * @param {string} code - Error code from ErrorCodes
 * @param {number} statusCode - HTTP status code
 * @returns {Error} Error object with additional properties
 */
function createApiError(message, code = ErrorCodes.SERVER_ERROR, statusCode = 500) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  getErrorResponse,
  ErrorCodes,
  createApiError
};