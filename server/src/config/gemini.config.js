/**
 * Google Gemini API Configuration
 * This file initializes the Gemini model with API key from environment variables
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Gemini API
const initializeGemini = () => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      // Initialize only the Flash model as per project requirements (Gemini 2.0 Flash)
    const geminiFlash = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',  // Use the exact model name without 'latest'
      generationConfig: {
        maxOutputTokens: 100,  // Further reduce output to minimize token usage
        temperature: 0.7
      }
    });
    
    console.log('Gemini API initialized successfully');
    
    return {
      genAI,
      geminiFlash
    };
  } catch (error) {
    console.error('Error initializing Gemini API:', error);
    throw error;
  }
};

module.exports = {
  initializeGemini
};
