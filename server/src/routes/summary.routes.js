/**
 * Summary Routes
 * Routes for generating meeting summaries
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const { initializeGemini } = require('../config/gemini.config');

/**
 * POST /api/summary/generate
 * Generates a meeting summary from a transcript
 */
router.post('/generate', authMiddleware, async (req, res) => {
  const { transcript, meetingId } = req.body;
  const userId = req.user ? req.user.uid : 'unknown';

  console.log(`[POST /api/summary/generate] Generating summary for user: ${userId}, meeting: ${meetingId || 'new'}`);
  console.log(`[POST /api/summary/generate] Transcript length: ${transcript?.length || 0} characters`);

  if (!transcript || transcript.trim().length < 30) {
    return res.status(400).json({ 
      success: false, 
      error: 'Transcript is too short or missing. Please provide a valid transcript.'
    });
  }

  let geminiPro;
  try {
    const geminiConfig = initializeGemini();
    geminiPro = geminiConfig.geminiPro; // Use Pro model for more involved content generation

    if (!geminiPro) {
      console.error('[POST /api/summary/generate] Gemini Pro model is not available');
      throw new Error('AI service is not properly configured');
    }
  } catch (initError) {
    console.error('[POST /api/summary/generate] Failed to initialize Gemini:', initError);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to initialize AI service for summary generation'
    });
  }

  try {
    const summaryPrompt = `You are an expert meeting analyst for the TwinMind application.
    
Your task is to analyze the following meeting transcript and generate a comprehensive summary.

TRANSCRIPT:
---
${transcript}
---

Please provide a structured summary with the following sections:

1. TITLE: Suggest a concise title for this meeting based on the content.

2. OVERALL SUMMARY: Write a concise paragraph (3-5 sentences) summarizing what the meeting was about.

3. KEY DISCUSSION POINTS: List the main topics and key points discussed in the meeting (4-8 bullet points).

4. ACTION ITEMS: Extract all action items, tasks, and commitments mentioned in the meeting. For each action item, include:
   - What needs to be done
   - Who is responsible (if mentioned)
   - Timeline/deadline (if mentioned)

Format your response using plain text without markdown formatting. For the response structure, use this format:

TITLE: [Your suggested title]

OVERALL SUMMARY:
[Your summary paragraph]

KEY DISCUSSION POINTS:
- [Point 1]
- [Point 2]
...

ACTION ITEMS:
- [Action item 1]
- [Action item 2]
...

Be specific and extract information directly from the transcript. If certain sections cannot be determined from the transcript, note this in your response.`;

    const geminiResult = await geminiPro.generateContent({
      contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4000,
      }
    });

    const response = geminiResult.response;
    if (!response || !response.text) {
      throw new Error('No valid response from AI model');
    }

    const summaryText = response.text();
    
    // Parse the summary text into structured data
    const summary = parseSummaryResponse(summaryText);

    return res.status(200).json({ 
      success: true, 
      summary
    });

  } catch (error) {
    console.error('[POST /api/summary/generate] Error generating summary:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: `Failed to generate summary: ${error.message}`
    });
  }
});

/**
 * Helper function to parse the raw AI summary response into a structured object
 */
function parseSummaryResponse(text) {
  const summary = {
    title: '',
    overall: '',
    keyPoints: [],
    actionItems: []
  };

  // Extract title (first non-empty line after "TITLE:")
  const titleMatch = text.match(/TITLE:?\s*([^\n]+)/i);
  if (titleMatch && titleMatch[1]) {
    summary.title = titleMatch[1].trim();
  }

  // Extract overall summary (text between "OVERALL SUMMARY:" and "KEY DISCUSSION POINTS:")
  const overallMatch = text.match(/OVERALL SUMMARY:?\s*([\s\S]*?)(?=KEY DISCUSSION POINTS:|$)/i);
  if (overallMatch && overallMatch[1]) {
    summary.overall = overallMatch[1].trim();
  }

  // Extract key points (bullet points between "KEY DISCUSSION POINTS:" and "ACTION ITEMS:")
  const keyPointsMatch = text.match(/KEY DISCUSSION POINTS:?\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
  if (keyPointsMatch && keyPointsMatch[1]) {
    const keyPointsText = keyPointsMatch[1].trim();
    // Extract bullet points (lines starting with "-", "•", "*", or digit followed by ".")
    const keyPointsLines = keyPointsText.split('\n')
      .map(line => line.trim())
      .filter(line => line.match(/^[-•*]\s+|^\d+\.\s+/));
    
    summary.keyPoints = keyPointsLines.map(line => 
      line.replace(/^[-•*]\s+|^\d+\.\s+/, '').trim()
    );
  }

  // Extract action items (bullet points after "ACTION ITEMS:")
  const actionItemsMatch = text.match(/ACTION ITEMS:?\s*([\s\S]*?)(?=$)/i);
  if (actionItemsMatch && actionItemsMatch[1]) {
    const actionItemsText = actionItemsMatch[1].trim();
    // Extract bullet points (lines starting with "-", "•", "*", or digit followed by ".")
    const actionItemsLines = actionItemsText.split('\n')
      .map(line => line.trim())
      .filter(line => line.match(/^[-•*]\s+|^\d+\.\s+/));
    
    summary.actionItems = actionItemsLines.map(line => 
      line.replace(/^[-•*]\s+|^\d+\.\s+/, '').trim()
    );
  }

  return summary;
}

module.exports = router;
