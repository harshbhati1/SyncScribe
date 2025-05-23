/**
 * Authentication Middleware
 * Verifies Firebase ID tokens in the Authorization header
 */

const { admin } = require('../config/firebase.config'); // Assuming admin is correctly exported after initialization
const { getErrorResponse } = require('../utils/error.utils'); // Your error response utility

// Verify the error utility is properly imported
console.log('[Auth Middleware] Error utility imported:', typeof getErrorResponse === 'function' ? 'Success' : 'Failed');

// Check if Firebase Admin was initialized
// Note: It's often better to ensure 'admin' itself is only available/exported
// after successful initialization in firebase.config.js, but this check is a safeguard.
let firebaseInitialized = false;
try {
    firebaseInitialized = admin.apps.length > 0;
} catch (e) {
    // This might happen if admin from firebase.config.js is null/undefined due to init failure there
    console.error("Auth Middleware: Firebase admin object not available or apps array inaccessible. Firebase might not have initialized.", e);
}


/**
 * Authentication middleware
 * Verifies the ID token in the Authorization header
 */
const authMiddleware = async (req, res, next) => {
  // Special handling for calendar routes with errors
  const isCalendarRoute = req.path.includes('/calendar/');
  
  // Check if Firebase was initialized successfully
  if (!firebaseInitialized) {
    // This check is good, but ensure firebase.config.js handles its own initialization errors robustly.
    console.error('Auth Middleware Error: Firebase Admin SDK does not appear to be initialized.');
    return res.status(503).json( // 503 Service Unavailable might be more fitting
      getErrorResponse('Server Configuration Error', 'Firebase initialization failed or admin SDK not available.', 
        { code: 'firebase-not-initialized', retryable: true })
    );
  }

  // Get the ID token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For calendar routes, handle auth errors more gracefully
    if (isCalendarRoute) {
      console.warn('[Auth Middleware] No auth token for calendar route:', req.path);
      return res.status(401).json({
        success: false,
        error: 'Calendar authentication required',
        requiresAuth: true,
        isCalendarError: true
      });
    }
    
    return res.status(401).json(
      getErrorResponse('Unauthorized', 'No authentication token provided or malformed header.', 
        { code: 'missing-auth-header', retryable: false })
    );
  }

  const idToken = authHeader.split('Bearer ')[1];

  if (!idToken || idToken === 'null' || idToken === 'undefined') {
    return res.status(401).json(
        getErrorResponse('Unauthorized', 'Blank authentication token provided.', 
          { code: 'empty-token', retryable: false })
    );
  }

  try {
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Add the decoded token to the request object
    console.log(`[Auth Middleware] Token verified for UID: ${decodedToken.uid}`);
    next();
  } catch (error) {
    console.error(`[Auth Middleware] Error verifying authentication token for token starting with "${idToken.substring(0,10)}...":`, error.code, error.message);    // Handle different types of authentication errors
    if (error.code === 'auth/id-token-expired') {
      // UPDATED BEHAVIOR:
      // In all environments (including development), an expired token is a 401 error.
      // This makes development behavior consistent with production and helps ensure
      // client-side token refresh logic is working correctly.
      console.warn('[Auth Middleware] ID token expired. Sending 401.');
      return res.status(401).json(
        getErrorResponse('Unauthorized', 'Authentication token expired. Please refresh your session.', { code: 'token-expired' })
      );
      
      /* --- PREVIOUS DEVELOPMENT-ONLY SIMULATION LOGIC (NOW COMMENTED OUT) ---
      if (process.env.NODE_ENV === 'development') {
        console.warn('AUTH WARNING (Legacy): Using simulated auth due to expired token in development mode');
        // Set a mock user for development purposes
        req.user = {
          uid: 'dev-user-' + Date.now(),
          email: 'dev@example.com',
          name: 'Development User (Simulated - Expired Token)',
          isSimulatedAuth: true
        };
        next();
        return;
      } else {
        // In production, return proper error
        return res.status(401).json(
          getErrorResponse('Unauthorized', 'Authentication token expired')
        );
      }
      */    } else if (error.code === 'auth/id-token-revoked') {
      console.warn('[Auth Middleware] ID token revoked. Sending 401.');
      return res.status(401).json(
        getErrorResponse('Unauthorized', 'Authentication token has been revoked.', { code: 'token-revoked', retryable: false })
      );
    } else if (error.code === 'auth/argument-error') {
        console.warn('[Auth Middleware] Invalid ID token (argument error - likely malformed or empty). Sending 401.');
        return res.status(401).json(
            getErrorResponse('Unauthorized', 'Invalid authentication token format.', { code: 'token-invalid', retryable: false })
        );
    }
    // Add more specific Firebase error codes if needed:
    // e.g., 'auth/user-disabled', 'auth/user-not-found' (though these are less common for verifyIdToken)
    else {
      console.warn('[Auth Middleware] Unknown or generic error verifying ID token. Sending 401. Error Code:', error.code);
      return res.status(401).json(
        getErrorResponse('Unauthorized', `Invalid authentication token. Error: ${error.message}`, 
          { code: 'token-verification-failed', originalError: error.code, retryable: false })
      );
    }
  }
};

module.exports = authMiddleware;