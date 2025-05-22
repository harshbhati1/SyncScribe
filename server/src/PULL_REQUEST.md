# Pull Request: Fix Chat Functionality in TwinMind Application

## Issue
The TwinMind application is experiencing a 500 Internal Server Error when attempting to chat about transcripts. 
Additionally, there's a mismatch between the configured model ('gemini-2.0-flash') and the model being used ('gemini-1.5-pro').

## Changes

### 1. Fix model reference in gemini.config.js
- Ensure we consistently use 'gemini-2.0-flash' for chat functionality
- Add a more descriptively named property 'geminiChat' alongside 'geminiPro' for clarity
- Update log messages to correctly reflect the model being used

```javascript
// Initialize a model for chat support (always using gemini-2.0-flash)
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
```

### 2. Update chatRoutes.js to use the properly named property
- Add model verification to ensure we're using the correct model
- Create a utility in utils/modelVerifier.js for checking the model
- Explicitly log which model is being used for each chat request

```javascript
// In chatRoutes.js
const { verifyModel } = require('../utils/modelVerifier'); 

// When initializing the model
if (geminiConfig.geminiChat) {
  // Use the newly named property for clarity
  console.log('[POST /api/chat] Using Gemini 2.0 Flash model for chat.');
  geminiModel = geminiConfig.geminiChat;
} else if (geminiConfig.geminiPro) {
  // Fall back to the old property name if needed for backward compatibility
  console.log('[POST /api/chat] Using Gemini 2.0 Flash model for chat via legacy property.');
  geminiModel = geminiConfig.geminiPro;
} else {
  throw new Error('Gemini model not available for chat.');
}

// Before sending message to Gemini
const modelName = verifyModel(geminiModel);
console.log(`[POST /api/chat] Verified model for this request: ${modelName}`);
```

### 3. Improve error handling for rate limits
- Enhance error handling to better detect rate limit errors
- Extract retry information from error responses
- Send more helpful error messages to the client

```javascript
// In chatRoutes.js error handler
// Determine if it's a rate limit error and extract retry information
const isRateLimit = error.status === 429;
const retryDelay = error.errorDetails && 
  error.errorDetails.find(detail => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')?.retryDelay || '30s';

// Provide better error messages for common cases
if (isRateLimit) {
  userMessage = `Rate limit exceeded. Please try again in ${retryDelay} seconds.`;
  errorCode = 'RATE_LIMIT_EXCEEDED';
}

// Include this information in the response
res.write(`data: ${JSON.stringify({ 
  error: isRateLimit ? 'Rate limit exceeded' : 'Error in chat processing',
  errorMessage: userMessage,
  errorCode: errorCode,
  isRateLimit: isRateLimit,
  retryDelay: retryDelay,
  endOfStream: true 
})}\n\n`);
```

### 4. Update system instruction prompt
- Improve the system instruction to better handle short transcripts
- Be more clear about expected behavior when transcript information is limited

```javascript
const systemInstruction = `You are a helpful and knowledgeable AI assistant for the TwinMind application. Your task is to analyze and provide insights on meeting transcripts.

The transcript might be short or incomplete as it's being generated in real-time. Work with what's available.

Your priorities should be:
1. Answer questions about what's explicitly mentioned in the transcript
2. Provide concise, helpful responses
3. If the transcript is too short or missing information, politely explain that the information isn't available yet
4. Be conversational and helpful in all responses

MEETING TRANSCRIPT:
---
${transcript}
---
`;
```

### 5. Enhance client-side error handling
- Update client to better handle specific error codes
- Improve user-friendly error messages for rate limits
- Add additional timeout protection for long-running requests

## Testing
1. Verify that chat functionality uses the correct model
2. Test with short and long transcripts
3. Test error handling with simulated rate limit errors
