/**
 * Auth Routes
 * Routes for user authentication and user profile
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const { getErrorResponse } = require('../utils/error.utils');
const { admin } = require('../config/firebase.config');

// Verify user's authentication token
router.get('/verify', authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Token verified successfully',
    user: {
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name || null,
      picture: req.user.picture || null
    }
  });
});

// Get user's profile information
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    // The user object is already attached to the request by the auth middleware
    const { uid, email, name, picture } = req.user;
    
    // You could fetch additional user data from your database here
    
    return res.status(200).json({
      success: true,
      user: {
        uid,
        email,
        name: name || null,
        picture: picture || null,
        // Add any other user info you want to return
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json(
      getErrorResponse('Server Error', 'Error fetching user profile')
    );
  }
});

module.exports = router;