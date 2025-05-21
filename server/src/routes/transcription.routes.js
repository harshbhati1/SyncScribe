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
// const { getErrorResponse } = require('../utils/error.utils'); // Assuming you have this
const { initializeGemini } = require('../config/gemini.config'); // Ensure path is correct

// --- DEBUGGING FLAG ---
const SAVE_AUDIO_FOR_DEBUG = true; // General flag to enable saving
const DEBUG_AUDIO_SAVE_PATH = path.join(__dirname, '..', 'debug_audio'); 
if (SAVE_AUDIO_FOR_DEBUG && !fs.existsSync(DEBUG_AUDIO_SAVE_PATH)) {
    try {
        fs.mkdirSync(DEBUG_AUDIO_SAVE_PATH, { recursive: true });
        console.log(`[Debug] Created directory: ${DEBUG_AUDIO_SAVE_PATH}`);
    } catch (e) {
        console.error(`[Debug] Error creating debug audio directory ${DEBUG_AUDIO_SAVE_PATH}:`, e);
    }
}
let hasSavedFirstChunk = false; // Flag to save only the very first chunk
// --- END DEBUGGING FLAG ---

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for audio files
});

const BASE64_REGEX = /^[A-Za-z0-9+/]+[=]{0,2}$/; // For basic validation

router.post('/process', authMiddleware, upload.single('audio_data'), async (req, res) => {
  const requestArrivalTimestamp = new Date().toISOString();
  console.log('\n--- [POST /process] NEW REQUEST ---');
  console.log(`[POST /process] Timestamp: ${requestArrivalTimestamp}`);
  console.log('[POST /process] User UID:', req.user ? req.user.uid : 'N/A');
  
  let geminiFlash, isGeminiSimulationMode;
  try {
    const geminiConfig = initializeGemini(); 
    geminiFlash = geminiConfig.geminiFlash;
    isGeminiSimulationMode = geminiConfig.isSimulationMode;
    console.log(`[POST /process] Gemini config loaded. Simulation Mode: ${isGeminiSimulationMode}, geminiFlash available: ${!!geminiFlash}`);
  } catch (initError) {
    console.error('[POST /process] CRITICAL: Failed to get Gemini config:', initError.message);
    isGeminiSimulationMode = true; 
    geminiFlash = null;
  }

  const isDevelopmentEnv = process.env.NODE_ENV === 'development';
  const forceRealGeminiInDev = process.env.USE_REAL_GEMINI === 'true';
  const useSimulationThisRequest = isGeminiSimulationMode || (isDevelopmentEnv && !forceRealGeminiInDev) || !geminiFlash;
  
  let audioFileBuffer;

  try {
    const audioFile = req.file;
    const { is_final, timestamp, recording_time } = req.body; 

    console.log('[POST /process] req.file present:', !!audioFile);
    if (audioFile && audioFile.buffer) {
      console.log('[POST /process] req.file.mimetype:', audioFile.mimetype);
      console.log('[POST /process] req.file.originalname:', audioFile.originalname);
      console.log('[POST /process] req.file.size:', audioFile.size);
      audioFileBuffer = audioFile.buffer; 
    } else {
        console.warn('[POST /process] No audio_data file or buffer received.');
        return res.status(400).json({ success: false, error: 'No audio_data file or buffer provided.' });
    }
    console.log('[POST /process] req.body fields:', { is_final, timestamp, recording_time });

    // --- MODIFICATION: Save the FIRST chunk processed in this server session ---
    if (SAVE_AUDIO_FOR_DEBUG && !hasSavedFirstChunk && audioFileBuffer) {
        try {
            const fileExtension = audioFile.originalname.split('.').pop() || 'webm';
            const debugFileName = `FIRST_SUCCESSFUL_audio_${Date.now()}_${requestArrivalTimestamp.replace(/:/g, '-')}.${fileExtension}`;
            const fullSavePath = path.join(DEBUG_AUDIO_SAVE_PATH, debugFileName);
            fs.writeFileSync(fullSavePath, audioFileBuffer);
            console.log(`[Debug] Saved FIRST audio chunk to: ${fullSavePath}`);
            hasSavedFirstChunk = true; // Set flag so we don't save again
        } catch (saveError) {
            console.error('[Debug] Error saving FIRST audio file:', saveError.message);
        }
    }
    // --- END MODIFICATION ---

    let audioDataB64 = audioFile.buffer.toString('base64');
    let inputMimeTypeForGemini = audioFile.mimetype;
    if (inputMimeTypeForGemini && inputMimeTypeForGemini.startsWith('audio/webm') && !inputMimeTypeForGemini.includes('codecs=')) {
      inputMimeTypeForGemini = 'audio/webm;codecs=opus'; 
      console.log(`[POST /process] Adjusted multer MIME type to '${inputMimeTypeForGemini}' for Gemini.`);
    } else if (!inputMimeTypeForGemini) {
      inputMimeTypeForGemini = 'audio/webm;codecs=opus'; // Default if missing
      console.log(`[POST /process] MIME type missing, defaulted to '${inputMimeTypeForGemini}' for Gemini.`);
    }
    console.log(`[POST /process] Processing audio. MimeType for Gemini: ${inputMimeTypeForGemini}, Base64 length: ${audioDataB64.length}`);
    
    const isFinalSegment = is_final === 'true'; 
    const requestTimestampForSegment = timestamp || new Date().toISOString();
    const currentRecordingTime = parseInt(recording_time) || 0;

    if (useSimulationThisRequest) {
      console.warn('[POST /process] Using transcription SIMULATION mode.');
      // ... (simulation logic as you had before)
      const simulationPhrases = ["Simulated: Test transcription."];
      await new Promise(resolve => setTimeout(resolve, 200));
      let simulatedText = simulationPhrases[0];
      const segment = {
        id: `sim_segment_${Date.now()}`, timestamp: requestTimestampForSegment, text: simulatedText,
        isFinal: isFinalSegment, recordingTime: currentRecordingTime,
      };
      return res.status(200).json({ success: true, segment });
    }

    if (!geminiFlash) {
      console.error('[POST /process] Gemini client (geminiFlash) is not available. Cannot process real request.');
      throw new Error('Gemini API service is not properly configured or available.');
    }

    console.log(`[POST /process] Attempting REAL Gemini call.`);
    const promptText = isFinalSegment 
      ? "This is the final segment of a meeting recording. Please accurately transcribe the following audio..."
      : "This is an interim segment of an ongoing meeting recording. Please accurately transcribe...";

    const requestParts = [
      { text: promptText },
      { inline_data: { mime_type: inputMimeTypeForGemini, data: audioDataB64 } }
    ];
    
    const geminiResult = await geminiFlash.generateContent({
      contents: [{ role: "user", parts: requestParts }]
    });

    const geminiResponse = geminiResult.response;
    let transcribedText = "";
    if (geminiResponse && typeof geminiResponse.text === 'function') {
        transcribedText = geminiResponse.text().trim();
    } else if (geminiResponse && geminiResponse.candidates && geminiResponse.candidates.length > 0 && geminiResponse.candidates[0].content && geminiResponse.candidates[0].content.parts && geminiResponse.candidates[0].content.parts.length > 0 && geminiResponse.candidates[0].content.parts[0].text) {
        transcribedText = geminiResponse.candidates[0].content.parts[0].text.trim();
    } else {
        console.warn('[POST /process] Gemini response structure not as expected or no text found.');
        transcribedText = "(No transcription text returned)";
    }
    
    if (!transcribedText && audioFile.size > 1000) {
      transcribedText = "(No speech detected)";
    }
    console.log(`[POST /process] Gemini transcription successful: "${transcribedText.substring(0, 50)}..."`);

    const segment = {
      id: `gemini_segment_${Date.now()}`, 
      timestamp: requestTimestampForSegment, 
      text: transcribedText,
      isFinal: isFinalSegment, 
      recordingTime: currentRecordingTime,
    };
    return res.status(200).json({ success: true, segment });

  } catch (error) {
    console.error('[POST /process] Error during transcription processing:', error.message);
    if (error.response && error.response.data) {
        console.error('[POST /process] Gemini API Error Details:', error.response.data);
    } else if (process.env.NODE_ENV === 'development') {
        console.error('[POST /process] Full error object:', error);
    }

    if (SAVE_AUDIO_FOR_DEBUG && audioFileBuffer) { // Save failing audio
      try {
        const fileExtension = (req.file?.originalname?.includes('.')) 
                              ? req.file.originalname.split('.').pop() 
                              : 'webm';
        const debugFileName = `FAILED_audio_${Date.now()}_${requestArrivalTimestamp.replace(/:/g, '-')}.${fileExtension}`;
        const fullSavePath = path.join(DEBUG_AUDIO_SAVE_PATH, debugFileName);
        fs.writeFileSync(fullSavePath, audioFileBuffer);
        console.log(`[Debug] Saved FAILING audio to: ${fullSavePath}`);
      } catch (saveError) {
        console.error('[Debug] Error saving FAILING audio file:', saveError.message);
      }
    }

    // Fallback response
    const isFinal = !!(req?.body?.is_final === 'true');
    const fallbackTimestamp = (req?.body?.timestamp) || new Date().toISOString();
    const originalErrorMessage = error?.message ? String(error.message).substring(0, 150) : "Unknown error";
    const errorSegment = {
      id: `error_segment_${Date.now()}`, timestamp: fallbackTimestamp, text: `Error: ${originalErrorMessage}`,
      error: true, errorDetail: originalErrorMessage, isFinal: isFinal,
    };
    console.warn('[POST /process] Sending error fallback response to client.');
    return res.status(200).json({ // Send 200 so frontend can parse it as an error segment
      success: true, // HTTP request itself was handled
      segment: errorSegment,
      isErrorFallback: true 
    });
  }
});

module.exports = router;