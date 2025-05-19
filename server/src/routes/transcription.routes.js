/**
 * Transcription Routes
 * Routes for audio transcription and processing
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs'); // Import File System module
const path = require('path'); // Import Path module
const authMiddleware = require('../middlewares/auth.middleware'); 
const { getErrorResponse } = require('../utils/error.utils'); 
const { initializeGemini } = require('../config/gemini.config');

// --- DEBUGGING FLAG ---
const SAVE_FAILING_AUDIO_FOR_DEBUG = true; 
const DEBUG_AUDIO_SAVE_PATH = path.join(__dirname, '..', 'debug_audio'); 
// --- END DEBUGGING FLAG ---

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for audio files
});

// Basic regex to check for valid Base64 characters (simple check)
const BASE64_REGEX = /^[A-Za-z0-9+/]+[=]{0,2}$/;

router.post('/process', authMiddleware, upload.single('audio_data'), async (req, res) => {
  const requestArrivalTimestamp = new Date().toISOString();
  console.log('\n--- [POST /process] NEW REQUEST ---');
  console.log(`[POST /process] Timestamp: ${requestArrivalTimestamp}`);
  console.log('[POST /process] User UID:', req.user ? req.user.uid : 'N/A (Auth Middleware Issue?)');
  
  let geminiFlash, isGeminiSimulationMode;
  try {
    // Get Gemini configuration. initializeGemini() is synchronous and caches.
    const geminiConfig = initializeGemini(); 
    geminiFlash = geminiConfig.geminiFlash;
    isGeminiSimulationMode = geminiConfig.isSimulationMode;
    console.log(`[POST /process] Gemini config loaded. Simulation Mode: ${isGeminiSimulationMode}, geminiFlash available: ${!!geminiFlash}`);
  } catch (initError) {
    console.error('[POST /process] CRITICAL: Failed to get Gemini config during request:', initError.message);
    isGeminiSimulationMode = true; // Fallback if config loading fails
    geminiFlash = null;
  }

  // Determine if simulation should be used for this specific request
  const isDevelopmentEnv = process.env.NODE_ENV === 'development';
  const forceRealGeminiInDev = process.env.USE_REAL_GEMINI === 'true';
  // Use simulation if:
  // 1. gemini.config.js reported simulation mode (e.g., API key missing/init error)
  // 2. OR in development AND USE_REAL_GEMINI is not 'true'
  // 3. OR geminiFlash object is not available for some reason
  const useSimulationThisRequest = isGeminiSimulationMode || (isDevelopmentEnv && !forceRealGeminiInDev) || !geminiFlash;
  
  let audioFileBuffer; // To store the raw audio buffer for saving on error

  try {
    const audioFile = req.file; // File uploaded via multer
    // Other fields from FormData (like is_final, timestamp) will be in req.body
    const { audioChunk, is_final, timestamp, recording_time } = req.body; 

    console.log('[POST /process] req.file present:', !!audioFile);
    if (audioFile) {
      console.log('[POST /process] req.file.mimetype (from multer):', audioFile.mimetype);
      console.log('[POST /process] req.file.originalname:', audioFile.originalname);
      console.log('[POST /process] req.file.size:', audioFile.size);
      audioFileBuffer = audioFile.buffer; // Store buffer for potential saving if an error occurs
    }
    console.log('[POST /process] req.body fields:', { audioChunkProvided: !!audioChunk, is_final, timestamp, recording_time });

    // Check if any audio data was actually provided
    if (!audioFile && !audioChunk) {
      console.warn('[POST /process] No audio data provided in file or chunk.');
      return res.status(400).json(getErrorResponse ? 
        getErrorResponse('Bad Request', 'No audio data (file or chunk) provided.') :
        { success: false, error: { title: 'Bad Request', detail: 'No audio data (file or chunk) provided.' }}
      );
    }

    let audioDataB64; // Base64 encoded audio data string
    let inputMimeTypeForGemini; // MIME type to be sent to Gemini

    if (audioFile) {
      audioDataB64 = audioFile.buffer.toString('base64');
      // If browser sends generic 'audio/webm', specify Opus codec for Gemini, as it's common for MediaRecorder
      if (audioFile.mimetype && audioFile.mimetype.startsWith('audio/webm') && !audioFile.mimetype.includes('codecs=')) {
        inputMimeTypeForGemini = 'audio/webm;codecs=opus'; 
        console.log(`[POST /process] Original multer MIME type was '${audioFile.mimetype}', FORCING '${inputMimeTypeForGemini}' for Gemini.`);
      } else {
        inputMimeTypeForGemini = audioFile.mimetype || 'audio/webm;codecs=opus'; // Fallback if multer provides no type
      }
      console.log(`[POST /process] Processing uploaded audio file. MimeType for Gemini: ${inputMimeTypeForGemini}, Original Size: ${audioFile.size} bytes. Base64 length: ${audioDataB64.length}`);
    } else if (audioChunk) { // This path is for directly sent base64 data (less common from browser FormData)
      audioDataB64 = audioChunk; // Assuming audioChunk is already base64
      inputMimeTypeForGemini = req.body.mimeType || 'audio/webm;codecs=opus'; // Expect mimeType in body if sending chunk
      console.log(`[POST /process] Processing direct base64 audio chunk. Type for Gemini: ${inputMimeTypeForGemini}. Base64 length: ${audioDataB64.length}`);
      // If saving on error is enabled, try to convert base64 back to buffer for saving
      if (SAVE_FAILING_AUDIO_FOR_DEBUG) {
        try {
            audioFileBuffer = Buffer.from(audioDataB64, 'base64');
        } catch (e) {
            console.warn('[POST /process] Could not create buffer from audioChunk for saving on error.');
        }
      }
    }

    // Simple sanity check for the base64 string
    const isBase64PotentiallyValid = BASE64_REGEX.test(audioDataB64.substring(audioDataB64.length - Math.min(100, audioDataB64.length)));
    console.log(`[POST /process] Base64 string sanity check (ends with valid chars): ${isBase64PotentiallyValid}`);
    if (!isBase64PotentiallyValid && audioDataB64.length > 0) {
        console.warn(`[POST /process] Potential issue: Base64 string might contain invalid characters or not be padded correctly. Snippet (last 20): ...${audioDataB64.substring(audioDataB64.length - 20)}`);
    }

    // Parse metadata from the request
    const isFinalSegment = is_final === 'true'; 
    const requestTimestamp = timestamp || new Date().toISOString();
    const currentRecordingTime = parseInt(recording_time) || 0;

    // --- Simulation Mode Logic ---
    if (useSimulationThisRequest) {
      console.warn('[POST /process] Using transcription SIMULATION mode for this request.');
      // Define simulationPhrases here as it's only used in this block
      const simulationPhrases = [
        "Simulated: This is a test transcription.", "Simulated: Discussing important project updates.",
        "Simulated: The weather is nice today.", "Simulated: Please confirm receipt of this message."
      ];
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300)); // Simulate network delay
      let simulatedText = simulationPhrases[Math.floor(Math.random() * simulationPhrases.length)];
      if (isFinalSegment && Math.random() > 0.5) { // Make final segments a bit longer sometimes
        simulatedText += " " + simulationPhrases[Math.floor(Math.random() * simulationPhrases.length)];
      }
      const segment = {
        id: `sim_segment_${Date.now()}`, timestamp: requestTimestamp, text: simulatedText,
        confidence: 0.92, isFinal: isFinalSegment, recordingTime: currentRecordingTime,
      };
      console.log('[POST /process] Simulation successful. Segment preview:', segment.text.substring(0,30) + "...");
      return res.status(200).json({ success: true, segment });
    }

    // --- Real Gemini API Processing ---
    if (!geminiFlash) { // This check should ideally be redundant if useSimulationThisRequest is false
      console.error('[POST /process] Attempting real API call, but geminiFlash is not available. This indicates a critical initialization problem.');
      throw new Error('Gemini API service is not properly configured or available for real processing.');
    }

    console.log(`[POST /process] Attempting REAL Gemini call. Base64 snippet (first 60): ${audioDataB64.substring(0,60)}...`);
    
    const promptText = isFinalSegment 
      ? "This is the final segment of a meeting recording. Please accurately transcribe the following audio, focusing on clarity and coherence for a meeting context."
      : "This is an interim segment of an ongoing meeting recording. Please accurately transcribe the following audio segment.";

    const requestParts = [
        { text: promptText },
        { inline_data: { mime_type: inputMimeTypeForGemini, data: audioDataB64 } }
    ];
    // Log the structure being sent to Gemini, omitting the large base64 data for console readability
    console.log('[POST /process] Gemini request contents structure (inline_data data omitted for brevity):', 
                JSON.stringify([{role: "user", parts: [{text: promptText}, {inline_data: {mime_type: inputMimeTypeForGemini, data: `DATA_LENGTH_${audioDataB64.length}`}}]}])
    );

    // Make the actual call to Gemini API
    const geminiResult = await geminiFlash.generateContent({
      contents: [{ role: "user", parts: requestParts }]
      // generationConfig is taken from the model object itself, as set during initializeGemini
    });

    // Validate the response structure from Gemini
    if (!geminiResult || !geminiResult.response) {
      console.error('[POST /process] Invalid or empty response structure from Gemini API.');
      throw new Error('Received an invalid or empty response structure from the transcription service.');
    }

    const geminiResponse = geminiResult.response;
    if (typeof geminiResponse.text !== 'function') {
      console.error('[POST /process] Unexpected Gemini response format: text() function is missing. Response snippet:', JSON.stringify(geminiResponse).substring(0, 200));
      throw new Error('Invalid response format from the transcription service (text function missing).');
    }

    let transcribedText = geminiResponse.text().trim();
    // Handle cases where Gemini might return no text for valid audio (e.g., silence)
    if (!transcribedText && audioDataB64.length > 100) { // Check if audio was substantial
        console.warn('[POST /process] Gemini returned no text for a non-trivial audio segment. Assuming silence or no detectable speech.');
        transcribedText = "(No speech detected in this segment)"; 
    } else if (!transcribedText) {
        transcribedText = ""; // For truly empty or very short audio
    }

    console.log(`[POST /process] Gemini transcription successful: "${transcribedText.substring(0, 50)}..."`);

    // Prepare the segment object to send back to the client
    const segment = {
      id: `gemini_segment_${Date.now()}`, 
      timestamp: requestTimestamp, 
      text: transcribedText,
      confidence: 0.9, // Gemini API (as of last check) doesn't directly provide per-segment confidence for this call.
      isFinal: isFinalSegment, 
      recordingTime: currentRecordingTime,
    };
    return res.status(200).json({ success: true, segment });

  } catch (error) { // Main catch block for errors during the /process route logic
    console.error('[POST /process] Error during transcription processing:', error.message);
    if (process.env.NODE_ENV === 'development') {
        console.error('[POST /process] Full error object details:', {
            name: error.name,
            message: error.message,
            status: error.status, // For GoogleGenerativeAIFetchError
            statusText: error.statusText, // For GoogleGenerativeAIFetchError
            errorDetails: error.errorDetails, // For GoogleGenerativeAIFetchError
            stack: error.stack ? error.stack.substring(0, 400) : 'No stack available'
        });
    }

    // If debug flag is set and we have an audio buffer (from multer), save the failing audio
    if (SAVE_FAILING_AUDIO_FOR_DEBUG && audioFileBuffer) {
      try {
        if (!fs.existsSync(DEBUG_AUDIO_SAVE_PATH)){ // Create debug directory if it doesn't exist
            fs.mkdirSync(DEBUG_AUDIO_SAVE_PATH, { recursive: true });
            console.log(`[Debug] Created directory: ${DEBUG_AUDIO_SAVE_PATH}`);
        }
        // Attempt to get a file extension from the original filename, default to .webm
        const fileExtension = (req.file && req.file.originalname && req.file.originalname.includes('.')) 
                              ? req.file.originalname.split('.').pop() 
                              : 'webm';
        const debugFileName = `failed_audio_${Date.now()}_${requestArrivalTimestamp.replace(/:/g, '-')}.${fileExtension}`;
        const fullSavePath = path.join(DEBUG_AUDIO_SAVE_PATH, debugFileName);
        fs.writeFileSync(fullSavePath, audioFileBuffer); // Write the raw buffer
        console.log(`[Debug] Saved failing audio to: ${fullSavePath}`);
      } catch (saveError) {
        console.error('[Debug] Error saving failing audio file:', saveError.message);
      }
    } else if (SAVE_FAILING_AUDIO_FOR_DEBUG) {
        console.warn('[Debug] Wanted to save failing audio, but audioFileBuffer was not available (e.g., if input was audioChunk).');
    }

    // Fallback response logic: send a simulated error message to the client
    try {
      const isFinal = !!(req && req.body && req.body.is_final === 'true');
      const timestamp = (req && req.body && req.body.timestamp) || new Date().toISOString();
      const originalErrorMessage = error && error.message ? String(error.message).substring(0, 150) : "Unknown transcription processing error";
      
      // Define errorPhrases here, within this scope
      const errorPhrases = [
        "Apologies, an issue occurred while processing this audio segment.",
        "The transcription service faced a temporary problem with this chunk.",
        "Could not transcribe this audio segment due to an error.",
      ];
      const fallbackText = errorPhrases[Math.floor(Math.random() * errorPhrases.length)];

      const errorSegment = {
        id: `error_segment_${Date.now()}`, 
        timestamp, 
        text: fallbackText,
        confidence: 0.0, 
        error: true, // Flag to indicate this is an error segment
        errorDetail: originalErrorMessage, // Provide some detail about the original error
        isFinal: isFinal, // Preserve the finality status if possible
      };
      console.warn('[POST /process] Sending error fallback response to client due to processing error.');
      // Send 200 OK with an error flag, so frontend can handle it gracefully
      return res.status(200).json({
        success: true, // The HTTP request itself was handled, but transcription had an issue
        segment: errorSegment,
        isErrorFallback: true 
      });
    } catch (fallbackError) {
      // If the fallback response logic itself fails (highly unlikely but possible)
      console.error('[POST /process] CRITICAL: Error in fallback simulation response itself:', fallbackError.message);
      const detail = fallbackError && fallbackError.message ? String(fallbackError.message) : 'Transcription fallback mechanism also failed.';
      // Send a generic 500 error
      return res.status(500).json(getErrorResponse ? 
        getErrorResponse('Server Error', detail.substring(0,150)) :
        { success: false, error: { title: 'Server Error', detail: detail.substring(0,150) }}
      );
    }
  }
});

// Simulated /summary route (as you provided)
router.post('/summary', authMiddleware, async (req, res) => {
  console.log('[POST /summary] Received request. User UID:', req.user ? req.user.uid : 'N/A');
  try {
    const { transcription } = req.body;
    if (!transcription) {
      return res.status(400).json(getErrorResponse ? 
        getErrorResponse('Bad Request', 'No transcription provided for summary.') :
        { success: false, error: { title: 'Bad Request', detail: 'No transcription provided for summary.'}}
      );
    }
    console.log('[POST /summary] Generating simulated summary for transcript length:', transcription.length);
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    const summary = {
      id: `summary_${Date.now()}`,
      title: "Simulated Meeting Summary",
      keyPoints: [
        "Key point one derived from transcript.",
        "Another important discussion point.",
        "Decision was made regarding the new feature."
      ],
      actionItems: ["Follow up with marketing team.", "Prepare report by EOD."]
    };
    return res.status(200).json({ success: true, summary });
  } catch (error) {
    console.error('[POST /summary] Error generating summary:', error.message);
    return res.status(500).json(getErrorResponse ?
      getErrorResponse('Server Error', 'Failed to generate summary.') :
      { success: false, error: { title: 'Server Error', detail: 'Failed to generate summary.'}}
    );
  }
});

// Simulated /chat route (as you provided)
router.post('/chat', authMiddleware, async (req, res) => {
  console.log('[POST /chat] Received request. User UID:', req.user ? req.user.uid : 'N/A');
  try {
    const { transcription, query } = req.body;
    if (!transcription || !query) {
      return res.status(400).json(getErrorResponse ?
        getErrorResponse('Bad Request', 'Transcription and query are required for chat.') :
        { success: false, error: { title: 'Bad Request', detail: 'Transcription and query are required for chat.'}}
      );
    }
    console.log(`[POST /chat] Simulating chat response for query: "${query.substring(0,30)}..."`);
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));
    const response = {
      id: `chat_response_${Date.now()}`,
      query,
      answer: `Based on the provided transcript, regarding "${query.substring(0,20)}...", it appears the main consensus was to proceed with caution and gather more data.`
    };
    return res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('[POST /chat] Error in chat processing:', error.message);
    return res.status(500).json(getErrorResponse ?
      getErrorResponse('Server Error', 'Failed to process chat query.') :
      { success: false, error: { title: 'Server Error', detail: 'Failed to process chat query.'}}
    );
  }
});

module.exports = router;
