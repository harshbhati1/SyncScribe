import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  Snackbar,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArticleIcon from '@mui/icons-material/Article';
import SummarizeIcon from '@mui/icons-material/Summarize';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import InsightsIcon from '@mui/icons-material/Insights';
import SendIcon from '@mui/icons-material/Send';
import ShareIcon from '@mui/icons-material/Share';
import apiRequest, { transcriptionAPI } from '../services/api';
import MeetingRecorder from './MeetingRecorder';

// Import the enhanced components
import EnhancedChatInput from './EnhancedChatInput';
import EnhancedNotifications from './EnhancedNotifications';
import EmptyState from './EmptyState';
import MessageBubble from './MessageBubble';

// Styled components with enhanced TwinMind theme colors
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#ffffff',
  boxShadow: '0 3px 8px rgba(11, 79, 117, 0.08)',
  borderBottom: '1px solid #e4e4e7',
  color: '#2d3748',
  transition: 'box-shadow 0.3s ease',
  // Mobile responsive toolbar
  '& .MuiToolbar-root': {
    [theme.breakpoints.down('sm')]: {
      minHeight: '56px',
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
  },
}));

const TabPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  flexGrow: 1,
  overflow: 'auto',
  backgroundColor: '#f8fafc',
  borderRadius: '0 0 8px 8px',
  // Mobile responsive padding
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },
  // Ensuring the TabPanel takes up available vertical space
  // The parent Box of Transcription.js already has display: 'flex', flexDirection: 'column', height: '100vh'
  // So, flexGrow: 1 on TabPanel should make it expand.
  
  // Add event handling for all TabPanels by default
  '&:click': (e) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('[TabPanel] Click event intercepted');
  }
}));

const RecordingDot = styled('div')(({ theme, isRecording }) => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  backgroundColor: isRecording ? '#ff7300' : '#a1a1aa',
  marginRight: theme.spacing(1),
  transition: 'all 0.2s ease-in-out',
  animation: isRecording ? 'pulse 1.5s infinite ease-in-out' : 'none',
  '@keyframes pulse': {
    '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 115, 0, 0.7)' },
    '70%': { transform: 'scale(1)', boxShadow: '0 0 0 10px rgba(255, 115, 0, 0)' },
    '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 115, 0, 0)' },
  },
}));

const EditableTitle = styled(Typography)(({ theme }) => ({
  cursor: 'pointer',
  padding: theme.spacing(0.5, 1.5),
  borderRadius: theme.spacing(1),
  color: '#0b4f75',
  fontWeight: 600,
  transition: 'all 0.2s ease',
  // Mobile responsive typography
  [theme.breakpoints.down('sm')]: {
    fontSize: '1rem',
    padding: theme.spacing(0.25, 1),
  },
  '&:hover': {
    backgroundColor: 'rgba(11, 79, 117, 0.08)',
    transform: 'translateY(-1px)',
    boxShadow: '0 2px 4px rgba(11, 79, 117, 0.05)',
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: '24px',
  padding: theme.spacing(1, 3),
  textTransform: 'none',
  fontWeight: 600,
  backgroundColor: '#ff7300',
  color: '#ffffff',
  boxShadow: '0 2px 6px rgba(255, 115, 0, 0.25)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: '#fc9e4f',
    boxShadow: '0 4px 12px rgba(255, 115, 0, 0.3)',
    transform: 'translateY(-2px)',
  },
  '&:active': {
    transform: 'translateY(0)',
    boxShadow: '0 1px 3px rgba(255, 115, 0, 0.3)',
  },
  '&.Mui-disabled': {
    backgroundColor: 'rgba(255, 115, 0, 0.3)',
    color: '#ffffff'
  }
}));

const Transcription = () => {  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { meetingId } = useParams();
  const theme = useTheme(); // Add theme hook for mobile responsive styling
  // --- State Variables ---
  const [isActiveRecordingSession, _setIsActiveRecordingSession] = useState(false);
  const setIsActiveRecordingSession = (val) => {
    console.log('[DEBUG setIsActiveRecordingSession] Setting isActiveRecordingSession to:', val, new Error().stack);
    _setIsActiveRecordingSession(val);
  };
  const [isRecordingLocal, setIsRecordingLocal] = useState(false); // For local MediaRecorder controls if used
  const [rawTranscript, setRawTranscript] = useState(''); // For immediate, complete transcript for logic
  const rawTranscriptRef = useRef(''); // <-- Add this line
  const [animatedDisplayedTranscript, setAnimatedDisplayedTranscript] = useState(''); // Renamed but now just holds the transcript directly
  const [transcriptionSegments, setTranscriptionSegments] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false); // General processing for save/summary
  const [isExistingMeeting, setIsExistingMeeting] = useState(false); // Track if this is a previously saved meeting
  const [error, setError] = useState('');
  const [meetingTitle, setMeetingTitle] = useState(() => localStorage.getItem('currentMeetingTitle') || 'New Meeting');
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [summary, setSummary] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [audioLevelsLocal, setAudioLevelsLocal] = useState(Array(9).fill({ level: 3, isSilent: true })); // For local recorder viz
  const [isAiResponding, setIsAiResponding] = useState(false); // For chat AI response streaming
  const [hasAutoSwitchedToChat, setHasAutoSwitchedToChat] = useState(false); // Track if we've already auto-switched to chat
  const currentAiMessageIdRef = useRef(null); // To manage the ID of the AI message being built during streaming
  const [isStopping, setIsStopping] = useState(false); // Track if stop/finalization is in progress

  // --- Refs ---
  const mediaRecorderRefLocal = useRef(null);
  const audioChunksRefLocal = useRef([]);
  const recordingIntervalRefLocal = useRef(null);
  const recordingTimeRefLocal = useRef(0);
  const [recordingTimeLocal, setRecordingTimeLocal] = useState(0);
  const chatEndRef = useRef(null); // For scrolling chat to bottom  // Handle tab change
  const handleTabChange = (event, newValue) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.currentTarget !== 'undefined') {
        console.log(`[Transcription] Tab change initiated by: ${event.currentTarget.tagName || 'unknown'}`);
      }
    }
    // Only append the last chat message if there are unsaved chat messages
    if (chatMessages.length > 0) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage && !lastMessage.savedToServer) {
        console.log('[Transcription] Appending last chat message before tab change');
        appendChatMessage(lastMessage);
      }
    }
    setTabValue(newValue);
    console.log(`[Transcription] Tab set to ${newValue}`);
  };
  
  // Handle snackbar close
  const handleSnackbarClose = () => setSnackbarOpen(false);

  // Format seconds into MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Scroll chat to bottom when new messages come in
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);
  // Meeting title logic based on meetingId
  useEffect(() => {
    if (meetingId) {
      const storedMeetingId = localStorage.getItem('currentMeetingId');
      const storedMeetingTitle = localStorage.getItem('currentMeetingTitle');
      const titleManuallySet = localStorage.getItem('titleManuallySet');
      // Use stored title if available and manually set
      if (storedMeetingId === meetingId && storedMeetingTitle && titleManuallySet) {
        setMeetingTitle(storedMeetingTitle);
      } else if (storedMeetingId === meetingId && storedMeetingTitle) {
        setMeetingTitle(storedMeetingTitle);
      } else {
        setMeetingTitle(`Meeting ${meetingId}`);
      }
    } else {
      // For a new meeting, always use manually set title if present
      const storedTitle = localStorage.getItem('currentMeetingTitle');
      const titleManuallySet = localStorage.getItem('titleManuallySet');
      setMeetingTitle((titleManuallySet && storedTitle) ? storedTitle : 'New Meeting');
    }
  }, [meetingId]);
  // Title editing handlers
  const handleTitleClick = () => { 
    if (isExistingMeeting) return; // Don't allow editing title for existing meetings
    setNewTitle(meetingTitle); 
    setEditingTitle(true); 
  };
  const handleTitleChangeInput = (e) => setNewTitle(e.target.value);
  const handleTitleSave = async () => {
    if (newTitle.trim()) {
      const trimmedTitle = newTitle.trim();
      setMeetingTitle(trimmedTitle);
      localStorage.setItem('currentMeetingTitle', trimmedTitle);
      localStorage.setItem('titleManuallySet', 'true'); // Mark title as manually set
      
      // Save title to backend if meetingId exists
      if (meetingId) {
        try {
          await transcriptionAPI.updateMeetingTitle(meetingId, trimmedTitle);
          console.log('Meeting title updated successfully:', trimmedTitle);
        } catch (err) {
          console.error('Error updating meeting title:', err);
          // Continue anyway, as the title is already updated in local state
        }
      }
    }
    setEditingTitle(false);
  };  // Simplified transcript update logic (no animation)
  const processTranscriptUpdate = useCallback((text) => {
    if (text && typeof text === 'string') {
      setAnimatedDisplayedTranscript(text);
    }
  }, []);
  
  // --- Data Handling Functions ---  // Define saveTranscription first without autoSaveTranscription dependency
  const saveTranscription = useCallback(async (isSilent = false) => {
    if (isStopping) {
      console.log('[Transcription] Save SKIPPED: isStopping is true');
      return;
    }
    const stableMeetingId = meetingId || localStorage.getItem('currentMeetingId');
    if (!stableMeetingId) {
      console.error('[Transcription] CRITICAL: Attempted to save with null/undefined meetingId! Save aborted.');
      throw new Error('CRITICAL: Attempted to save with null/undefined meetingId!');
    }
    try {
      setIsProcessing(true);
      
      // Create meeting data object
      const meetingData = {
        id: stableMeetingId,
        title: meetingTitle,
        transcript: rawTranscriptRef.current, // <-- Use the ref here
        segments: transcriptionSegments,
        chatHistory: chatMessages,
        summary: summary,
        date: new Date().toISOString(),
        createdAt: meetingId ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Log what we're saving for debugging purposes
      console.log(`[Transcription] Saving meeting data: ${meetingData.id}`);
      console.log(`[Transcription] - Transcript length: ${rawTranscriptRef.current?.length || 0} characters`);
      console.log(`[Transcription] - Chat messages: ${chatMessages?.length || 0}`);
      console.log(`[Transcription] - Has summary: ${summary ? 'Yes' : 'No'}`);
      console.log(`[Transcription] - Title: ${meetingTitle}`);
      
      // Ensure chat messages have all required fields for display
      const sanitizedChatMessages = chatMessages.map(msg => ({
        id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        text: msg.text || '',
        sender: msg.sender || 'user',
        isStreaming: false,
        timestamp: msg.timestamp || new Date().toISOString()
      }));
      
      // Update the meeting data object with sanitized chat messages
      const finalMeetingData = {
        ...meetingData,
        chatHistory: sanitizedChatMessages
      };
      
      // Save meeting data to Firestore through API
      console.log('[Transcription] About to save final meeting data:', finalMeetingData);
      const response = await transcriptionAPI.saveMeeting(finalMeetingData);
      
      if (response && response.data && response.data.meetingId) {
        const savedMeetingId = response.data.meetingId;
        localStorage.setItem('currentMeetingId', savedMeetingId);
        localStorage.setItem('currentMeetingTitle', meetingTitle);
        
        // Navigate if it was a new meeting
        if (!meetingId) {
          navigate(`/transcription/${savedMeetingId}`);
        }
      } else {
        setError('Failed to save meeting. Unexpected API response.');
        setSnackbarMessage('Failed to save meeting');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('Error saving meeting:', err);
      setError('Failed to save meeting. Please try again.');
      setSnackbarMessage('Failed to save meeting');
      setSnackbarOpen(true);    
    } finally {
      setIsProcessing(false);
    }
  }, [meetingId, meetingTitle, rawTranscript, transcriptionSegments, chatMessages, summary, navigate, setIsProcessing, setSnackbarMessage, setSnackbarOpen, setError, isStopping]);
  
  // Auto-save functionality - defined after saveTranscription is fully defined
  const autoSaveTranscription = useCallback(() => {
    if (isStopping) {
      console.log('[Transcription] Auto-save SKIPPED: isStopping is true');
      return;
    }
    // Skip auto-save if we just shared a summary to avoid duplicate notifications
    if (window.justSharedSummary) {
      console.log('[Transcription] Skipping auto-save because summary was just shared');
      return;
    }
    
    if ((rawTranscript && rawTranscript.length > 50) || chatMessages.length > 0 || summary) {
      console.log('[Transcription] Auto-saving transcription, chat history, and summary data');
      console.log(`[Transcription] Data stats: ${rawTranscript?.length || 0} chars transcript, ${chatMessages.length} chat messages, summary: ${summary ? 'yes' : 'no'}`);
      
      // Set a slight delay to allow any pending state updates to complete
      setTimeout(() => {
        // Call saveTranscription with isSilent flag
        saveTranscription(true);
      }, 100);
    }
  }, [rawTranscript, chatMessages.length, summary, saveTranscription, isStopping]);
  
  // Generate summary function
  const generateSummary = useCallback(async () => {
    console.log('[Transcription] generateSummary called with:', {
      hasTranscript: Boolean(rawTranscriptRef.current),
      transcriptLength: rawTranscriptRef.current?.length || 0,
      meetingId,
      isExistingMeeting
    });

    if (isExistingMeeting) {
      console.log("[Transcription] Cannot generate summary for existing meetings");
      setError("Summary generation is not available for saved meetings.");
      return;
    }

    if (!rawTranscriptRef.current) {
      setError("No transcript available to summarize.");
      return;
    }
    
    if (isProcessing) {
      console.log("[Transcription] Already processing, won't generate a new summary");
      return;
    }
    
    if (summary) {
      console.log("[Transcription] Summary already exists, switching to summary tab");
      setTabValue(2);
      return;
    }

    try {
      setIsProcessing(true);
      console.log("[Transcription] Starting summary generation...");
      
      const response = await transcriptionAPI.generateSummary(rawTranscriptRef.current, meetingId);
      console.log('[Transcription] Summary generation response:', {
        success: Boolean(response?.data?.summary),
        hasTitle: Boolean(response?.data?.summary?.title),
        hasOverall: Boolean(response?.data?.summary?.overall),
        hasSections: Boolean(response?.data?.summary?.sections?.length)
      });
          
      if (response && response.data && response.data.summary) {
        setSummary(response.data.summary);
        setTabValue(2);
        console.log("[Transcription] Summary generated and state updated");
        
        // Update title from summary if needed
        if (response.data.summary.title && 
            meetingTitle === 'New Meeting') {
          const newTitleFromSummary = response.data.summary.title;
          setMeetingTitle(newTitleFromSummary);
          localStorage.setItem('currentMeetingTitle', newTitleFromSummary);
          if (meetingId) {
            try {
              await transcriptionAPI.updateMeetingTitle(meetingId, newTitleFromSummary);
              console.log(`[Transcription] Meeting title updated from summary: ${newTitleFromSummary}`);
            } catch (titleUpdateError) {
              console.error('[Transcription] Error updating meeting title from summary:', titleUpdateError);
            }
          }
        }
        
        // Auto-save after summary generation
        console.log('[Transcription] Auto-saving after summary generation');
        await saveTranscription(true);
      } else {
        console.error("[Transcription] Summary generation failed:", response?.data?.error || 'No summary in response');
        setError(response?.data?.error || 'Failed to get summary content from API.');
        setSnackbarMessage("Failed to generate summary. Please try again.");
        setSnackbarOpen(true);
      }
    } catch (err) {        
      console.error('[Transcription] Error generating summary:', err);
      setError('API call to generate summary failed.');
      setSnackbarMessage("Failed to generate summary. Please try again.");
      setSnackbarOpen(true);
    } finally {
      setIsProcessing(false);
    }  
  }, [rawTranscript, meetingId, meetingTitle, summary, setError, setSummary, setTabValue, setIsProcessing, setSnackbarMessage, setSnackbarOpen, saveTranscription]);
  
  // Function to share summary as a link
  const shareSummaryAsLink = useCallback(() => {
    if (!summary) {
      setError("No summary available to share.");
      setSnackbarMessage("No summary available to share.");
      setSnackbarOpen(true);
      return;
    }

    try {
      // Show loading state
      setIsProcessing(true);
      
      // Call the API to create a shareable link
      transcriptionAPI.shareSummary(summary, meetingTitle)
        .then(response => {          if (response.data && response.data.shareUrl) {
            // Create a full URL that can be shared
            const baseUrl = window.location.origin;
            const fullShareUrl = `${baseUrl}/summary/shared/${response.data.shareId}`;
            
            // Copy the URL to clipboard
            navigator.clipboard.writeText(fullShareUrl)
              .then(() => {
                // Create a cleaner message with just the URL
                setSnackbarMessage(`Link copied: ${fullShareUrl} - Share this link with others!`);
                setSnackbarOpen(true);
                console.log(`Summary shared successfully: ${fullShareUrl}`);
                
                // Set a flag to prevent auto-save from running right after sharing
                window.justSharedSummary = true;
                setTimeout(() => { window.justSharedSummary = false; }, 5000);
              }).catch(err => {
                console.error('Failed to copy URL to clipboard:', err);
                // Display the link directly in the message so users can still see it
                setSnackbarMessage(`Link created: ${fullShareUrl} - Copy this link manually to share`);
                setSnackbarOpen(true);
              });
          } else {
            throw new Error('Invalid response from server');
          }
        })
        .catch(error => {
          console.error('Error sharing summary:', error);
          setError(`Failed to share summary: ${error.message}`);
          setSnackbarMessage("Failed to create shareable link. Please try again.");
          setSnackbarOpen(true);
        })
        .finally(() => {
          setIsProcessing(false);
        });
    } catch (error) {
      console.error('Error sharing summary:', error);
      setError(`Failed to share summary: ${error.message}`);
      setSnackbarMessage("Failed to create shareable link. Please try again.");
      setSnackbarOpen(true);
      setIsProcessing(false);
    }
    }, [summary, meetingTitle, setError, setSnackbarMessage, setSnackbarOpen, setIsProcessing]);
  
  // Place handleRecordingStop here
  const handleRecordingStop = useCallback(async () => {
    if (!isActiveRecordingSession) return;
    setIsStopping(true);
    setIsProcessing(true);
    try {
      console.log('[Transcription] handleRecordingStop: START');
      // 1. Finalize transcript if needed (assume transcript is already up to date)
      // 2. Generate summary if not already present (await only once)
      let finalSummary = summary;
      if (!summary && rawTranscript && rawTranscript.length > 50) {
        const response = await transcriptionAPI.generateSummary(rawTranscript, meetingId || localStorage.getItem('currentMeetingId'));
        if (response && response.data && response.data.summary) {
          finalSummary = response.data.summary;
          setSummary(finalSummary);
          console.log('[Transcription] handleRecordingStop: Summary generated:', finalSummary);
        } else {
          console.log('[Transcription] handleRecordingStop: No summary returned from API. Response:', response);
        }
      } else {
        console.log('[Transcription] handleRecordingStop: Using existing summary:', finalSummary);
      }
      // 3. Determine the final meeting title
      let finalTitle = meetingTitle;
      if (
        finalSummary &&
        finalSummary.title &&
        finalTitle === 'New Meeting'
      ) {
        finalTitle = finalSummary.title;
        setMeetingTitle(finalTitle);
        localStorage.setItem('currentMeetingTitle', finalTitle);
        console.log('[Transcription] handleRecordingStop: Title updated to:', finalTitle);
        if (meetingId || localStorage.getItem('currentMeetingId')) {
          try {
            await transcriptionAPI.updateMeetingTitle(meetingId || localStorage.getItem('currentMeetingId'), finalTitle);
            console.log('[Transcription] handleRecordingStop: Title updated in backend:', finalTitle);
          } catch (err) {
            console.error('[Transcription] handleRecordingStop: Error updating meeting title:', err);
          }
        }
      } else {
        console.log('[Transcription] handleRecordingStop: Using existing title:', finalTitle);
      }
      // 4. Prepare a single, comprehensive meeting data object
      const stableMeetingId = meetingId || localStorage.getItem('currentMeetingId');
      console.log('[Transcription] handleRecordingStop: stableMeetingId:', stableMeetingId);
      if (!stableMeetingId) {
        console.error('CRITICAL: Original meetingId is null in handleRecordingStop!');
        throw new Error('CRITICAL: Original meetingId is null in handleRecordingStop!');
      }
      const completeMeetingData = {
        id: stableMeetingId,
        title: finalTitle,
        transcript: rawTranscript,
        segments: transcriptionSegments,
        chatHistory: chatMessages,
        summary: finalSummary,
        isActiveRecording: false,
        date: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      console.log('[Transcription] handleRecordingStop: About to save final meeting data:', completeMeetingData);
      // 5. Perform ONE call to saveMeeting (POST) with this data and the original meetingId
      await transcriptionAPI.saveMeeting(completeMeetingData);
      
      // 6. Only after the save, set isActiveRecordingSession to false and isExistingMeeting to true
      console.log('[DEBUG setIsActiveFalse] Called from handleRecordingStop (final save)');
      setIsActiveRecordingSession(false);
      setIsExistingMeeting(true);
      setTabValue(2);
      // Update localStorage flags
      localStorage.setItem('hasCompletedFirstSave', 'true');
      localStorage.setItem('currentMeetingId', stableMeetingId);
      localStorage.setItem('currentMeetingTitle', finalTitle);
      console.log('[Transcription] handleRecordingStop: END - Save successful');
    } catch (err) {
      setError('Failed to finalize and save meeting.');
      setSnackbarMessage('Failed to save meeting');
      setSnackbarOpen(true);
      console.error('[Transcription] handleRecordingStop: ERROR', err, err?.stack);
    } finally {
      setIsProcessing(false);
      setIsStopping(false);
    }
  }, [isActiveRecordingSession, summary, rawTranscript, meetingId, meetingTitle, transcriptionSegments, chatMessages, setSnackbarMessage, setSnackbarOpen, setIsActiveRecordingSession, setIsExistingMeeting, setIsProcessing, setError, setTabValue]);

  // Then define handleMeetingRecorderUpdate after handleRecordingStop
  const handleMeetingRecorderUpdate = useCallback((textChunk, metadata) => {
    if (isStopping) return; // Prevent any update logic during stop
    
    console.log('[Transcription] handleMeetingRecorderUpdate called with:', {
      textChunk: textChunk?.substring(0, 50) + '...',
      metadata,
      isActiveRecordingSession,
      currentMeetingId: meetingId || localStorage.getItem('currentMeetingId')
    });
    
    let chunkToProcess = textChunk;
    if (metadata && metadata.error) {
      chunkToProcess = `[Error: ${textChunk || (metadata.errorDetail || 'Transcription failed')}]`;
      setError(chunkToProcess);
    } else {
      setError('');
    }

    if (metadata && metadata.type === 'recording_stopped' && metadata.shouldSave) {
      console.log('[Transcription] Recording stopped, preparing to save...');
      if (chunkToProcess) {
        setRawTranscript(prevRaw => {
          let newRaw = prevRaw;
          // Smart spacing for raw transcript
          if (prevRaw && !prevRaw.endsWith(' ') && chunkToProcess && !chunkToProcess.startsWith(' ')) {
            newRaw += " " + chunkToProcess;
          } else if (prevRaw && prevRaw.endsWith(' ') && chunkToProcess && chunkToProcess.startsWith(' ')) {
            newRaw += chunkToProcess.substring(1);
          } else if (!prevRaw && chunkToProcess && chunkToProcess.startsWith(' ')) {
            newRaw += chunkToProcess.substring(1);
          } else {
            newRaw += chunkToProcess;
          }
          rawTranscriptRef.current = newRaw;
          setAnimatedDisplayedTranscript(newRaw);
          // Call handleRecordingStop after transcript is updated
          setTimeout(() => {
            handleRecordingStop();
          }, 0);
          return newRaw;
        });
      } else {
        handleRecordingStop();
      }
      return;
    }

    if (chunkToProcess || (metadata && metadata.type === 'segment_final_empty')) {
      if (chunkToProcess) {
        setRawTranscript(prevRaw => {
          let newRaw = prevRaw;
          // Smart spacing for raw transcript
          if (prevRaw && !prevRaw.endsWith(' ') && chunkToProcess && !chunkToProcess.startsWith(' ')) {
            newRaw += " " + chunkToProcess;
          } else if (prevRaw && prevRaw.endsWith(' ') && chunkToProcess && chunkToProcess.startsWith(' ')) {
            newRaw += chunkToProcess.substring(1);
          } else if (!prevRaw && chunkToProcess && chunkToProcess.startsWith(' ')) {
            newRaw += chunkToProcess.substring(1);
          } else {
            newRaw += chunkToProcess;
          }
          
          console.log('[Transcription] Updated raw transcript:', {
            length: newRaw.length,
            preview: newRaw.substring(0, 50) + '...',
            meetingId: meetingId || localStorage.getItem('currentMeetingId')
          });
          rawTranscriptRef.current = newRaw; // <-- Update the ref here
          setAnimatedDisplayedTranscript(newRaw);
          return newRaw;
        });
      }
    }
    
    if (metadata) {
      setTranscriptionSegments(prev => {
        const newSegments = [...prev, { ...metadata, text: chunkToProcess || "" }];
        console.log('[Transcription] Updated segments:', {
          count: newSegments.length,
          latestSegment: newSegments[newSegments.length - 1]
        });
        return newSegments;
      });
    }

    if (metadata && metadata.type === 'recording_started') {
      setIsActiveRecordingSession(true);
      if (!meetingId) {
        const sessionId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        localStorage.setItem('currentMeetingId', sessionId);
        console.log(`[Transcription] New session started. ID: ${sessionId}`);
        navigate(`/transcription/${sessionId}`);
      }
    }
  }, [rawTranscript, isProcessing, generateSummary, autoSaveTranscription, summary, setSnackbarMessage, setSnackbarOpen, isStopping, handleRecordingStop, isActiveRecordingSession, meetingId, navigate]);

  // --- Local MediaRecorder Logic (If you intend to use it alongside MeetingRecorder) ---
  // Ensure this logic is distinct or integrated if MeetingRecorder is the primary.
  const requestMicrophonePermissionLocal = async () => { /* ... your original implementation ... */ return null;};
  const startRecordingLocal = async () => { /* ... your original implementation ... */ };
  const processAudioChunkLocal = async () => {
    if (audioChunksRefLocal.current.length === 0) return;
    try {
      const audioBlob = new Blob(audioChunksRefLocal.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1];
        // Assuming transcriptionAPI.processAudio expects base64 and meetingId
        const response = await transcriptionAPI.processAudio(base64Audio, meetingId || "local_meeting_id_fallback");
        if (response && response.data && response.data.segment) {
          const segmentData = response.data.segment;
          // Feed into the main transcript update system
          handleMeetingRecorderUpdate(segmentData.text, {
            id: segmentData.id || `local_seg_${Date.now()}`,
            isFinal: segmentData.isFinal !== undefined ? segmentData.isFinal : true, // Or determine based on context
            timestamp: segmentData.timestamp || new Date().toISOString(),
            type: 'segment' // Or a custom type like 'local_segment'
          });
        }
        audioChunksRefLocal.current = []; // Clear chunks after processing
      };
    } catch (err) { console.error('Error processing local audio chunk:', err); }
  };
  const stopRecordingLocal = async () => { /* ... your original implementation ... */ await processAudioChunkLocal(); };
  // Cleanup for local recording interval
  useEffect(() => {
    const intervalTimer = recordingIntervalRefLocal.current;
    const mediaRecorder = mediaRecorderRefLocal.current;

    return () => {
      if (intervalTimer) clearInterval(intervalTimer);
      if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array for mount/unmount cleanup

  // Define appendChatMessage before handleChatSubmit
  const appendChatMessage = async (message) => {
    if (!meetingId && !localStorage.getItem('currentMeetingId')) return;
    const id = meetingId || localStorage.getItem('currentMeetingId');
    try {
      await transcriptionAPI.appendChatMessage(id, message);
      console.log('[Transcription] Appended chat message to Firestore for meeting', id);
    } catch (err) {
      console.error('Failed to append chat message:', err);
      setError('Failed to save chat message.');
    }
  };

  // --- CHAT SUBMIT HANDLER ---
  const handleChatSubmit = async (e) => {
    e?.preventDefault();
    if (!chatQuery.trim() || isAiResponding) return;
    const currentTextQuery = chatQuery.trim();
    const historyToSend = chatMessages.map(msg => ({ sender: msg.sender, text: msg.text }));
    setChatMessages(prevMessages => [...prevMessages, { id: `user-${Date.now()}`, text: currentTextQuery, sender: 'user', timestamp: new Date().toISOString() }]);
    setChatQuery('');
    setIsAiResponding(true);
    // Save user message
    const userMessage = { id: `user-${Date.now()}`, text: currentTextQuery, sender: 'user', timestamp: new Date().toISOString() };
    appendChatMessage(userMessage);
    const generatedAiId = `ai-${Date.now()}`;
    currentAiMessageIdRef.current = generatedAiId;
    setChatMessages(prevMessages => [...prevMessages, { id: generatedAiId, text: "", sender: 'ai', isStreaming: true }]);
    if (tabValue !== 1) setTabValue(1);
    try {
      let aiResponseText = "";
      await transcriptionAPI.chatWithTranscript(
        rawTranscriptRef.current,
        historyToSend,
        currentTextQuery,
        {
          onChunk: (textChunk) => {
            aiResponseText += textChunk;
            setChatMessages(prevMessages => prevMessages.map(msg => msg.id === currentAiMessageIdRef.current ? { ...msg, text: (msg.text || "") + textChunk } : msg));
          },
          onEnd: () => {
            setIsAiResponding(false);
            if (currentAiMessageIdRef.current) {
              setChatMessages(prevMessages => prevMessages.map(msg => msg.id === currentAiMessageIdRef.current ? { ...msg, isStreaming: false, text: aiResponseText } : msg));
              // Save AI message after stream ends
              const aiMessageToSave = { id: currentAiMessageIdRef.current, text: aiResponseText, sender: 'ai', timestamp: new Date().toISOString() };
              appendChatMessage(aiMessageToSave);
              currentAiMessageIdRef.current = null;
            }
            aiResponseText = "";
          },
          onError: (error) => {
            setIsAiResponding(false);
            currentAiMessageIdRef.current = null;
          }
        }
      );
    } catch (apiSetupError) {
      setIsAiResponding(false);
      currentAiMessageIdRef.current = null;
    }
  };

  // Auto-save when transcript changes significantly, chat messages are added, or user is inactive
  // Auto-save when user navigates away 
  useEffect(() => {    const handleBeforeUnload = () => {
      if (rawTranscript && rawTranscript.length > 50) {
        // We can't await this in a beforeunload event,
        // but we can synchronously trigger the save process
        saveTranscription(true);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [rawTranscript, saveTranscription]);  // Load existing meeting data
  useEffect(() => {
    console.log(`[Transcription] loadMeetingData effect triggered, meetingId: ${meetingId || 'new'}, tabValue: ${tabValue}`);
    
    const loadMeetingData = async () => {
      if (meetingId) {
        console.log(`[Transcription] Loading data for meeting: ${meetingId}`);
        setIsProcessing(true);
        setError('');
        setHasAutoSwitchedToChat(false);
        try {
          const response = await transcriptionAPI.getMeeting(meetingId);
          console.log('[Transcription] API Response:', response);
          if (response && response.data && response.data.success) {
            const meetingData = response.data.data;
            // 2. Fix meeting title logic
            const title = meetingData.title || 'New Meeting';
            setMeetingTitle(title);
            localStorage.setItem('currentMeetingTitle', title);
            if (title !== 'New Meeting' && !title.startsWith('Meeting ')) {
              localStorage.setItem('titleManuallySet', 'true');
            } else {
              localStorage.removeItem('titleManuallySet');
            }
            setRawTranscript(meetingData.transcript || "");
            rawTranscriptRef.current = meetingData.transcript || "";
            setAnimatedDisplayedTranscript(meetingData.transcript || "");
            setTranscriptionSegments(meetingData.segments || []);
            setChatMessages(meetingData.chatHistory || []); 
            setSummary(meetingData.summary || null);
            localStorage.setItem('currentMeetingId', meetingId);
          } else {
            // Only show error if this is not a new meeting (i.e., if user navigated to a non-existent meeting)
            if (response && response.status !== 404) {
              setError(response?.data?.error || `Failed to load meeting (Status: ${response.status})`);
            }
            // Preserve manually set title if present
            const storedTitle = localStorage.getItem('currentMeetingTitle');
            const titleManuallySet = localStorage.getItem('titleManuallySet');
            if (titleManuallySet && storedTitle) {
              setMeetingTitle(storedTitle);
            } else {
              setMeetingTitle('New Meeting');
            }
            setRawTranscript('');
            rawTranscriptRef.current = '';
            setAnimatedDisplayedTranscript('');
            setChatMessages([]);
            setSummary(null);
          }
        } catch (err) {
          console.error('[Transcription] Error loading meeting data:', err);
          setError('Failed to load meeting data. Please try again.');
          setMeetingTitle('New Meeting');
          setRawTranscript('');
          rawTranscriptRef.current = '';
          setAnimatedDisplayedTranscript('');
          setChatMessages([]);
          setSummary(null);
        } finally {
          setIsProcessing(false);
        }
      } else {
        console.log('[Transcription] No meetingId, initializing new meeting');
        setRawTranscript('');
        rawTranscriptRef.current = '';
        setAnimatedDisplayedTranscript('');
        setTranscriptionSegments([]);
        setChatMessages([]);
        setSummary(null);
        // Only set to 'New Meeting' if no manually set title; never clear manual title here
        const storedTitle = localStorage.getItem('currentMeetingTitle');
        const titleManuallySet = localStorage.getItem('titleManuallySet');
        if (titleManuallySet && storedTitle) {
          setMeetingTitle(storedTitle);
        } else {
          setMeetingTitle('New Meeting');
        }
      }
    };
    loadMeetingData();
  }, [meetingId]);
  // This behavior has been removed per requirement
  useEffect(() => {
    if (isStopping) return;
    // If we have a transcript, we update the hasAutoSwitchedToChat state
    // but no longer automatically switch tabs
    if (
      rawTranscript && 
      rawTranscript.length > 50 && 
      !hasAutoSwitchedToChat
    ) {
      console.log("[Transcription] Transcript available, but not auto-switching to chat tab (feature disabled)");
      setHasAutoSwitchedToChat(true); // Still mark that transcript is available
    }
  }, [rawTranscript, hasAutoSwitchedToChat, isStopping]);
  // Format text by preserving and converting markdown symbols to styling  
  const cleanMarkdownFormatting = (text) => {
    if (!text) return '';
    
    // Convert markdown to styled text
    return text
      // Handle bold formatting (**text**)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
      // Handle italic formatting (*text*)
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Handle numbered lists - with mobile-friendly formatting
      .replace(/^\s*(\d+)\.\s+(.+)$/gm, '<div class="list-item"><span class="list-number">$1.</span><span class="list-content">$2</span></div>')
      // Handle bullet points with proper list items - with mobile-friendly formatting
      .replace(/^\s*[*•-]\s+(.+)$/gm, '<div class="list-item"><span class="list-bullet">•</span><span class="list-content">$1</span></div>')
      // Preserve paragraph breaks
      .replace(/\n\s*\n/g, '<br/><br/>')
      // Format headings
      .replace(/^#\s+(.+)$/gm, '<span style="font-size: 1.2em; font-weight: 600; margin: 0.8em 0 0.4em 0; display: block;">$1</span>')
      .replace(/^##\s+(.+)$/gm, '<span style="font-size: 1.1em; font-weight: 600; margin: 0.7em 0 0.3em 0; display: block;">$1</span>')
      .replace(/^###\s+(.+)$/gm, '<span style="font-size: 1.05em; font-weight: 600; margin: 0.6em 0 0.3em 0; display: block;">$1</span>')
      // Format code blocks
      .replace(/`{3}([\s\S]*?)`{3}/g, '<pre style="background-color: #f5f5f5; padding: 0.5em; border-radius: 4px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; word-break: break-word;">$1</pre>')
      // Format inline code
      .replace(/`(.*?)`/g, '<code style="background-color: #f5f5f5; padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace;">$1</code>')
      // Handle underscores for emphasis
      .replace(/_{2}(.*?)_{2}/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Convert line breaks (but not inside code blocks)
      .replace(/(?<!<pre[^>]*>)(?<!<code[^>]*>)\n(?![^<]*<\/pre>)(?![^<]*<\/code>)/g, '<br/>');
  };  
  return (
    <Box sx={{ 
      flexGrow: 1, 
      height: { xs: '100dvh', sm: '100vh' }, // Use dvh for mobile to account for dynamic viewport
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
      backgroundAttachment: 'fixed',
      color: '#334155',
      // Ensure proper overflow handling on mobile
      overflow: 'hidden'
    }}
    onClick={(e) => {
      // This is the root component, trap any stray clicks
      // Log only when we're on the summary tab to avoid noise
      if (tabValue === 2) {
        console.log('[Transcription] Root container click', e.target);
      }
    }}
    >
      <StyledAppBar position="static">
        <Toolbar>          <IconButton 
            edge="start" 
            sx={{ 
              mr: { xs: 0.5, sm: 1 }, // Reduced margin on mobile
              color: '#0b4f75',
              borderRadius: '12px',
              transition: 'all 0.2s ease',
              // Mobile responsive sizing
              padding: { xs: '6px', sm: '8px' },
              '&:hover': {
                backgroundColor: 'rgba(11, 79, 117, 0.08)',
                transform: 'translateY(-1px)'
              },
              '&:active': {
                transform: 'translateY(0px)'
              }
            }} 
            onClick={() => navigate('/dashboard')}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>            {editingTitle ? (
              <TextField
                value={newTitle}
                onChange={handleTitleChangeInput}
                variant="outlined"
                size="small"
                autoFocus
                onBlur={handleTitleSave}
                onKeyPress={(e) => e.key === 'Enter' && handleTitleSave()}
                sx={{ 
                  mr: 1, 
                  flexGrow: 1, 
                  maxWidth: { xs: '60%', sm: '50%' }, // More space on mobile
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    fontSize: { xs: '0.9rem', sm: '1rem' }, // Smaller font on mobile
                    '& fieldset': {
                      borderColor: '#e4e4e7',
                    },
                    '&:hover fieldset': {
                      borderColor: '#0b4f75',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#0b4f75',
                    }
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" onClick={handleTitleSave} size="small" sx={{ color: '#0b4f75' }}>
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            ) : (<EditableTitle 
                variant="h6" 
                component="div" 
                noWrap 
                onClick={isExistingMeeting ? null : handleTitleClick} 
                sx={{ 
                  flexGrow: 1, 
                  cursor: isExistingMeeting ? 'default' : 'pointer',
                  '&:hover': {
                    backgroundColor: isExistingMeeting ? 'transparent' : 'rgba(11, 79, 117, 0.08)',
                    transform: isExistingMeeting ? 'none' : 'translateY(-1px)',
                  }
                }}
              >
                {meetingTitle}
                {isExistingMeeting && (
                  <Typography 
                    variant="caption" 
                    component="span" 
                    sx={{ 
                      ml: 1, 
                      color: '#64748b', 
                      backgroundColor: 'rgba(11, 79, 117, 0.08)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.7rem'
                    }}
                  >
                    Saved Meeting
                  </Typography>
                )}
              </EditableTitle>
            )}            {isRecordingLocal && (
              <Box sx={{ display: 'flex', alignItems: 'center', ml: { xs: 1, sm: 2 } }}>
                <RecordingDot isRecording={isRecordingLocal} />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    mr: 1, 
                    color: '#ff7300', 
                    fontWeight: 500,
                    fontSize: { xs: '0.7rem', sm: '0.75rem' } // Smaller on mobile
                  }}
                >
                  Rec: {formatTime(recordingTimeLocal)}
                </Typography>
              </Box>
            )}
          </Box>
        </Toolbar>        <Tabs 
          value={tabValue} 
          onChange={(event, newValue) => {
            console.log(`[Transcription] Tabs onChange triggered for tab ${newValue}`);
            event.stopPropagation();
            handleTabChange(event, newValue);
          }} 
          onClick={(e) => {
            // Prevent click events from bubbling up from the tabs container
            e.stopPropagation();
          }}
          variant="fullWidth" 
          sx={{
            '& .MuiTab-root': {
              color: '#64748b',
              minHeight: { xs: '40px', sm: '48px' }, // Reduced height on mobile
              padding: { xs: '8px 12px', sm: '12px 16px' }, // Reduced padding on mobile
              opacity: 0.7,
              textTransform: 'none',
              fontSize: { xs: '0.8rem', sm: '0.9rem' }, // Smaller font on mobile
              fontWeight: 500,
              letterSpacing: '0.01em',
              transition: 'all 0.3s ease',
              '&:hover': {
                color: '#0b4f75',
                opacity: 0.9,
                backgroundColor: 'rgba(11, 79, 117, 0.04)'
              },
              '&.Mui-selected': {
                color: '#0b4f75',
                fontWeight: 600,
                opacity: 1
              },
              // Mobile-specific icon spacing
              '& .MuiTab-iconWrapper': {
                marginRight: { xs: '4px', sm: '6px' }
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#ff7300',
              height: '3px',
              borderRadius: '2px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            },
            // Mobile responsive tabs container
            [theme.breakpoints.down('sm')]: {
              '& .MuiTabs-flexContainer': {
                gap: '2px'
              }
            }
          }}>          <Tab 
            icon={<ArticleIcon fontSize="small" />} 
            iconPosition="start" 
            label={isExistingMeeting ? "View Transcript" : "Transcript"} 
            onClick={(e) => {
              // Handle tab clicks directly to ensure proper event handling
              e.stopPropagation();
            }}
          />
          <Tab 
            icon={<ChatIcon fontSize="small" />} 
            iconPosition="start" 
            label="Chat" 
            onClick={(e) => {
              // Handle tab clicks directly to ensure proper event handling
              e.stopPropagation();
            }}
          />
          <Tab 
            icon={<SummarizeIcon fontSize="small" />} 
            iconPosition="start" 
            label={isExistingMeeting && summary ? "View Summary" : "Summary"}
            onClick={(e) => {
              // Handle tab clicks directly to ensure proper event handling
              console.log("[Transcription] Summary tab clicked directly");
              e.stopPropagation();
            }}
          /></Tabs>
      </StyledAppBar>      {/* Transcript Tab */}
      <TabPanel hidden={tabValue !== 0} value={tabValue} index={0}>
        {/* Always show MeetingRecorder for new meetings (not isExistingMeeting) */}
        {!isExistingMeeting && (
          <MeetingRecorder onTranscriptionUpdate={handleMeetingRecorderUpdate} />
        )}
        <Box sx={{ mt: 2 }}>
          {(rawTranscript || animatedDisplayedTranscript || isRecordingLocal) ? ( // Show controls if there's any activity
            <>              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                {!isExistingMeeting && (
                  <IconButton 
                    color="primary" 
                    onClick={saveTranscription} 
                    disabled={isProcessing || !rawTranscript} 
                    title="Save Meeting"
                  >
                    <SaveIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>              <Paper 
                variant="outlined" 
                sx={{ 
                  p: { xs: 2, sm: 3 }, // Reduced padding on mobile
                  minHeight: isExistingMeeting ? { xs: 'calc(100dvh - 200px)', sm: 'calc(100vh - 220px)' } : '200px', 
                  maxHeight: isExistingMeeting ? { xs: 'calc(100dvh - 200px)', sm: 'calc(100vh - 220px)' } : { xs: 'calc(100dvh - 380px)', sm: 'calc(100vh - 400px)' }, 
                  height: isExistingMeeting ? { xs: 'calc(100dvh - 200px)', sm: 'calc(100vh - 220px)' } : 'auto',
                  overflowY: 'auto', 
                  backgroundColor: '#f8fafc',
                  borderRadius: { xs: '12px', sm: '16px' }, // Smaller border radius on mobile
                  boxShadow: '0 4px 16px rgba(11, 79, 117, 0.08)',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  transition: 'all 0.3s ease'
                }}
              >
                <Typography 
                  variant="body1" 
                  sx={{ 
                    whiteSpace: 'pre-wrap', 
                    lineHeight: 1.7,
                    color: '#334155' 
                  }}
                >
                  {animatedDisplayedTranscript || ( (isRecordingLocal || (typeof MeetingRecorder !== 'undefined' && MeetingRecorder.isRecording)) && !rawTranscript ? "Listening..." : "Start recording to see transcript...")}                </Typography>
              </Paper>
              {!isExistingMeeting && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <ActionButton variant="contained" color="primary" startIcon={<SummarizeIcon />} onClick={generateSummary} disabled={isProcessing || !rawTranscript}>
                    Generate Summary
                  </ActionButton>
                </Box>
              )}
            </>
          ) : ( 
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: 'calc(100% - 40px)', /* Adjust if MeetingRecorder has fixed height */
                padding: 4              }}
            > 
              <EmptyState 
                type="transcript" 
                hideButton={isExistingMeeting}
              />
            </Box>
          )}
        </Box>
      </TabPanel>      {/* Chat Tab */}      <TabPanel hidden={tabValue !== 1} value={tabValue} index={1}>
        <Box sx={{ 
          height: { xs: 'calc(100dvh - 140px)', sm: 'calc(100vh - 160px)' }, // Mobile-optimized height
          display: 'flex', 
          flexDirection: 'column' 
        }}>
          <Box sx={{ 
            p: { xs: 1, sm: 2 }, 
            flexGrow: 1, 
            overflowY: 'auto', 
            mb: 1,
            maxHeight: { xs: 'calc(100dvh - 220px)', sm: 'calc(100vh - 240px)' } // Ensure space for input
          }}>
            {chatMessages.length > 0 ? (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: { xs: 1.5, sm: 2, md: 2.5 },
                  background: 'linear-gradient(145deg, #f8fafc, #f1f5f9)',
                  boxShadow: '0 4px 16px rgba(11, 79, 117, 0.08)',
                  borderRadius: { xs: '12px', sm: '16px' },
                  border: '1px solid rgba(226, 232, 240, 0.8)'
                }}
              >
                <List sx={{py:0}}>
                {chatMessages.map((message) => (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    cleanMarkdownFormatting={cleanMarkdownFormatting} 
                  />
                ))}
                <div ref={chatEndRef} />
              </List>
            </Paper>            ) : (
              rawTranscript ? (
                <EmptyState 
                  type="chat"
                  hasTranscript={Boolean(rawTranscript && rawTranscript.length > 30)}
                  hideButton={isExistingMeeting}
                />
              ) : (
                <EmptyState 
                  type="chat"
                  hasTranscript={false}
                  buttonText="Go to Recording"
                  onButtonClick={() => setTabValue(0)}
                  hideButton={isExistingMeeting}
                />
              )
            )}
          </Box>
          
          <EnhancedChatInput 
            chatQuery={chatQuery}
            setChatQuery={setChatQuery}
            handleChatSubmit={handleChatSubmit}
            isAiResponding={isAiResponding}
            rawTranscript={rawTranscript}
            setError={setError}
          />
        </Box>
      </TabPanel>      {/* Summary Tab */}      <TabPanel 
        hidden={tabValue !== 2} 
        value={tabValue} 
        index={2}
        onClick={(e) => {
          console.log("[Transcription] TabPanel onClick triggered");
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >        {summary ? (
         <Box 
          onClick={(e) => {
            console.log("[Transcription] Main summary Box onClick prevented");
            e.stopPropagation();
            e.preventDefault();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onScroll={(e) => e.stopPropagation()}
         ><Card 
              onClick={(e) => {
                console.log("[Transcription] Card onClick prevented");
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()} 
              onScroll={(e) => e.stopPropagation()}              sx={{ 
                mb: { xs: 2, sm: 3 }, // Reduced margin on mobile
                boxShadow: '0 4px 20px rgba(11, 79, 117, 0.1)',
                borderRadius: { xs: '12px', sm: '16px' }, // Smaller border radius on mobile
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                '&:hover': {
                  boxShadow: '0 6px 24px rgba(11, 79, 117, 0.15)',
                  transform: 'translateY(-2px)'
                }
            }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }} onClick={(e) => e.stopPropagation()}><Typography 
                      variant="h5" 
                      gutterBottom 
                      component="div" 
                      onClick={(e) => e.stopPropagation()}                      sx={{
                        color: '#0b4f75', 
                        fontWeight: 600,
                        fontSize: { xs: '1.3rem', sm: '1.5rem' }, // Smaller on mobile
                        letterSpacing: '-0.01em'
                      }}
                    >
                      {summary.title || "Meeting Summary"}
                    </Typography>                    <Divider sx={{ my: 2, borderColor: 'rgba(226, 232, 240, 0.8)' }} onClick={(e) => e.stopPropagation()} />                    {summary.overall && (
                      <Box mb={2} onClick={(e) => e.stopPropagation()}>                        <Typography 
                          variant="subtitle1" 
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            fontWeight: 600,
                            color: '#0b4f75',
                            fontSize: { xs: '1rem', sm: '1.1rem' }, // Smaller on mobile
                            mb: 1
                          }}
                        >
                          Overall Summary
                        </Typography><Typography 
                          variant="body2" 
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            whiteSpace: 'pre-wrap', 
                            mt: 0.5,
                            color: '#334155',
                            lineHeight: 1.6
                          }}
                        >
                          {summary.overall}
                        </Typography>
                      </Box>
                    )}                    {/* Dynamic sections from AI analysis */}
                    {summary.sections && [...summary.sections]
                      // Sort sections to ensure "Action Items" or "Next Steps" comes last
                      .sort((a, b) => {
                        const aIsAction = a.headline.toLowerCase().includes('action') || 
                                          a.headline.toLowerCase().includes('next step') ||
                                          a.headline.toLowerCase().includes('task');
                        const bIsAction = b.headline.toLowerCase().includes('action') || 
                                          b.headline.toLowerCase().includes('next step') ||
                                          b.headline.toLowerCase().includes('task');
                        
                        if (aIsAction && !bIsAction) return 1; // Action items go last
                        if (!aIsAction && bIsAction) return -1; // Non-action items go first
                        return 0; // Keep original order for other sections
                      })
                      .map((section, sectionIndex) => {
                        const isActionSection = section.headline.toLowerCase().includes('action') || 
                                                section.headline.toLowerCase().includes('next step') ||
                                                section.headline.toLowerCase().includes('task');
                        
                        // Rename action section to standardized name if it is an action section
                        const displayHeadline = isActionSection ? "ACTION ITEMS AND NEXT STEPS" : section.headline;
                          return (
                          <Box key={`section-${sectionIndex}`} mb={2} onClick={(e) => e.stopPropagation()}>                            <Typography 
                              variant="subtitle1" 
                              onClick={(e) => e.stopPropagation()}
                              sx={{
                                fontWeight: 600,
                                color: '#0b4f75',
                                fontSize: { xs: '0.9rem', sm: '1.1rem' }, // Even smaller on mobile
                                mb: 1,
                                wordWrap: 'break-word', // Allow text to wrap
                                overflowWrap: 'break-word', // Handle long words
                                hyphens: 'auto', // Add hyphens for better wrapping
                                lineHeight: { xs: 1.3, sm: 1.4 } // Tighter line height on mobile
                              }}
                            >
                              {displayHeadline}
                            </Typography><List dense sx={{pt:0}} onClick={(e) => e.stopPropagation()}>                          
                              {section.bulletPoints.map((point, pointIndex) => (                                <ListItem 
                                  key={`section-${sectionIndex}-point-${pointIndex}`} 
                                  onClick={(e) => {
                                    console.log("[Transcription] ListItem onClick prevented");
                                    e.stopPropagation();
                                    e.preventDefault();
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onMouseUp={(e) => e.stopPropagation()}
                                  sx={{
                                    pl: 0,
                                    py: 0.8,
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                      backgroundColor: 'rgba(11, 79, 117, 0.03)',
                                      borderRadius: '8px'
                                    }
                                  }}                                ><ListItemIcon sx={{minWidth: 32}} onClick={(e) => e.stopPropagation()}>
                                    <span style={{ 
                                      color: isActionSection ? '#ff7300' : '#0b4f75', 
                                      fontSize: '1.2em',
                                      marginLeft: '8px'
                                    }}>•</span>
                                  </ListItemIcon>
                                  <ListItemText 
                                    primary={point} 
                                    onClick={(e) => e.stopPropagation()}
                                    primaryTypographyProps={{
                                      sx: {
                                        color: '#334155',
                                        fontSize: '0.95rem',
                                        lineHeight: 1.5
                                      }
                                    }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        );
                      })
                    }                    {/* For backward compatibility with the old format */}                    {(!summary.sections || summary.sections.length === 0) && (
                      <>
                        {summary.keyPoints && summary.keyPoints.length > 0 && (
                          <Box mb={2} onClick={(e) => e.stopPropagation()}>
                            <Typography variant="subtitle1" fontWeight="bold" onClick={(e) => e.stopPropagation()}>Key Discussion Points</Typography>
                            <List dense sx={{pt:0}} onClick={(e) => e.stopPropagation()}>
                              {summary.keyPoints.map((point, index) => (
                                <ListItem key={`kp-${index}`} sx={{pl:0}} 
                                  onClick={(e) => {
                                    console.log("[Transcription] Legacy ListItem onClick prevented");
                                    e.stopPropagation();
                                    e.preventDefault();
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onMouseUp={(e) => e.stopPropagation()}
                                ><ListItemIcon sx={{minWidth: 28}}>                                    <span style={{ 
                                      color: '#0b4f75', 
                                      fontSize: '1.2em',
                                      marginLeft: '8px'
                                    }}>•</span>
                                  </ListItemIcon>
                                  <ListItemText primary={point} onClick={(e) => e.stopPropagation()} />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        )}
                          {summary.actionItems && summary.actionItems.length > 0 && !summary.sections.some(s => 
                            s.headline.toLowerCase().includes('action') || 
                            s.headline.toLowerCase().includes('next step') || 
                            s.headline.toLowerCase().includes('task')
                          ) && (
                          <Box onClick={(e) => e.stopPropagation()}>
                            <Typography variant="subtitle1" fontWeight="bold" onClick={(e) => e.stopPropagation()}>ACTION ITEMS AND NEXT STEPS</Typography>
                            <List dense sx={{pt:0}} onClick={(e) => e.stopPropagation()}>
                              {summary.actionItems.map((item, index) => (
                                <ListItem key={`ai-${index}`} sx={{pl:0}} 
                                  onClick={(e) => {
                                    console.log("[Transcription] Action item ListItem onClick prevented");
                                    e.stopPropagation();
                                    e.preventDefault();
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onMouseUp={(e) => e.stopPropagation()}
                                >
                                  <ListItemIcon sx={{minWidth: 28}} onClick={(e) => e.stopPropagation()}>
                                    <span style={{ 
                                      color: '#ff7300', 
                                      fontSize: '1.2em',
                                      marginLeft: '8px'
                                    }}>•</span>
                                  </ListItemIcon>
                                  <ListItemText primary={item} onClick={(e) => e.stopPropagation()} />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        )}
                      </>
                    )}
                </CardContent>
            </Card>            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }} onClick={(e) => {
              console.log("[Transcription] Export button container onClick prevented");
              e.stopPropagation();
              e.preventDefault();            }}>
                <Button 
                  variant="contained" 
                  startIcon={<ShareIcon />}
                  onClick={(e) => {
                    console.log("[Transcription] Share summary button clicked");
                    e.preventDefault();
                    e.stopPropagation();
                    // Call the shareSummaryAsLink function
                    shareSummaryAsLink();
                  }}
                  disabled={isProcessing}                  sx={{ 
                    borderRadius: '24px',
                    backgroundColor: '#ff7300',
                    color: '#ffffff',
                    fontWeight: 600,
                    padding: { xs: '6px 16px', sm: '8px 24px' }, // Smaller padding on mobile
                    textTransform: 'none',
                    fontSize: { xs: '0.9rem', sm: '1rem' }, // Smaller font on mobile
                    boxShadow: '0 2px 6px rgba(255, 115, 0, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: '#e56800',
                      boxShadow: '0 4px 10px rgba(255, 115, 0, 0.4)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  {isProcessing ? 'Creating Link...' : 'Share Summary'}
                </Button>
            </Box>
         </Box>        ) : (          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              padding: 4
            }}
            onClick={(e) => {
              console.log("[Transcription] Empty state box onClick prevented");
              e.stopPropagation();
              e.preventDefault();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >            <EmptyState 
              type="summary" 
              hasTranscript={Boolean(rawTranscript && rawTranscript.length > 30)}
              buttonText={isProcessing ? 'Generating...' : 'Generate Summary'}
              onButtonClick={(e) => {
                console.log("[Transcription] Generate summary button clicked");
                e.preventDefault();
                e.stopPropagation();
                generateSummary();
              }}
              buttonDisabled={!rawTranscript || isProcessing || isExistingMeeting}
              buttonIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <SummarizeIcon />}
              hideButton={isExistingMeeting}
            />
          </Box>
        )}      </TabPanel>      
      
      {/* Enhanced Notifications */}      <EnhancedNotifications
        error={error}
        setError={setError}
        isProcessing={isProcessing}
        snackbarOpen={snackbarOpen}
        snackbarMessage={snackbarMessage}
        handleSnackbarClose={handleSnackbarClose}
      />
    </Box>
  );
};

export default Transcription;