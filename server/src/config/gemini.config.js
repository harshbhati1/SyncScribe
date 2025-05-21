/**
 * Google Gemini API Configuration
 * This file initializes the Gemini model with API key from environment variables.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

// --- DEBUGGING ---
// Set to true to force re-initialization on every call to initializeGemini()
// Set to false to use the cached instance (normal behavior)
const FORCE_REINIT_GEMINI_FOR_DEBUG = false; 
// --- END DEBUGGING ---

let geminiInstance = null; // Stores the cached initialized instance

const initializeGemini = () => {
  if (!FORCE_REINIT_GEMINI_FOR_DEBUG && geminiInstance) {
    return geminiInstance;
  }

  console.log(`[GeminiConfig] ${FORCE_REINIT_GEMINI_FOR_DEBUG ? 'Forcing re-initialization' : 'Attempting initialization (or first time)'}.`);
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[GeminiConfig] Warning: GEMINI_API_KEY is not set. Switching to simulation mode.');
      const simInstance = { genAI: null, geminiFlash: null, isSimulationMode: true };
      if (FORCE_REINIT_GEMINI_FOR_DEBUG) return simInstance;
      geminiInstance = simInstance;
      return geminiInstance;
    } else {
      // Verify API key format (don't log actual key)
      const isValidKeyFormat = apiKey.length > 20; // Simple length check
      console.log('[GeminiConfig] GEMINI_API_KEY found. Valid format: ', isValidKeyFormat);
      if (isValidKeyFormat) {
        console.log('[GeminiConfig] Key pattern:', 
                   apiKey.substring(0, 4) + '...' + 
                   apiKey.substring(apiKey.length - 4));
      } else {
        console.warn('[GeminiConfig] Warning: API key format looks suspicious (too short)');
      }
    }
    
    console.log('[GeminiConfig] NODE_ENV:', process.env.NODE_ENV);
    console.log('[GeminiConfig] USE_REAL_GEMINI:', process.env.USE_REAL_GEMINI);    // Initialize the Google Generative AI with the API key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Determine which model to use - prefer gemini-1.5-flash for audio transcription
    // as it might be more stable than the latest versions
    const modelName = process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash'; 
    console.log(`[GeminiConfig] Attempting to initialize Gemini model: ${modelName}`);
    
    // Create just one model instance that will be reused
    // Use minimal configuration to avoid sending unnecessary parameters
    const geminiFlashModel = genAI.getGenerativeModel({ 
      model: modelName,
      // Use the most minimal config possible for audio transcription
      generationConfig: { 
        temperature: 0.1
      }
    });
    
    // Validate model availability (without using await since we're in a sync function)
    console.log(`[GeminiConfig] Gemini model instance created. (No validation performed in sync function)`);
    
    // We'll do a simple ping test in the transcription routes before first use    // --- END MODIFICATION ---    // Initialize a model for chat support (always using gemini-2.0-flash)
    const geminiChatModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash', // Always use flash model for chat capabilities
      generationConfig: {
        temperature: 0.7, // Higher temperature for more creative chat responses
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });
    
    console.log(`[GeminiConfig] ✅ Gemini client and models ('${modelName}' for ASR, 'gemini-2.0-flash' for chat) initialized successfully. Real API mode enabled.`);
    const newInstance = {
      genAI,
      geminiFlash: geminiFlashModel,
      geminiPro: geminiChatModel, // Keep backward compatible name but use the flash model
      geminiChat: geminiChatModel, // Adding a more clearly named property for new code to use
      isSimulationMode: false
    };
    if (FORCE_REINIT_GEMINI_FOR_DEBUG) return newInstance;
    geminiInstance = newInstance;
    return geminiInstance;

  } catch (error) {
    console.error('[GeminiConfig] ❌ Error initializing Gemini API client or getting model:', error.message);
    if (process.env.NODE_ENV === 'development') {
        console.error('[GeminiConfig] Full initialization error:', error);
    }
    console.warn('[GeminiConfig] Gemini API initialization failed. Falling back to simulation mode.');
      const errorInstance = {
      genAI: null,
      geminiFlash: null,
      geminiPro: null,
      isSimulationMode: true
    };
    if (FORCE_REINIT_GEMINI_FOR_DEBUG) return errorInstance;
    geminiInstance = errorInstance;
    return geminiInstance;
  }
};

module.exports = {
  initializeGemini
};
