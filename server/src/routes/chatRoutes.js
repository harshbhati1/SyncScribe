// backend/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware'); // Adjust path as needed
const { initializeGemini } = require('../config/gemini.config'); // Adjust path as needed

// Helper function to transform client chat history to Gemini format
const transformHistoryToGeminiFormat = (clientHistory) => {
  if (!clientHistory || !Array.isArray(clientHistory)) {
    return [];
  }
  return clientHistory.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model', // Assuming 'ai' sender maps to 'model'
    parts: [{ text: msg.text || "" }]
  }));
};

router.post('/', authMiddleware, async (req, res) => {
  const { fullTranscript, clientSideChatHistory, newUserQuery } = req.body;
  const userId = req.user.uid; // From authMiddleware

  if (!newUserQuery || typeof newUserQuery !== 'string') {
    return res.status(400).json({ error: 'newUserQuery is required and must be a string.' });
  }
  if (typeof fullTranscript !== 'string') {
    // Allow empty transcript, but it must be a string
    return res.status(400).json({ error: 'fullTranscript must be a string.' });
  }

  let geminiPro; // Or geminiFlash, depending on your config and preference for chat
  try {
    const geminiConfig = initializeGemini();
    geminiPro = geminiConfig.geminiPro; // Assuming you have a geminiPro model configured
    if (!geminiPro) {
        console.error(`[POST /api/chat] Gemini Pro model not available. Falling back to Flash if configured, or erroring.`);
        geminiPro = geminiConfig.geminiFlash; // Fallback or specific chat model
    }
    if (!geminiPro) {
        throw new Error('Appropriate Gemini model for chat is not configured or available.');
    }
  } catch (initError) {
    console.error('[POST /api/chat] CRITICAL: Failed to initialize Gemini:', initError);
    return res.status(500).json({ error: 'Failed to initialize AI service.' });
  }

  try {
    console.log(`[POST /api/chat] User: ${userId}, Query: "${newUserQuery.substring(0, 50)}..."`);

    // 1. Construct initial prompts for Gemini
    const systemInstruction = `You are a helpful and concise meeting assistant. The user is providing you with a meeting transcript and will ask questions about it.
    Strictly base your answers on the provided transcript. If the answer cannot be found in the transcript, clearly state that.
    Do not make up information or answer questions outside the scope of this meeting transcript.

    MEETING TRANSCRIPT:
    ---
    ${fullTranscript || "(No transcript provided for this session yet)"}
    ---
    `;

    const initialPrompts = [
      { role: "user", parts: [{ text: systemInstruction }] },
      { role: "model", parts: [{ text: "Okay, I have the meeting transcript context. How can I assist you with it?" }] }
    ];

    // 2. Transform client-side chat history and combine
    const transformedHistory = transformHistoryToGeminiFormat(clientSideChatHistory);
    const fullGeminiHistory = [...initialPrompts, ...transformedHistory];

    // 3. Start chat session
    const chat = geminiPro.startChat({
      history: fullGeminiHistory,
      // generationConfig: { /* Optional: Add temperature, topK, etc. */ }
    });

    // 4. Send user's new query and stream the response
    const result = await chat.sendMessageStream(newUserQuery);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush the headers to establish the connection

    let accumulatedText = ""; // For logging purposes on the backend
    for await (const chunk of result.stream) {
      const textPart = chunk.text();
      if (textPart) {
        accumulatedText += textPart;
        res.write(`data: ${JSON.stringify({ textChunk: textPart })}\n\n`);
      }
    }
    console.log(`[POST /api/chat] Gemini Response (last 50 chars): "...${accumulatedText.slice(-50)}"`);

    res.write(`data: ${JSON.stringify({ endOfStream: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error('[POST /api/chat] Error during chat processing:', error);
    // If headers already sent, we can't send a JSON error.
    // The client-side will need to handle abrupt stream termination.
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process chat message.', details: error.message });
    } else {
      // Try to send an error event in the stream if possible, though might not be processed by client
      res.write(`data: ${JSON.stringify({ error: 'Stream failed', details: error.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;