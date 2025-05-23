/**
 * Summary Routes
 * Routes for generating meeting summaries
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const { initializeGemini } = require('../config/gemini.config');
const crypto = require('crypto'); // For generating unique share IDs

// Store for shared summaries
const sharedSummaries = new Map();

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

ACTION ITEMS AND NEXT STEPS:
- [Action item with responsible person and timeline if mentioned]
- [Action item with responsible person and timeline if mentioned]
...

[Add more dynamic sections as appropriate based on the meeting content]

Be specific and extract information directly from the transcript. If certain information cannot be determined, note this in your response.

IMPORTANT: 
1. Make sure each bullet point starts with a dash (-) character and each section headline is followed by a colon (:). 
2. DO NOT use markdown formatting. 
3. DO NOT create multiple sections for action items - use exactly ONE section titled "ACTION ITEMS AND NEXT STEPS".
4. Maintain consistent formatting throughout.`;    const geminiResult = await geminiPro.generateContent({
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
    console.log('[POST /api/summary/generate] Raw AI response:', summaryText.substring(0, 500) + '...');
    
    // Parse the summary text into structured data
    const summary = parseSummaryResponse(summaryText);

    // Log the parsed summary structure
    console.log('[POST /api/summary/generate] Parsed summary structure:', JSON.stringify({
      title: summary.title,
      overallLength: summary.overall ? summary.overall.length : 0,
      sectionCount: summary.sections.length,
      actionItemsCount: summary.actionItems.length,
      keyPointsCount: summary.keyPoints.length
    }));

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

  try {
    // Extract title (first non-empty line after "TITLE:")
    const titleMatch = text.match(/TITLE:?\s*([^\n]+)/i);
    if (titleMatch && titleMatch[1]) {
      summary.title = titleMatch[1].trim();
    } else {
      // Fallback title extraction if the format is different
      const firstLine = text.split('\n')[0];
      if (firstLine && !firstLine.toLowerCase().includes('summary:')) {
        summary.title = firstLine.trim();
      } else {
        summary.title = "Meeting Summary";
      }
    }

    // Extract overall summary (text between "SUMMARY:" and the first dynamic section headline)
    const overallMatch = text.match(/SUMMARY:?\s*([\s\S]*?)(?=\n\s*[A-Z][^:]*:|\n\s*$)/i);
    if (overallMatch && overallMatch[1]) {
      summary.overall = overallMatch[1].trim();
    } else {
      // Try alternate pattern for overall summary
      const paragraphs = text.split('\n\n');
      for (let i = 0; i < Math.min(3, paragraphs.length); i++) {
        if (paragraphs[i] && !paragraphs[i].match(/TITLE:?/i) && !paragraphs[i].includes('-')) {
          summary.overall = paragraphs[i].trim();
          break;
        }
      }
    }
    // Extract all dynamic sections (heading followed by bullet points)
    // This regex finds all sections with a headline followed by bullet points
    const sectionRegex = /\n([A-Z][^:\n]*):?\s*\n((?:\s*[-•*]\s*[^\n]*\n?)+)/g;
    
    let match;
    let sectionsFound = false;
    while ((match = sectionRegex.exec(text)) !== null) {
      sectionsFound = true;
      const headline = match[1].trim();
      const contentText = match[2].trim();
      
      // Extract bullet points, supporting different bullet styles (-, •, *)
      const bulletPoints = contentText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.match(/^[-•*]\s/))
        .map(line => line.replace(/^[-•*]\s*/, '').trim());
      
      // Add to sections array
      if (bulletPoints.length > 0) {
        summary.sections.push({
          headline,
          bulletPoints
        });
      }
    }

    // If no sections were found with the standard regex, try a more flexible approach
    if (!sectionsFound) {
      // Split by lines that look like section headers (all caps or first letter capitalized, not starting with - or •)
      const lines = text.split('\n');
      let currentSection = null;
      let currentBullets = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;
        
        // If this looks like a section header
        if (line.match(/^[A-Z]/) && !line.startsWith('-') && !line.startsWith('•') && !line.startsWith('*') && 
            !line.toLowerCase().includes('title:') && !line.toLowerCase().includes('summary:')) {
          
          // Save previous section if it exists
          if (currentSection && currentBullets.length > 0) {
            summary.sections.push({
              headline: currentSection,
              bulletPoints: currentBullets
            });
          }
          
          // Start new section
          currentSection = line.replace(/:$/, '').trim();
          currentBullets = [];
        } 
        // If this looks like a bullet point
        else if (line.match(/^[-•*]\s/) || line.match(/^\d+\.\s/)) {
          if (currentSection) {
            currentBullets.push(line.replace(/^[-•*]\d+\.\s*/, '').trim());
          }
        }
      }
      
      // Add the last section if it exists
      if (currentSection && currentBullets.length > 0) {
        summary.sections.push({
          headline: currentSection,
          bulletPoints: currentBullets
        });
      }
    }      // Special handling for action items - identify and combine all action item sections
    // Look for all sections that contain keywords related to action items
    const actionItemSections = summary.sections.filter(section => 
      section.headline.toLowerCase().includes('action') || 
      section.headline.toLowerCase().includes('next step') ||
      section.headline.toLowerCase().includes('task') ||
      section.headline.toLowerCase().includes('follow up')
    );
    
    if (actionItemSections.length > 0) {
      // Combine all action items from all matching sections
      summary.actionItems = actionItemSections.flatMap(section => section.bulletPoints);
      
      // Remove all but the first action item section from the sections array
      // to prevent duplication in the UI
      const firstActionItemSectionIndex = summary.sections.findIndex(section => 
        section.headline.toLowerCase().includes('action') || 
        section.headline.toLowerCase().includes('next step') ||
        section.headline.toLowerCase().includes('task') ||
        section.headline.toLowerCase().includes('follow up')
      );
      
      if (firstActionItemSectionIndex !== -1) {
        // Keep only the first action item section and update it with all combined bullet points
        summary.sections[firstActionItemSectionIndex].bulletPoints = summary.actionItems;
        summary.sections[firstActionItemSectionIndex].headline = "ACTION ITEMS AND NEXT STEPS";
        
        // Remove all other action item sections
        summary.sections = summary.sections.filter((section, index) => 
          index === firstActionItemSectionIndex || 
          !(section.headline.toLowerCase().includes('action') || 
            section.headline.toLowerCase().includes('next step') ||
            section.headline.toLowerCase().includes('task') ||
            section.headline.toLowerCase().includes('follow up'))
        );
      }
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
    } else if (summary.sections.length > 0) {
      // If no specific key points section is found, use the first section that's not action items
      const firstNonActionSection = summary.sections.find(section => 
        !section.headline.toLowerCase().includes('action') && 
        !section.headline.toLowerCase().includes('next step')
      );
      if (firstNonActionSection) {
        summary.keyPoints = firstNonActionSection.bulletPoints;
      } else {
        summary.keyPoints = [];
      }
    } else {
      summary.keyPoints = [];
    }

    // Ensure we have at least some content in our summary
    if (summary.sections.length === 0 && summary.overall) {
      // If we have an overall summary but no sections, create a general section
      summary.sections.push({
        headline: "Meeting Overview",
        bulletPoints: [summary.overall]
      });
    }

    // Add empty action items section if none was found
    if (summary.actionItems.length === 0) {
      summary.actionItems = ["No specific action items were identified in the transcript."];
    }
  } catch (error) {
    console.error('[parseSummaryResponse] Error parsing summary:', error);
    // Return a basic structure if parsing fails
    summary.title = summary.title || "Meeting Summary";
    summary.overall = summary.overall || "Unable to generate a comprehensive summary from the transcript.";
    
    if (summary.sections.length === 0) {
      summary.sections = [{
        headline: "Summary",
        bulletPoints: ["The summary parsing encountered an error. Please try regenerating the summary."]
      }];
    }
    
    summary.actionItems = summary.actionItems.length ? summary.actionItems : ["No action items were identified."];
    summary.keyPoints = summary.keyPoints.length ? summary.keyPoints : ["No key points were identified."];
  }
  return summary;
}

/**
 * POST /api/summary/share
 * Creates a shareable link for a summary
 */
router.post('/share', authMiddleware, async (req, res) => {
  const { summary, meetingTitle } = req.body;
  const userId = req.user ? req.user.uid : 'unknown';

  if (!summary) {
    return res.status(400).json({ 
      success: false, 
      error: 'No summary data provided for sharing.'
    });
  }

  try {
    // Generate a unique share ID
    const shareId = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    
    // Store the summary with metadata
    sharedSummaries.set(shareId, {
      summary,
      meetingTitle,
      createdBy: userId,
      createdAt: timestamp,
      expiresAt: timestamp + (7 * 24 * 60 * 60 * 1000), // Expires after 7 days
      accessCount: 0
    });
    
    // Construct the share URL
    const shareUrl = `/api/summary/shared/${shareId}`;
    
    console.log(`[POST /api/summary/share] Created share link ${shareUrl} for user ${userId}`);
    
    return res.status(200).json({
      success: true,
      shareId,
      shareUrl,
      expiresAt: timestamp + (7 * 24 * 60 * 60 * 1000)
    });
  } catch (error) {
    console.error('[POST /api/summary/share] Error creating share link:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create share link'
    });
  }
});

/**
 * GET /api/summary/shared/:shareId
 * Gets a shared summary by ID (public access)
 */
router.get('/shared/:shareId', async (req, res) => {
  const { shareId } = req.params;
  
  if (!sharedSummaries.has(shareId)) {
    return res.status(404).json({
      success: false,
      error: 'Shared summary not found or has expired'
    });
  }
  
  const sharedData = sharedSummaries.get(shareId);
  
  // Check if the share has expired
  if (Date.now() > sharedData.expiresAt) {
    sharedSummaries.delete(shareId);
    return res.status(404).json({
      success: false,
      error: 'Shared summary has expired'
    });
  }
  
  // Increment access count
  sharedData.accessCount += 1;
  sharedSummaries.set(shareId, sharedData);
  
  // Return the shared summary - can be formatted or rendered in a template
  return res.status(200).json({
    success: true,
    data: {
      summary: sharedData.summary,
      meetingTitle: sharedData.meetingTitle,
      createdAt: new Date(sharedData.createdAt).toISOString(),
      accessCount: sharedData.accessCount
    }
  });
});

module.exports = router;
