/**
 * Simple Auth Middleware (Development Only)
 * A simplified version of auth middleware for development/testing
 */

const { admin } = require('../config/firebase.config');
const { getErrorResponse } = require('../utils/error.utils');

/**
 * Simple authentication middleware with more graceful error handling for development
 * This middleware is more forgiving than the strict production middleware
 */
const simpleAuthMiddleware = async (req, res, next) => {
  // Get the ID token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('No authentication token provided or invalid format');
    return res.status(401).json(
      getErrorResponse('Unauthorized', 'No authentication token provided')
    );
  }

  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Add the decoded token to the request object
    console.log(`Authenticated user: ${req.user.email} (${req.user.uid})`);
    next();
  } catch (error) {
    console.error('Auth error (Dev middleware):', error.message);
    
    // For development, continue despite auth errors (helps with debugging)
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      console.warn('⚠️ Auth bypass enabled - proceeding despite auth failure');
      req.user = { 
        uid: 'dev-uid',
        email: 'dev@example.com',
        name: 'Development User',
        dev_mode: true
      };
      return next();
    }
    
    // Otherwise, return appropriate error
    return res.status(401).json(
      getErrorResponse('Unauthorized', 'Invalid authentication token')
    );
  }
};

module.exports = simpleAuthMiddleware;
