/**
 * Utility for verifying and validating Gemini model instances
 */

/**
 * Verifies the model instance to ensure it's the expected type
 * @param {Object} model - The Gemini model instance to verify
 * @returns {Object} Information about the model verification
 */
function verifyModel(model) {
  if (!model) {
    return { isCorrect: false, name: 'undefined', isValid: false };
  }

  try {
    // Extract model name (implementation may vary based on how Google provides this info)
    let modelName = 'unknown';
    
    // Try to get model name from various possible properties
    if (model._settings && model._settings.model) {
      modelName = model._settings.model;
    } else if (model.modelName) {
      modelName = model.modelName;
    } else if (model.name) {
      modelName = model.name;
    } else if (model.toString) {
      const stringRep = model.toString();
      // Try to extract model name from string representation
      const match = stringRep.match(/model:\s*([a-zA-Z0-9.-]+)/);
      if (match && match[1]) {
        modelName = match[1];
      }
    }

    // Check if model has expected methods
    const hasGenerateContent = typeof model.generateContent === 'function';
    const hasStartChat = typeof model.startChat === 'function';
    
    // Is it a valid model?
    const isValid = hasGenerateContent || hasStartChat;
    
    // Check if it's our preferred chat model (gemini-2.0-flash)
    const isCorrect = modelName.includes('gemini-2.0-flash') || 
                     modelName.includes('gemini-pro');
    
    return {
      isCorrect,
      isValid,
      name: modelName,
      capabilities: {
        chat: hasStartChat,
        content: hasGenerateContent
      }
    };
  } catch (err) {
    console.error('Error verifying model:', err);
    return { 
      isCorrect: false, 
      isValid: false, 
      name: 'error-checking', 
      error: err.message 
    };
  }
}

/**
 * Checks if an error is a rate limit error from the Gemini API
 * @param {Error} error - The error to check
 * @returns {boolean} Whether this is a rate limit error
 */
function isRateLimitError(error) {
  if (!error) return false;
  
  // Check error properties
  if (error.code === 429 || error.status === 429) {
    return true;
  }
  
  // Check error message
  if (error.message && typeof error.message === 'string') {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') || 
           message.includes('quota exceeded') ||
           message.includes('too many requests') ||
           message.includes('try again later');
  }
  
  // Check nested error objects
  if (error.error && typeof error.error === 'object') {
    return isRateLimitError(error.error);
  }
  
  return false;
}

module.exports = {
  verifyModel,
  isRateLimitError
};
