/**
 * Authentication Middleware
 * Verifies Firebase ID tokens in the Authorization header
 */

const { admin } = require('../config/firebase.config');
const { getErrorResponse } = require('../utils/error.utils');

// Check if Firebase Admin was initialized
let firebaseInitialized = admin.apps.length > 0;

/**
 * Authentication middleware
 * Verifies the ID token in the Authorization header
 */
const authMiddleware = async (req, res, next) => {
  // Check if Firebase was initialized successfully
  if (!firebaseInitialized) {
    return res.status(500).json(
      getErrorResponse('Server configuration error', 'Firebase initialization failed')
    );
  }
  
  // Get the ID token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(
      getErrorResponse('Unauthorized', 'No authentication token provided')
    );
  }

  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Add the decoded token to the request object
    next();
  } catch (error) {
    console.error('Error verifying authentication token:', error);
    
    // Handle different types of authentication errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json(
        getErrorResponse('Unauthorized', 'Authentication token expired')
      );
    } else if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json(
        getErrorResponse('Unauthorized', 'Authentication token revoked')
      );
    } else {
      return res.status(401).json(
        getErrorResponse('Unauthorized', 'Invalid authentication token')
      );
    }
  }
};

module.exports = authMiddleware;