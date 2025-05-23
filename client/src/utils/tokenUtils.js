/**
 * Token Utilities
 * Helper functions for working with JWT tokens
 */

/**
 * Decode a JWT token and extract its payload
 * @param {string} token - The JWT token to decode
 * @returns {Object|null} The decoded payload or null if invalid
 */
export const decodeToken = (token) => {
  if (!token) return null;
  
  try {
    // Split the token and get the payload (middle part)
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Base64Url decode the payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Decode the base64 string
    const rawPayload = atob(base64);
    
    // Convert to a proper string
    const decodedString = decodeURIComponent(
      [...rawPayload].map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    
    // Parse the JSON payload
    return JSON.parse(decodedString);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Get the expiration time of a JWT token
 * @param {string} token - The JWT token to check
 * @returns {Object} Object containing expiration details
 */
export const getTokenExpiration = (token) => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return null;
  
  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const timeUntilExpiration = expirationTime - now;
  
  return {
    expirationTime,
    expirationDate: new Date(expirationTime),
    expired: timeUntilExpiration <= 0,
    timeUntilExpiration,
    minutesUntilExpiration: Math.round(timeUntilExpiration / 60000),
    payload
  };
};

/**
 * Check if a token is about to expire soon
 * @param {string} token - The JWT token to check
 * @param {number} thresholdMinutes - Minutes threshold to consider as "expiring soon"
 * @returns {boolean} True if token is expiring within the threshold
 */
export const isTokenExpiringSoon = (token, thresholdMinutes = 10) => {
  const expInfo = getTokenExpiration(token);
  if (!expInfo) return true; // If we can't verify, assume it's expiring
  
  return expInfo.minutesUntilExpiration <= thresholdMinutes;
};

/**
 * Log token information for debugging purposes
 * @param {string} token - The JWT token to check
 */
export const logTokenInfo = (token) => {
  if (!token) {
    console.log('No token provided');
    return;
  }
  
  const expInfo = getTokenExpiration(token);
  if (!expInfo) {
    console.log('Invalid token or no expiration data');
    return;
  }
  
  console.log('Token information:');
  console.log('- Expires at:', expInfo.expirationDate.toLocaleString());
  console.log('- Minutes until expiration:', expInfo.minutesUntilExpiration);
  console.log('- Token status:', expInfo.expired ? 'EXPIRED' : 
    (expInfo.minutesUntilExpiration < 10 ? 'EXPIRING SOON' : 'VALID'));
  
  // Log issuer and subject if available
  if (expInfo.payload.iss) {
    console.log('- Issuer:', expInfo.payload.iss);
  }
  if (expInfo.payload.sub) {
    console.log('- Subject:', expInfo.payload.sub);
  }
  
  // Log when the token was issued
  if (expInfo.payload.iat) {
    const issuedAt = new Date(expInfo.payload.iat * 1000);
    console.log('- Issued at:', issuedAt.toLocaleString());
    const tokenAgeMinutes = Math.round((Date.now() - issuedAt.getTime()) / 60000);
    console.log('- Token age:', tokenAgeMinutes, 'minutes');
  }
};
