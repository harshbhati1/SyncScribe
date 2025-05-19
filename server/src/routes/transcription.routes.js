/**
 * Transcription Routes
 * Routes for audio transcription and processing
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middlewares/auth.middleware');
const { getErrorResponse } = require('../utils/error.utils');
const { initializeGemini } = require('../config/gemini.config');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Configure Gemini for transcription
const { geminiFlash } = initializeGemini();

// Process audio for transcription
router.post('/process', authMiddleware, upload.single('audio_data'), async (req, res) => {
  try {
    // Check if we received audio data
    const audioFile = req.file;
    const { audioChunk, meetingId } = req.body;
    
    // Determine which type of audio data we're working with
    if (!audioFile && !audioChunk) {
      return res.status(400).json(
        getErrorResponse('Bad Request', 'No audio data provided')
      );
    }
    
    let audioData;
    let mimeType;
    
    // Handle FormData file uploads
    if (audioFile) {
      // Convert buffer to base64 for Gemini
      audioData = audioFile.buffer.toString('base64');
      mimeType = audioFile.mimetype || 'audio/webm';
      console.log(`Processing audio file of type: ${mimeType}, size: ${audioFile.size} bytes`);
    } 
    // Handle JSON direct base64 audio data
    else if (audioChunk) {
      audioData = audioChunk;
      mimeType = 'audio/webm'; // Default mime type for JSON submissions
      console.log('Processing direct audio chunk data');
    }
    
    // If Gemini API is not available in development mode, use simulation
    if (process.env.NODE_ENV === 'development' && !process.env.USE_REAL_GEMINI) {
      console.log('Using transcription simulation mode');
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate sample phrases for simulation
      const phrases = [
        "I think we should prioritize the user experience.",
        "Let's schedule a follow-up meeting next week.",
        "The analytics data shows significant improvement in user retention.",
        "We need to address the bug in the authentication flow.",
        "I agree with that approach, it aligns with our goals.",
        "What's the timeline for launching these new features?",
        "Could you share the documentation with the team?",
        "The client feedback has been mostly positive.",
        "We should integrate the new API by the end of the sprint.",
        "Let's make sure we're addressing all the accessibility concerns.",
      ];
      
      // Select a random phrase for simulation
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      
      // Generate a simple transcription based on timestamp
      const timestamp = new Date().toISOString();
      const segment = {
        id: `segment-${Date.now()}`,
        timestamp,
        text: randomPhrase,
        confidence: 0.85 + (Math.random() * 0.15) // Random confidence between 0.85-1.0
      };
      
      return res.status(200).json({
        success: true,
        segment
      });
    }
    
    // Process with Gemini API
    try {
      console.log('Processing audio with Gemini 2.0 Flash model');
      
      // Create Gemini prompt for audio transcription
      const result = await geminiFlash.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: "Please accurately transcribe the following audio segment." },
              { 
                inline_data: {
                  mime_type: mimeType,
                  data: audioData
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          topP: 1,
          topK: 32,
          maxOutputTokens: 256,
        }
      });
      
      // Extract transcribed text
      const response = await result.response;
      const transcribedText = response.text().trim();
      
      console.log('Gemini transcription result:', transcribedText);
        // Create segment data
      const segment = {
        id: `segment-${Date.now()}`,
        timestamp: new Date().toISOString(),
        text: transcribedText || "Sorry, no speech detected in this segment.",
        confidence: 0.9 // Gemini doesn't provide confidence scores currently
      };
      
      // In a real app, you'd save this to a database
      // For now, we just return the transcription
      return res.status(200).json({
        success: true,
        segment
      });
    } catch (geminiError) {
      console.error('Error with Gemini API:', geminiError);
      
      // Fallback to simulation on Gemini error
      const phrases = [
        "Sorry, I couldn't transcribe that audio segment.",
        "There seems to be an issue with speech recognition.",
        "The audio wasn't clear enough to transcribe accurately.",
      ];
      
      const errorPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      
      const segment = {
        id: `segment-${Date.now()}`,
        timestamp: new Date().toISOString(),
        text: errorPhrase,
        confidence: 0.5,
        error: true
      };
      
      return res.status(200).json({
        success: true,
        segment
      });
    }
  } catch (error) {
    console.error('Error processing audio for transcription:', error);
    return res.status(500).json(
      getErrorResponse('Server Error', 'Error processing transcription')
    );
  }
});

// Generate summary of a meeting
router.post('/summary', authMiddleware, async (req, res) => {
  try {
    const { transcription, meetingId } = req.body;
    
    if (!transcription) {
      return res.status(400).json(
        getErrorResponse('Bad Request', 'No transcription provided')
      );
    }

    // In a real implementation, we'd use Gemini to generate a summary
    // For now, let's simulate this
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simple simulation of a meeting summary
    const summary = {
      id: `summary-${Date.now()}`,
      title: "Meeting Summary",
      keyPoints: [
        "Discussed project timeline and milestones",
        "Addressed concerns about resource allocation",
        "Agreed to weekly status updates",
        "Next steps include detailed documentation review"
      ],
      actionItems: [
        "Team to provide resource estimates by Friday",
        "Schedule follow-up meeting for next week",
        "Create shared document for collaboration"
      ]
    };
    
    return res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error generating meeting summary:', error);
    return res.status(500).json(
      getErrorResponse('Server Error', 'Error generating meeting summary')
    );
  }
});

// Chat with transcription
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { transcription, query } = req.body;
    
    if (!transcription || !query) {
      return res.status(400).json(
        getErrorResponse('Bad Request', 'Missing transcription or query')
      );
    }

    // Simulate AI chat response using Gemini
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simple simulation of AI response
    const response = {
      id: `response-${Date.now()}`,
      query,
      answer: `Based on the meeting transcription, the team discussed ${query} and decided to move forward with implementation after careful consideration of all alternatives.`
    };
    
    return res.status(200).json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error generating chat response:', error);
    return res.status(500).json(
      getErrorResponse('Server Error', 'Error generating chat response')
    );
  }
});

// Get meeting by ID
router.get('/meeting/:meetingId', authMiddleware, async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    if (!meetingId) {
      return res.status(400).json(
        getErrorResponse('Bad Request', 'Meeting ID is required')
      );
    }

    // Simulate fetching meeting data
    // In a real app, this would come from a database
    const meetingData = {
      id: meetingId,
      title: `Meeting ${meetingId}`,
      date: new Date().toISOString(),
      duration: 45, // minutes
      participants: ['John Doe', 'Jane Smith', 'Mike Johnson'],
      transcription: 'This is a sample transcription for meeting ' + meetingId
    };
    
    return res.status(200).json({
      success: true,
      meeting: meetingData
    });
  } catch (error) {
    console.error('Error fetching meeting:', error);
    return res.status(500).json(
      getErrorResponse('Server Error', 'Error fetching meeting data')
    );
  }
});

// Save meeting
router.post('/meeting', authMiddleware, async (req, res) => {
  try {
    const { title, transcription, summary } = req.body;
    
    if (!title || !transcription) {
      return res.status(400).json(
        getErrorResponse('Bad Request', 'Meeting title and transcription are required')
      );
    }

    // Simulate saving to database
    // In a real app, you'd save to a database
    const meetingId = `meeting-${Date.now()}`;
    
    return res.status(201).json({
      success: true,
      meetingId,
      message: 'Meeting saved successfully'
    });
  } catch (error) {
    console.error('Error saving meeting:', error);
    return res.status(500).json(
      getErrorResponse('Server Error', 'Error saving meeting')
    );
  }
});

module.exports = router;
