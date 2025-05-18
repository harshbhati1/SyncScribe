/**
 * TwinMind - Main Server File
 * Node.js/Express.js backend for the TwinMind meeting transcription application
 */

// Import required packages
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Simple health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'TwinMind API server is running'
  });
});

// Test route to verify Firebase and Gemini configurations
app.get('/api/test-config', async (req, res) => {
  try {
    // Import Firebase config
    const { initializeFirebase } = require('./src/config/firebase.config');
      // Import Gemini config
    const { initializeGemini } = require('./src/config/gemini.config');
      // Initialize Firebase
    const admin = initializeFirebase();
    
    let geminiResponse = "Gemini API test skipped to avoid rate limiting";
      // Skip actual Gemini testing to avoid rate limits during setup
    geminiResponse = "Gemini API configuration loaded but test skipped to avoid rate limits. You can implement actual Gemini API calls in your application logic.";
    
    // Initialize Gemini without making an API call
    const { geminiFlash } = initializeGemini();
    
    /* For actual testing, uncomment this:
    try {
      // Initialize Gemini - only using Flash model as per project requirements
      const { geminiFlash } = initializeGemini();
      
      // Test Gemini Flash model with a very simple prompt to minimize token usage
      const result = await geminiFlash.generateContent('Hello');
      geminiResponse = result.response.text();
    } catch (geminiError) {
      console.log('Gemini API test warning:', geminiError.message);
      if (geminiError.message.includes('429') || geminiError.message.includes('quota')) {
        geminiResponse = "Gemini API rate limit reached. This is normal with free tier. The API key is valid, but you're limited to a certain number of requests.";
      } else {
        throw geminiError; // Re-throw if it's not a rate limit error
      }
    }
    */
      res.status(200).json({
      status: 'success',
      message: 'Configurations loaded successfully',
      firebase: 'Firebase Admin SDK initialized successfully',
      gemini: geminiResponse
    });
  } catch (error) {
    console.error('Configuration test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Configuration test failed',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`TwinMind server listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; // For testing purposes
