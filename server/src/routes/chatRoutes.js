// backend/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware'); // Adjust path as needed
const { initializeGemini } = require('../config/gemini.config'); // Adjust path as needed

// Helper function to transform client chat history to Gemini format
const transformHistoryToGeminiFormat = (clientHistory) => {
    if (!clientHistory || !Array.isArray(clientHistory)) {
        console.log("[Chat] No client history or invalid format provided.");
        return [];
    }

    // Filter out any invalid messages and transform
    return clientHistory
        .filter(msg =>
            msg && typeof msg === 'object' &&
            (msg.sender === 'user' || msg.sender === 'ai') && // Assuming 'ai' from client maps to 'model'
            msg.text && typeof msg.text === 'string'
        )
        .map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));
};

router.post('/', authMiddleware, async (req, res) => {
    const { fullTranscript, clientSideChatHistory, newUserQuery } = req.body;
    const userId = req.user.uid;

    if (!newUserQuery || typeof newUserQuery.trim() === '') {
        return res.status(400).json({ error: 'A non-empty query is required.' });
    }

    const transcript = fullTranscript || ""; // Allow empty or undefined transcript

    console.log(`[POST /api/chat] User: ${userId}, Query: "${newUserQuery.substring(0, 50)}..."`);
    console.log(`[POST /api/chat] Transcript Length: ${transcript.length}, History Entries: ${clientSideChatHistory?.length || 0}`);

    let geminiChatModel;    try {
        const geminiConfig = initializeGemini();
        // Always prefer geminiChat which is specifically set to gemini-2.0-flash in the config
        geminiChatModel = geminiConfig.geminiChat || geminiConfig.geminiPro;
        
        // Import error utilities
        const { createApiError, ErrorCodes } = require('../utils/error.utils');
        
        // Verify we have the correct model
        if (!geminiChatModel) {
            console.error('[POST /api/chat] Gemini chat model is not initialized.');
            throw new Error('AI service model is not available.');
        }
        
        // Check if the model supports startChat
        if (typeof geminiChatModel.startChat !== 'function') {
            console.error('[POST /api/chat] Gemini chat model lacks startChat method.');
            throw new Error('AI service model is misconfigured.');
        }
        
        console.log('[POST /api/chat] Gemini chat model loaded successfully.');
    } catch (initError) {
        console.error('[POST /api/chat] CRITICAL: Failed to initialize Gemini:', initError.message);
        const { createApiError, ErrorCodes } = require('../utils/error.utils');
        return res.status(500).json(createApiError(
            'Failed to initialize AI service.', 
            ErrorCodes.MODEL_ERROR, 
            { details: initError.message }
        ));
    }try {
        const systemInstruction = `You are a helpful AI assistant for the TwinMind application.
Analyze the provided meeting transcript to answer questions.
If the transcript is short or information is missing, state that.
Be conversational and stick to the transcript content.
DO NOT use markdown formatting like asterisks (*) or formatting symbols in your response.
Use plain text only without any special formatting.

MEETING TRANSCRIPT:
---
${transcript}
---
`;

        const initialPrompts = [
            { role: "user", parts: [{ text: systemInstruction }] },
            { role: "model", parts: [{ text: "Okay, I have the meeting transcript. How can I help you with it?" }] }
        ];

        const transformedHistory = transformHistoryToGeminiFormat(clientSideChatHistory);
        const fullGeminiHistory = [...initialPrompts, ...transformedHistory];

        const chat = geminiChatModel.startChat({
            history: fullGeminiHistory,
            generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                maxOutputTokens: 1024
            }
        });

        console.log('[POST /api/chat] Sending query to Gemini and starting stream...');
        const result = await chat.sendMessageStream(newUserQuery);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Establish SSE connection

        let accumulatedText = "";
        for await (const chunk of result.stream) {
            const textPart = chunk.text();
            if (textPart) {
                accumulatedText += textPart;
                res.write(`data: ${JSON.stringify({ textChunk: textPart })}\n\n`);
            }
        }
        console.log(`[POST /api/chat] Stream finished. Total response length: ${accumulatedText.length}`);
          // Send end of stream marker with all necessary flags
        res.write(`data: ${JSON.stringify({ 
          done: true, 
          endOfStream: true,
          completed: true 
        })}\n\n`);
        res.end();    } catch (error) {
        console.error('[POST /api/chat] Error during chat processing:', error.message);
        // Add more detailed error logging if in development
        if (process.env.NODE_ENV === 'development') {
            console.error('[POST /api/chat] Full error object:', error);
        }
        
        // Import error utilities if not already imported
        const { formatUserFriendlyError, ErrorCodes, isRateLimitError } = require('../utils/error.utils');
        
        if (res.headersSent) {
            try {
                // Create appropriate error code
                let errorCode = ErrorCodes.UNKNOWN;
                
                // Check for specific error types
                if (isRateLimitError(error)) {
                    errorCode = ErrorCodes.RATE_LIMITED;
                } else if (error.message && error.message.includes('API key not valid')) {
                    errorCode = ErrorCodes.AUTH_ERROR;
                } else if (error.status === 500 || error.code === 'SERVER_ERROR' || 
                          error.message && error.message.includes('server')) {
                    errorCode = ErrorCodes.SERVER_ERROR;
                } else if (error.message && (
                    error.message.includes('model') || 
                    error.message.includes('gemini')
                )) {
                    errorCode = ErrorCodes.MODEL_ERROR;
                }
                
                // Get user-friendly message
                const userFriendlyMessage = formatUserFriendlyError({
                    ...error,
                    code: errorCode
                });

                res.write(`data: ${JSON.stringify({
                    error: true,
                    errorMessage: userFriendlyMessage,
                    errorCode: errorCode,
                    friendlyMessage: userFriendlyMessage,
                    endOfStream: true
                })}\n\n`);
            } catch (writeError) {
                console.error('[POST /api/chat] Fatal: Could not write error to an already open stream:', writeError.message);
            } finally {
                res.end();
            }
        } else {            // If headers haven't been sent, send a standard JSON error response
            let statusCode = 500;
            let errorMessage = 'Failed to process chat message.';
            
            // Determine appropriate status code
            if (isRateLimitError(error)) {
                statusCode = 429; // Too Many Requests
                errorMessage = 'Rate limit reached. Please try again in 30-60 seconds.';
            }
            
            const userFriendlyMessage = formatUserFriendlyError(error);
            
            res.status(statusCode).json({
                error: errorMessage,
                details: error.message || 'Unknown error',
                code: error.code || ErrorCodes.UNKNOWN,
                friendlyMessage: userFriendlyMessage
            });
        }
    }
});

module.exports = router;