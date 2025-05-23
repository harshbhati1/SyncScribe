/**
 * Calendar Routes
 * Routes for Google Calendar integration
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

// Initialize OAuth2 client
const createOAuth2Client = () => {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

/**
 * GET /api/calendar/auth-url
 * Returns the Google OAuth URL for calendar authorization
 */
router.get('/auth-url', authMiddleware, async (req, res) => {
  try {
    const userId = req.user ? req.user.uid : null;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Log OAuth configuration for debugging
    console.log('[GET /api/calendar/auth-url] OAuth2 config:', {
      clientIdExists: !!process.env.GOOGLE_CLIENT_ID,
      clientIdLength: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.length : 0,
      secretExists: !!process.env.GOOGLE_CLIENT_SECRET,
      redirectUriExists: !!process.env.GOOGLE_REDIRECT_URI,
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    });

    const oauth2Client = createOAuth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId // Pass userId as state to retrieve it after auth
    });

    console.log(`[GET /api/calendar/auth-url] Generated auth URL: ${authUrl.substring(0, 100)}...`);
    return res.status(200).json({ success: true, authUrl });
  } catch (error) {
    console.error('[GET /api/calendar/auth-url] Error generating auth URL:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate authorization URL',
      details: error.message
    });
  }
});

/**
 * POST /api/calendar/exchange-code
 * Exchanges authorization code for tokens
 */
router.post('/exchange-code', authMiddleware, async (req, res) => {
  const { code } = req.body;
  const userId = req.user ? req.user.uid : null;

  if (!code) {
    return res.status(400).json({ success: false, error: 'Authorization code is required' });
  }

  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' });
  }

  try {
    console.log(`[POST /api/calendar/exchange-code] Exchanging code for user: ${userId}, code length: ${code.length}`);
    
    // Log OAuth configuration for debugging
    console.log('[POST /api/calendar/exchange-code] OAuth2 config:', {
      clientIdExists: !!process.env.GOOGLE_CLIENT_ID,
      secretExists: !!process.env.GOOGLE_CLIENT_SECRET,
      redirectUriExists: !!process.env.GOOGLE_REDIRECT_URI,
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    });
    
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('[POST /api/calendar/exchange-code] Token exchange successful:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date
    });
    
    // Store tokens with user in Firebase (this is just a placeholder)
    // In a real implementation, you'd store these securely associated with the user
    // For this demo, we'll return them to be stored in localStorage (not ideal for security)
    
    return res.status(200).json({ 
      success: true, 
      tokens,
      message: 'Calendar connected successfully' 
    });
  } catch (error) {
    console.error('[POST /api/calendar/exchange-code] Error exchanging code:', error);
    console.error('[POST /api/calendar/exchange-code] Error details:', error.message);
    if (error.response) {
      console.error('[POST /api/calendar/exchange-code] Error response:', error.response.data);
    }
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to connect to Google Calendar',
      details: error.message 
    });
  }
});

/**
 * GET /api/calendar/events
 * Gets calendar events for today
 */
router.get('/events', authMiddleware, async (req, res) => {
  const { accessToken, date } = req.query;
  const userId = req.user ? req.user.uid : null;

  if (!accessToken) {
    return res.status(400).json({ 
      success: false, 
      error: 'Access token is required',
      requiresAuth: true
    });
  }

  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      error: 'User not authenticated',
      requiresAuth: true
    });
  }

  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Default to today if no date provided
    const targetDate = date ? new Date(date) : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items.map(event => ({
      id: event.id,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      location: event.location || '',
      attendees: event.attendees || []
    }));

    console.log(`[GET /api/calendar/events] Processed ${events.length} events`);

    return res.status(200).json({ 
      success: true, 
      events
    });
  } catch (error) {
    console.error('[GET /api/calendar/events] Error fetching events:', error);
    
    // Check if token expired or invalid credentials
    if (error.message && (
        error.message.includes('Invalid Credentials') || 
        error.message.includes('invalid_token') ||
        error.code === 401 ||
        (error.response && error.response.status === 401))) {
      
      console.warn('[GET /api/calendar/events] Calendar credentials are invalid or expired');
      
      return res.status(401).json({ 
        success: false, 
        error: 'Calendar authentication expired',
        requiresAuth: true,
        isCalendarError: true, // Add flag to identify this as a calendar-specific error
        errorType: 'calendar_auth'
      });
    }
    
    // Return a detailed error for other cases
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch calendar events',
      details: error.message,
      isCalendarError: true
    });
  }
});

module.exports = router;
