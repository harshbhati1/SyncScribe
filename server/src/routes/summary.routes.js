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

  try {    const summaryPrompt = `You are an expert meeting analyst for the TwinMind application.
    
I will provide you with a meeting transcript. Your task is to create a comprehensive and insightful summary report based solely on this information.

Please follow these critical instructions for structuring and generating the report:

1. ANALYZE THE TRANSCRIPT: Thoroughly read and understand the transcript content.

2. IDENTIFY KEY THEMES AND LOGICAL DIVISIONS: Based on your analysis, identify the natural main themes, core components, logical sections, or distinct aspects within the meeting.

3. DYNAMICALLY CREATE SECTION HEADLINES: Design your own relevant and descriptive headlines (section titles) for the summary. These headlines should accurately reflect and categorize the information presented in each section. DO NOT use a predefined template for headlines; create them based on the unique content of the meeting.

4. USE BULLET POINTS FOR CONTENT: Under each headline you create, present the summarized information, key details, findings, arguments, or steps through detailed and analytical bullet points. Each bullet point should be informative and capture significant aspects of the meeting.

5. ENSURE ANALYTICAL DEPTH: Your summary should not be a mere listing of facts. Strive for an analytical quality that provides a deep understanding of the meeting. This includes highlighting key insights, relationships between different pieces of information, implications, and the overall significance.

6. COMPREHENSIVE COVERAGE: Ensure all critical aspects of the meeting are covered within your self-designed sections and bullet points.

7. INCLUDE THESE MANDATORY SECTIONS (but design your own headlines for them):
   - A section with the title/subject of the meeting
   - A brief overall summary section (2-3 sentences)
   - A section covering key discussion points
   - A section for action items and next steps

TRANSCRIPT:
---
${transcript}
---

Format your response using the following structure:

TITLE: [Your suggested title for the meeting]

SUMMARY: [Brief 2-3 sentence overall summary]

[DYNAMICALLY CREATED SECTION HEADLINE 1]:
- [Analytical bullet point]
- [Analytical bullet point]
...

[DYNAMICALLY CREATED SECTION HEADLINE 2]:
- [Analytical bullet point]
- [Analytical bullet point]
...

[DYNAMICALLY CREATED SECTION HEADLINE for action items]:
- [Action item with responsible person and timeline if mentioned]
- [Action item with responsible person and timeline if mentioned]
...

[Add more dynamic sections as appropriate based on the meeting content]

Be specific and extract information directly from the transcript. If certain information cannot be determined, note this in your response.`;    const geminiResult = await geminiPro.generateContent({
      contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8000,
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
    sections: [] // Will hold dynamically created sections with headline and bullet points
  };

  // Extract title (first non-empty line after "TITLE:")
  const titleMatch = text.match(/TITLE:?\s*([^\n]+)/i);
  if (titleMatch && titleMatch[1]) {
    summary.title = titleMatch[1].trim();
  }

  // Extract overall summary (text between "SUMMARY:" and the first dynamic section headline)
  const overallMatch = text.match(/SUMMARY:?\s*([\s\S]*?)(?=\n\s*[A-Z][^:]*:|\n\s*$)/i);
  if (overallMatch && overallMatch[1]) {
    summary.overall = overallMatch[1].trim();
  }

  // Extract all dynamic sections (heading followed by bullet points)
  // This regex finds all sections with a headline followed by bullet points
  const sectionRegex = /\n([A-Z][^:\n]*):?\s*\n((?:\s*-[^\n]*\n?)+)/g;
  
  let match;
  while ((match = sectionRegex.exec(text)) !== null) {
    const headline = match[1].trim();
    const contentText = match[2].trim();
    
    // Extract bullet points
    const bulletPoints = contentText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim());
    
    // Add to sections array
    if (bulletPoints.length > 0) {
      summary.sections.push({
        headline,
        bulletPoints
      });
    }
  }
  
  // Special handling for action items - we want to identify the action items section
  // by looking for keywords in the section headline
  const actionItemsSection = summary.sections.find(section => 
    section.headline.toLowerCase().includes('action') || 
    section.headline.toLowerCase().includes('next step') ||
    section.headline.toLowerCase().includes('task') ||
    section.headline.toLowerCase().includes('follow up')
  );
  
  if (actionItemsSection) {
    summary.actionItems = actionItemsSection.bulletPoints;
  } else {
    summary.actionItems = [];
  }
  
  // Special handling for key points - identify the key points/discussion section
  const keyPointsSection = summary.sections.find(section => 
    section.headline.toLowerCase().includes('discussion') || 
    section.headline.toLowerCase().includes('key point') ||
    section.headline.toLowerCase().includes('highlight') ||
    section.headline.toLowerCase().includes('main topic')
  );
  
  if (keyPointsSection) {
    summary.keyPoints = keyPointsSection.bulletPoints;
  } else {
    summary.keyPoints = [];
  }

  return summary;
}

module.exports = router;
