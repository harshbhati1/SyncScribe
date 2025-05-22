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
const { initializeGemini } = require('../config/gemini.config'); // Ensure path is correct
const { admin } = require('../config/firebase.config'); // Import Firebase Admin

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

// Initialize Firestore database instance
const db = admin.firestore();

// Route to save a meeting to Firestore
router.post('/meeting', authMiddleware, async (req, res) => {
  console.log('[POST /meeting] Saving meeting data');
  try {
    const { id, title, transcript, segments, chatHistory, summary, date } = req.body;
    
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized access. User ID not found in token.' 
      });
    }
    
    const userId = req.user.uid;
    const meetingId = id || `meeting-${Date.now()}`;
    
    // Log the chat history details to help with debugging
    console.log(`[POST /meeting] Chat history received: ${chatHistory?.length || 0} messages`);
    if (chatHistory && chatHistory.length > 0) {
      console.log(`[POST /meeting] First chat message: ${JSON.stringify(chatHistory[0])}`);
      console.log(`[POST /meeting] Last chat message: ${JSON.stringify(chatHistory[chatHistory.length - 1])}`);
    }
    
    // Create the meeting document in Firestore
    const meetingRef = db.collection('users').doc(userId).collection('meetings').doc(meetingId);
    
    // Prepare meeting data
    const meetingData = {
      title: title || 'Untitled Meeting',
      transcript: transcript || '',
      segments: segments || [],
      chatHistory: chatHistory || [],
      summary: summary || null,
      createdAt: date || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to Firestore
    await meetingRef.set(meetingData, { merge: true });
    
    console.log(`[POST /meeting] Meeting saved successfully for user ${userId}, meeting ID: ${meetingId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Meeting saved successfully',
      meetingId
    });
  } catch (error) {
    console.error('[POST /meeting] Error saving meeting:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save meeting data'
    });
  }
});

// Route to retrieve a meeting by ID
router.get('/meeting/:meetingId', authMiddleware, async (req, res) => {
  console.log('[GET /meeting/:meetingId] Retrieving meeting');
  try {
    const { meetingId } = req.params;
    
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized access. User ID not found in token.' 
      });
    }
    
    const userId = req.user.uid;
    
    // Get meeting document from Firestore
    const meetingRef = db.collection('users').doc(userId).collection('meetings').doc(meetingId);
    const meetingDoc = await meetingRef.get();
    
    if (!meetingDoc.exists) {
      return res.status(404).json({
        success: false,
        error: `Meeting with ID ${meetingId} not found`
      });
    }
    
    const meetingData = {
      id: meetingId,
      ...meetingDoc.data()
    };
    
    console.log(`[GET /meeting/:meetingId] Meeting retrieved successfully for user ${userId}, meeting ID: ${meetingId}`);
    
    return res.status(200).json({
      success: true,
      data: meetingData
    });
  } catch (error) {
    console.error('[GET /meeting/:meetingId] Error retrieving meeting:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve meeting data'
    });
  }
});

// Route to list all meetings for a user
router.get('/meetings', authMiddleware, async (req, res) => {
  console.log('[GET /meetings] Retrieving all meetings');
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized access. User ID not found in token.' 
      });
    }
    
    const userId = req.user.uid;
    
    // Query meetings collection for this user
    const meetingsRef = db.collection('users').doc(userId).collection('meetings');
    const snapshot = await meetingsRef.orderBy('updatedAt', 'desc').get();
    
    const meetings = [];
    snapshot.forEach(doc => {
      meetings.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`[GET /meetings] Retrieved ${meetings.length} meetings for user ${userId}`);
    
    return res.status(200).json({
      success: true,
      data: meetings
    });
  } catch (error) {
    console.error('[GET /meetings] Error retrieving meetings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve meetings'
    });
  }
});

// Route to update a meeting title
router.patch('/meeting/:meetingId/title', authMiddleware, async (req, res) => {
  console.log('[PATCH /meeting/:meetingId/title] Updating meeting title');
  try {
    const { meetingId } = req.params;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Meeting title is required'
      });
    }
    
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized access. User ID not found in token.' 
      });
    }
    
    const userId = req.user.uid;
    
    // Update meeting title in Firestore
    const meetingRef = db.collection('users').doc(userId).collection('meetings').doc(meetingId);
    await meetingRef.update({
      title,
      updatedAt: new Date().toISOString()
    });
    
    console.log(`[PATCH /meeting/:meetingId/title] Title updated successfully for meeting ${meetingId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Meeting title updated successfully'
    });
  } catch (error) {
    console.error('[PATCH /meeting/:meetingId/title] Error updating meeting title:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update meeting title'
    });
  }
});

// Route to update a meeting favorite status
router.patch('/meeting/:meetingId/favorite', authMiddleware, async (req, res) => {
  console.log('[PATCH /meeting/:meetingId/favorite] Updating meeting favorite status');
  try {
    const { meetingId } = req.params;
    const { isFavorite } = req.body;
    
    if (typeof isFavorite !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isFavorite boolean value is required'
      });
    }
    
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized access. User ID not found in token.' 
      });
    }
    
    const userId = req.user.uid;
    
    // Update meeting favorite status in Firestore
    const meetingRef = db.collection('users').doc(userId).collection('meetings').doc(meetingId);
    await meetingRef.update({
      isFavorite,
      updatedAt: new Date().toISOString()
    });
    
    console.log(`[PATCH /meeting/:meetingId/favorite] Favorite status updated successfully for meeting ${meetingId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Meeting favorite status updated successfully'
    });
  } catch (error) {
    console.error('[PATCH /meeting/:meetingId/favorite] Error updating meeting favorite status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update meeting favorite status'
    });
  }
});

// Route to delete a meeting
router.delete('/meeting/:meetingId', authMiddleware, async (req, res) => {
  console.log('[DELETE /meeting/:meetingId] Deleting meeting');
  try {
    const { meetingId } = req.params;
    
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized access. User ID not found in token.' 
      });
    }
    
    const userId = req.user.uid;
    
    // Delete meeting document from Firestore
    const meetingRef = db.collection('users').doc(userId).collection('meetings').doc(meetingId);
    
    // Check if meeting exists before deleting
    const meetingDoc = await meetingRef.get();
    if (!meetingDoc.exists) {
      return res.status(404).json({
        success: false,
        error: `Meeting with ID ${meetingId} not found`
      });
    }
    
    // Delete meeting
    await meetingRef.delete();
    
    console.log(`[DELETE /meeting/:meetingId] Meeting deleted successfully for user ${userId}, meeting ID: ${meetingId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    console.error('[DELETE /meeting/:meetingId] Error deleting meeting:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete meeting'
    });
  }
});

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