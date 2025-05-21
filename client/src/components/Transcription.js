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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArticleIcon from '@mui/icons-material/Article';
import SummarizeIcon from '@mui/icons-material/Summarize';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import InsightsIcon from '@mui/icons-material/Insights';
import SendIcon from '@mui/icons-material/Send';
import apiRequest, { transcriptionAPI } from '../services/api';
import MeetingRecorder from './MeetingRecorder';

// Styled components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: 'none',
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
}));

const TabPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  flexGrow: 1,
  overflow: 'auto',
  // Ensuring the TabPanel takes up available vertical space
  // The parent Box of Transcription.js already has display: 'flex', flexDirection: 'column', height: '100vh'
  // So, flexGrow: 1 on TabPanel should make it expand.
  // If specific height calculations are needed beyond AppBar, they can be done here or on the content Box.
  // For example: height: `calc(100vh - ${theme.mixins.toolbar.minHeight * 2}px - ${theme.spacing(4)}px)`,
  // if you have a fixed AppBar and Tabs height.
}));


const RecordingDot = styled('div')(({ theme, isRecording }) => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  backgroundColor: isRecording ? '#ff5252' : '#c1c1c1',
  marginRight: theme.spacing(1),
  animation: isRecording ? 'pulse 1.5s infinite ease-in-out' : 'none',
  '@keyframes pulse': {
    '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 82, 82, 0.7)' },
    '70%': { transform: 'scale(1)', boxShadow: '0 0 0 5px rgba(255, 82, 82, 0)' },
    '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 82, 82, 0)' },
  },
}));

const EditableTitle = styled(Typography)(({ theme }) => ({
  cursor: 'pointer',
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.spacing(0.5),
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: '24px',
  padding: theme.spacing(1, 3),
  textTransform: 'none',
  fontWeight: 500,
}));

const Transcription = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { meetingId } = useParams();
  // --- State Variables ---
  const [isRecordingLocal, setIsRecordingLocal] = useState(false); // For local MediaRecorder controls if used
  const [rawTranscript, setRawTranscript] = useState(''); // For immediate, complete transcript for logic
  const [animatedDisplayedTranscript, setAnimatedDisplayedTranscript] = useState(''); // Renamed but now just holds the transcript directly
  const [transcriptionSegments, setTranscriptionSegments] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false); // General processing for save/summary
  const [error, setError] = useState('');
  const [meetingTitle, setMeetingTitle] = useState(() => localStorage.getItem('currentMeetingTitle') || 'New Meeting');
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [summary, setSummary] = useState(null);
  const [audioLevelsLocal, setAudioLevelsLocal] = useState(Array(9).fill({ level: 3, isSilent: true })); // For local recorder viz
  const [isAiResponding, setIsAiResponding] = useState(false); // For chat AI response streaming
  const [hasAutoSwitchedToChat, setHasAutoSwitchedToChat] = useState(false); // Track if we've already auto-switched to chat
  const currentAiMessageIdRef = useRef(null); // To manage the ID of the AI message being built during streaming

  // --- Refs ---
  const mediaRecorderRefLocal = useRef(null);
  const audioChunksRefLocal = useRef([]);
  const recordingIntervalRefLocal = useRef(null);
  const recordingTimeRefLocal = useRef(0);
  const [recordingTimeLocal, setRecordingTimeLocal] = useState(0);
  const chatEndRef = useRef(null); // For scrolling chat to bottom

  // Handle tab change
  const handleTabChange = (event, newValue) => setTabValue(newValue);

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
      if (storedMeetingId === meetingId && storedMeetingTitle) {
        setMeetingTitle(storedMeetingTitle);
      } else {
        // Basic fallback, in a real app, you'd fetch if not matching
        if (meetingId.startsWith('fav')) { // Example for demo favorites
          const favTitles = { 'fav1': 'Weekly standup meeting', 'fav2': 'Product roadmap discussion' };
          setMeetingTitle(favTitles[meetingId] || `Meeting ${meetingId}`);
          if (favTitles[meetingId]) {
            localStorage.setItem('currentMeetingId', meetingId);
            localStorage.setItem('currentMeetingTitle', favTitles[meetingId]);
          }
        } else {
          setMeetingTitle(`Meeting ${meetingId}`); // Generic title if not a known favorite
        }
      }
    } else {
        setMeetingTitle(localStorage.getItem('currentMeetingTitle') || 'New Meeting');
    }
  }, [meetingId]);

  // Title editing handlers
  const handleTitleClick = () => { setNewTitle(meetingTitle); setEditingTitle(true); };
  const handleTitleChangeInput = (e) => setNewTitle(e.target.value);
  const handleTitleSave = async () => {
    if (newTitle.trim()) {
      const trimmedTitle = newTitle.trim();
      setMeetingTitle(trimmedTitle);
      localStorage.setItem('currentMeetingTitle', trimmedTitle);
      // TODO: API call to save title to backend if meetingId exists
      // Example: if (meetingId) await transcriptionAPI.updateMeetingTitle(meetingId, trimmedTitle);
    }
    setEditingTitle(false);
  };
  // Simplified transcript update logic (no animation)
  const processTranscriptUpdate = useCallback((text) => {
    if (text && typeof text === 'string') {
      setAnimatedDisplayedTranscript(text);
    }
  }, []);  // --- Callback for MeetingRecorder component (updates main transcript) - no animation ---
  const handleMeetingRecorderUpdate = useCallback((textChunk, metadata) => {
    if (metadata && metadata.type === 'reset') {
      setRawTranscript("");
      setAnimatedDisplayedTranscript("");
      setTranscriptionSegments([]);
      setHasAutoSwitchedToChat(false); // Reset the auto-switch flag when transcript is reset
      setError('');
      return;
    }
    
    let chunkToProcess = textChunk;
    if (metadata && metadata.error) {
      chunkToProcess = `[Error: ${textChunk || (metadata.errorDetail || 'Transcription failed')}]`;
      setError(chunkToProcess); // Display error in global error state
    } else {
      setError(''); // Clear error if successful transcription
    }

    if (chunkToProcess || (metadata && metadata.type === 'segment_final_empty')) {
      if (chunkToProcess) { // Only process if there's actual text
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
          // Update displayed transcript immediately
          setAnimatedDisplayedTranscript(newRaw);
          return newRaw;
        });
      }
    }
    
    if (metadata) {
      setTranscriptionSegments(prev => [...prev, { ...metadata, text: chunkToProcess || "" }]);
    }
  }, []);// processAnimationQueue is stable due to useCallback

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

  // --- Data Handling Functions ---
  const saveTranscription = async () => {
    try {
      setIsProcessing(true);
      const meetingData = {
        id: meetingId || `meeting-${Date.now()}`, // Use existing or generate new
        title: meetingTitle,
        transcript: rawTranscript,
        segments: transcriptionSegments,
        chatHistory: chatMessages, // Include chat history
        date: new Date().toISOString()
      };
      await transcriptionAPI.saveMeeting(meetingData); // Assumes api.js has this
      const savedMeetingId = meetingData.id;
      localStorage.setItem('currentMeetingId', savedMeetingId);
      localStorage.setItem('currentMeetingTitle', meetingTitle);
      if (!meetingId) navigate(`/transcription/${savedMeetingId}`); // Navigate if it was a new meeting
      alert('Meeting saved successfully!'); // Replace with Snackbar
    } catch (err) {
        console.error('Error saving meeting:', err);
        setError('Failed to save meeting. Please try again.');
    } finally {
        setIsProcessing(false);
    }
  };
  // --- CHAT SUBMIT HANDLER ---
  const handleChatSubmit = async (e) => {
    e?.preventDefault();
    if (!chatQuery.trim() || isAiResponding) return;

    const currentTextQuery = chatQuery.trim();
    
    // Create a sanitized history to send to backend
    const historyToSend = chatMessages.map(msg => ({
        sender: msg.sender,
        text: msg.text
    }));    // Add user message to chat history
    const userMessage = {
      id: `user-${Date.now()}`,
      text: currentTextQuery,
      sender: 'user'
    };
    
    // Update UI immediately
    setChatMessages(prevMessages => [...prevMessages, userMessage]);
    setChatQuery(''); // Clear input field
    setIsAiResponding(true);
    
    // Generate ID for AI response
    currentAiMessageIdRef.current = `ai-${Date.now()}`;
    
    // Add placeholder for AI response
    setChatMessages(prevMessages => [
      ...prevMessages,
      { 
        id: currentAiMessageIdRef.current, 
        text: "", 
        sender: 'ai', 
        isStreaming: true
      }
    ]);

    // Switch to chat tab if not already there
    if (tabValue !== 1) {
      setTabValue(1);
    }    try {
      console.log("Sending chat request with transcript length:", rawTranscript?.length || 0);
      
      // Check if transcript is too short
      if (!rawTranscript || rawTranscript.length < 30) {
        console.warn("Transcript is very short or empty, adding a note to the chat history");
        // Add a note message before sending the request
        setChatMessages(prevMessages => [
          ...prevMessages.filter(msg => msg.id !== currentAiMessageIdRef.current),          { 
            id: currentAiMessageIdRef.current, 
            text: "Note: The transcript appears to be very short or empty. I'll do my best to answer, but might be limited in what I can reference.", 
            sender: 'ai', 
            isStreaming: false
          }
        ]);
        
        // Allow a small delay for the user to see the message
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Create a new message ID for the actual answer
        currentAiMessageIdRef.current = `ai-${Date.now()}`;
        setChatMessages(prevMessages => [
          ...prevMessages,          { 
            id: currentAiMessageIdRef.current, 
            text: "", 
            sender: 'ai', 
            isStreaming: true
          }
        ]);
      }
        await transcriptionAPI.chatWithTranscript(
        rawTranscript,  // The full transcript text
        historyToSend,  // Previous chat messages
        currentTextQuery, // Current user query
        {          onChunk: (textChunk) => {
            // Preserve markdown formatting in the text chunk
            // It will be converted to HTML when rendering with dangerouslySetInnerHTML
            
            // Update the streaming message with each chunk, preserving the markdown
            setChatMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === currentAiMessageIdRef.current
                  ? { ...msg, text: (msg.text || "") + textChunk }
                  : msg
              )
            );
          },onEnd: () => {
            // Mark message as complete when stream ends
            setChatMessages(prevMessages => {
              const currentMessage = prevMessages.find(msg => msg.id === currentAiMessageIdRef.current);
              
              return prevMessages.map(msg =>
                msg.id === currentAiMessageIdRef.current
                  ? { 
                      ...msg, 
                      isStreaming: false,
                      // Don't clean markdown - we'll render it as formatted HTML
                      text: currentMessage ? currentMessage.text : msg.text 
                    }
                  : msg
              );
            });
            
            setIsAiResponding(false);
            currentAiMessageIdRef.current = null;
          },onError: (error) => {
            console.error("Chat stream error:", error);
            const errorMessage = error.message || 'Unknown error';
              // Format error message based on type
            let formattedErrorMsg = error.friendlyMessage || error.message || 'Unknown error';
            
            if (error.code === 'RATE_LIMITED' || formattedErrorMsg.includes('rate limit') || formattedErrorMsg.includes('429')) {
              formattedErrorMsg = "😓 Rate limit reached. I need to take a short break. Please try again in 30-60 seconds.";
            } else if (error.code === 'SERVER_ERROR' || formattedErrorMsg.includes('Server error') || formattedErrorMsg.includes('500')) {
              formattedErrorMsg = "😓 Sorry, I'm having trouble connecting to the server. This might be due to a temporary issue. Please try again in a moment.";
            }
            
            // Update the message with error information
            setChatMessages(prevMessages => {
              // Find the specific message that needs updating
              const messageToUpdate = prevMessages.find(msg => msg.id === currentAiMessageIdRef.current);
              
              // If the message exists and already has substantial content
              if (messageToUpdate && messageToUpdate.text && messageToUpdate.text.length > 20) {
                // Keep existing content but add error notice
                return prevMessages.map(msg =>
                  msg.id === currentAiMessageIdRef.current
                    ? { 
                        ...msg, 
                        text: `${msg.text}\n\n[Error: Communication was interrupted. ${formattedErrorMsg}]`, 
                        isStreaming: false, 
                        isError: true 
                      }
                    : msg
                );
              } else {
                // Replace with just the error message if there's no substantial content
                return prevMessages.map(msg =>
                  msg.id === currentAiMessageIdRef.current                    ? { 
                        ...msg, 
                        text: cleanMarkdownFormatting(formattedErrorMsg), 
                        isStreaming: false, 
                        isError: true 
                      }
                    : msg
                );
              }
            });setIsAiResponding(false);
            currentAiMessageIdRef.current = null;
            // Only set the global error for major failures, not just stream interruptions
            setChatMessages(prevMsgs => {
              const currentMessage = prevMsgs.find(msg => msg.id === currentAiMessageIdRef.current);
              if (!currentMessage?.text || currentMessage.text.length < 5) {
                setError(`Chat error: ${error.message || 'Failed to get response'}`);
              }
              return prevMsgs;
            });
          }
        }
      );
    } catch (apiSetupError) {      console.error("Error setting up chat stream:", apiSetupError);
      // Handle error in API setup
      setChatMessages(prevMsgs =>
          prevMsgs.map(msg =>
              msg.id === currentAiMessageIdRef.current
              ? { 
                  ...msg, 
                  text: `I'm sorry, I couldn't process your request: ${apiSetupError.message || 'Failed to connect to chat service'}. Please try again in a moment.`, 
                  isStreaming: false, 
                  isError: true 
                }
              : msg
          )
      );
      setIsAiResponding(false);
      currentAiMessageIdRef.current = null;
      setError(`Chat error: ${apiSetupError.message || 'Failed to initiate chat'}`);
    }
  };

  const generateSummary = async () => {
    if (!rawTranscript) {
      setError("No transcript available to summarize.");
      return;
    }
    try {
      setIsProcessing(true);
      const response = await transcriptionAPI.generateSummary(rawTranscript, meetingId);
      if (response && response.data && response.data.summary) {
        setSummary(response.data.summary);
        setTabValue(2); // Switch to summary tab
      } else {
         setError(response?.data?.error || 'Failed to get summary content from API.');
      }
    } catch (err) {
        console.error('Error generating summary:', err);
        setError('API call to generate summary failed.');
    } finally {
        setIsProcessing(false);
    }
  };

  const resetTranscriptionData = () => {
    if (window.confirm('Are you sure you want to delete this transcription and chat history? This action cannot be undone.')) {
      handleMeetingRecorderUpdate(null, { type: 'reset' }); // Resets transcript states
      setSummary(null);
      setChatMessages([]); // Clear chat messages
      setError(''); // Clear any global errors
    }
  };
  // Load existing meeting data
  useEffect(() => {
    const loadMeetingData = async () => {
      if (meetingId) {
        setIsProcessing(true);
        setError(''); // Clear previous errors
        setHasAutoSwitchedToChat(false); // Reset flag when loading a new meeting
        try {
          const response = await transcriptionAPI.getMeeting(meetingId); // Assumes api.js has this
          if (response && response.data && response.status === 200) {
            const meetingData = response.data;
            setMeetingTitle(meetingData.title || `Meeting ${meetingId}`);
            setRawTranscript(meetingData.transcript || "");
            setAnimatedDisplayedTranscript(meetingData.transcript || ""); // No animation for loaded text
            setTranscriptionSegments(meetingData.segments || []);
            setChatMessages(meetingData.chatHistory || []); // Load chat history
            setSummary(meetingData.summary || null);
          } else {
            // Fallback for demo or if meeting not found by API
            let loadedRawTranscript = 'No transcript available for this meeting ID.';
            let loadedTitle = `Meeting ${meetingId}`;
            if (meetingId === '1') { /* your demo data */ }
            setMeetingTitle(loadedTitle);
            setRawTranscript(loadedRawTranscript);
            setAnimatedDisplayedTranscript(loadedRawTranscript);
            setChatMessages([]); // Reset chat for unknown/new meetingId via URL
            if (response && response.data && response.data.error) setError(response.data.error);
            else if (response && response.status !== 200) setError(`Failed to load meeting (Status: ${response.status})`);
          }
        } catch (err) {
            console.error('Error loading meeting data:', err);
            setError('Failed to load meeting data. Please try again.');
            // Optionally clear states or set to default for robustness
            setMeetingTitle(`Meeting ${meetingId}`);
            setRawTranscript('');
            setAnimatedDisplayedTranscript('');
            setChatMessages([]);
            setSummary(null);
        } finally {
            setIsProcessing(false);
        }
      } else {
        // No meetingId, treat as a new meeting - reset relevant states
        handleMeetingRecorderUpdate(null, { type: 'reset' });
        setChatMessages([]);
        setSummary(null);
        setMeetingTitle(localStorage.getItem('currentMeetingTitle') || 'New Meeting'); // Keep title if from new meeting flow
      }
    };
    loadMeetingData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]); // Rerun if meetingId changes
  // Automatically switch to chat tab when transcript becomes available
  useEffect(() => {
    // If we have a transcript and no chat messages yet, show the chat tab with suggestions
    if (
      rawTranscript && 
      rawTranscript.length > 50 && 
      chatMessages.length === 0 && 
      tabValue !== 1 && 
      !hasAutoSwitchedToChat // Only auto-switch if we haven't done it yet for this context
    ) {
      // Use slight delay to ensure the transcript is fully processed
      const timer = setTimeout(() => {
        setTabValue(1);
        setHasAutoSwitchedToChat(true); // Mark that we've auto-switched for this context
        console.log("[Transcription] Auto-switching to chat tab due to new transcript");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [rawTranscript, chatMessages.length, tabValue, hasAutoSwitchedToChat]);  // Format text by preserving and converting markdown symbols to styling  
  const cleanMarkdownFormatting = (text) => {
    if (!text) return '';
    
    // Convert markdown to styled text
    return text
      // Handle bold formatting (**text**)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
      // Handle italic formatting (*text*)
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Handle numbered lists
      .replace(/^\s*(\d+)\.\s+(.+)$/gm, '<div class="list-item"><span class="list-number">$1.</span> $2</div>')
      // Handle bullet points with proper list items
      .replace(/^\s*[*•-]\s+(.+)$/gm, '<div class="list-item">• $1</div>')
      // Preserve paragraph breaks
      .replace(/\n\s*\n/g, '<br/><br/>')
      // Format headings
      .replace(/^#\s+(.+)$/gm, '<span style="font-size: 1.2em; font-weight: 600; margin: 0.8em 0 0.4em 0; display: block;">$1</span>')
      .replace(/^##\s+(.+)$/gm, '<span style="font-size: 1.1em; font-weight: 600; margin: 0.7em 0 0.3em 0; display: block;">$1</span>')
      .replace(/^###\s+(.+)$/gm, '<span style="font-size: 1.05em; font-weight: 600; margin: 0.6em 0 0.3em 0; display: block;">$1</span>')
      // Format code blocks
      .replace(/`{3}([\s\S]*?)`{3}/g, '<pre style="background-color: #f5f5f5; padding: 0.5em; border-radius: 4px; font-family: monospace; overflow-x: auto;">$1</pre>')
      // Format inline code
      .replace(/`(.*?)`/g, '<code style="background-color: #f5f5f5; padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace;">$1</code>')
      // Handle underscores for emphasis
      .replace(/_{2}(.*?)_{2}/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Convert line breaks (but not inside code blocks)
      .replace(/(?<!<pre[^>]*>)(?<!<code[^>]*>)\n(?![^<]*<\/pre>)(?![^<]*<\/code>)/g, '<br/>');
  };

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StyledAppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}> {/* Ensured flex alignment */}
            {editingTitle ? (
              <TextField
                value={newTitle}
                onChange={handleTitleChangeInput}
                variant="outlined"
                size="small"
                autoFocus
                onBlur={handleTitleSave}
                onKeyPress={(e) => e.key === 'Enter' && handleTitleSave()}
                sx={{ mr: 1, flexGrow: 1, maxWidth: '50%' }} // Allow title field to grow
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" onClick={handleTitleSave} size="small">
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            ) : (
              <EditableTitle variant="h6" component="div" noWrap onClick={handleTitleClick} sx={{ flexGrow: 1 }}>
                {meetingTitle}
              </EditableTitle>
            )}
            {/* Local recording indicator - ensure this JSX is what you intend */}
            {isRecordingLocal && (
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                <RecordingDot isRecording={isRecordingLocal} />
                <Typography variant="caption" color="error" sx={{ mr: 1 }}>
                  Rec: {formatTime(recordingTimeLocal)}
                </Typography>
                {/* Optional: your local audio wave visualization if you have one */}
              </Box>
            )}
          </Box>
        </Toolbar>
        <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth" indicatorColor="primary" textColor="primary">
          <Tab icon={<ArticleIcon fontSize="small" />} iconPosition="start" label="Transcript" />
          <Tab icon={<ChatIcon fontSize="small" />} iconPosition="start" label="Chat" />
          <Tab icon={<SummarizeIcon fontSize="small" />} iconPosition="start" label="Summary" />
        </Tabs>
      </StyledAppBar>

      {error && <Alert severity="error" sx={{ m: 2, flexShrink: 0 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Transcript Tab */}
      <TabPanel hidden={tabValue !== 0} value={tabValue} index={0}>
        <MeetingRecorder onTranscriptionUpdate={handleMeetingRecorderUpdate} />
        <Box sx={{ mt: 2 }}>
          {(rawTranscript || animatedDisplayedTranscript || isRecordingLocal) ? ( // Show controls if there's any activity
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <IconButton color="primary" onClick={saveTranscription} disabled={isProcessing || !rawTranscript} title="Save Meeting"><SaveIcon fontSize="small" /></IconButton>
                <IconButton color="error" onClick={resetTranscriptionData} disabled={isProcessing} title="Delete Transcript"><DeleteIcon fontSize="small" /></IconButton>
              </Box>
              <Paper variant="outlined" sx={{ p: 2, minHeight: '200px', maxHeight: 'calc(100vh - 400px)', overflowY: 'auto', backgroundColor: '#f9f9f9' }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {animatedDisplayedTranscript || ( (isRecordingLocal || (typeof MeetingRecorder !== 'undefined' && MeetingRecorder.isRecording)) && !rawTranscript ? "Listening..." : "Start recording to see transcript...")}
                </Typography>
              </Paper>
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <ActionButton variant="contained" color="primary" startIcon={<SummarizeIcon />} onClick={generateSummary} disabled={isProcessing || !rawTranscript}>
                  Generate Summary
                </ActionButton>
              </Box>
            </>
          ) : ( <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100% - 40px)' /* Adjust if MeetingRecorder has fixed height */ }}> <ArticleIcon color="action" sx={{fontSize: 48, mb:2, opacity: 0.5}}/> <Typography variant="h6" color="textSecondary" align="center"> Start recording to get started. </Typography><Typography variant="body2" color="textSecondary" align="center">Your live transcript will appear here.</Typography> </Box> )}
        </Box>
      </TabPanel>      {/* Chat Tab */}      <TabPanel hidden={tabValue !== 1} value={tabValue} index={1}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto', mb: 1 }}>
            {chatMessages.length > 0 ? (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  background: 'linear-gradient(to bottom, #fbfbfb, #f5f5f5)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  borderRadius: '12px'
                }}
              >
                <List sx={{py:0}}>
                {chatMessages.map((message) => (
                  <ListItem
                    key={message.id}
                    alignItems="flex-start"
                    sx={{
                      flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
                      px: 0, py: 0.7, // Slightly increased padding
                      mb: 1.5, // Increased margin between messages
                      animation: 'fadeIn 0.3s ease-in-out',
                      '@keyframes fadeIn': {
                        '0%': { opacity: 0, transform: 'translateY(5px)' },
                        '100%': { opacity: 1, transform: 'translateY(0)' }
                      }
                    }}
                  >
                    {/* Avatar for user or AI */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mr: message.sender === 'user' ? 0 : 1.5,
                        ml: message.sender === 'user' ? 1.5 : 0,
                        mt: 0.5
                      }}
                    >
                      {message.sender === 'user' ? (
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: 'primary.light',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          <PersonIcon sx={{ fontSize: 18, color: 'white' }} />
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          <SmartToyIcon sx={{ fontSize: 18, color: 'white' }} />
                        </Box>
                      )}
                    </Box>
                    
                    <Box sx={{                        maxWidth: '70%', // Slightly reduced max width
                        backgroundColor: message.sender === 'user' 
                          ? 'primary.main' 
                          : (message.isError ? 'error.light' : 'rgba(255,255,255,0.95)'),
                        color: message.sender === 'user' 
                          ? 'primary.contrastText' 
                          : (message.isError ? 'error.dark' : 'text.primary'),
                        borderRadius: message.sender === 'user' 
                          ? '20px 20px 4px 20px' 
                          : '20px 20px 20px 4px', // Improved bubble style
                        p: 1.6, // More padding for better readability
                        boxShadow: message.sender === 'user'
                          ? '0 2px 8px rgba(25, 118, 210, 0.25)'
                          : '0 2px 8px rgba(0,0,0,0.06)',
                        position: 'relative', // For creating the time tooltip
                        transition: 'all 0.2s ease-in-out', // Smooth transitions
                        border: message.sender === 'user' 
                          ? 'none' 
                          : '1px solid rgba(0,0,0,0.05)',
                        '&:hover': {
                          boxShadow: message.sender === 'user'
                            ? '0 4px 8px rgba(25, 118, 210, 0.35)'
                            : '0 4px 8px rgba(0,0,0,0.14)', // Enhanced shadow on hover
                          transform: 'translateY(-2px)'
                        },
                        '& .list-item': {
                          marginBottom: '0.3rem',
                          display: 'flex',
                          alignItems: 'flex-start'
                        },
                        '& .list-number': {
                          minWidth: '1.5rem',
                          fontWeight: 500
                        }
                      }}
                    >                      {/* User messages don't need formatting, AI messages do */}
                      {message.sender === 'user' ? (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                          {message.text}
                        </Typography>
                      ) : (
                        <Typography 
                          variant="body2"                          sx={{ 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-word', 
                            lineHeight: 1.6,
                            '& strong': { fontWeight: 600 },
                            '& em': { fontStyle: 'italic' },
                            '& code': { 
                              fontFamily: 'monospace',
                              backgroundColor: 'rgba(0,0,0,0.05)',
                              padding: '0.1rem 0.3rem',
                              borderRadius: '3px'
                            },
                            '& pre': { 
                              overflowX: 'auto', 
                              maxWidth: '100%',
                              backgroundColor: 'rgba(0,0,0,0.04)',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              margin: '0.5rem 0'
                            },
                            '& ul': { paddingLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' },
                            '& li': { marginBottom: '0.25rem' }
                          }}
                          dangerouslySetInnerHTML={{ __html: cleanMarkdownFormatting(message.text) }}
                        />
                      )}                      {/* Streaming indicator - removed */}
                      {message.sender === 'ai' && message.isStreaming && (
                        <Box component="span" sx={{ 
                          display: 'inline-flex', 
                          alignItems: 'center',
                          ml: 0.5
                        }}>
                        </Box>
                      )}
                    </Box>
                  </ListItem>                ))}
                <div ref={chatEndRef} />
              </List>
            </Paper>
            ) : (
              rawTranscript ? (                
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%',
                    animation: 'fadeIn 0.5s ease-out',
                    '@keyframes fadeIn': {
                      '0%': { opacity: 0 },
                      '100%': { opacity: 1 }
                    }
                  }}
                >
                  <Box 
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      backgroundColor: '#e3f2fd',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      mb: 3,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      animation: 'pulse 2s infinite',
                      '@keyframes pulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(66, 133, 244, 0.4)' },
                        '70%': { boxShadow: '0 0 0 10px rgba(66, 133, 244, 0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(66, 133, 244, 0)' }
                      }
                    }}
                  >
                    <ChatIcon color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h6" color="textSecondary" align="center">Chat with your transcript</Typography>
                  <Typography variant="body2" color="textSecondary" align="center" sx={{mt:1, mb: 3, maxWidth: '70%'}}>
                    Ask questions about your meeting transcript. I can help summarize key points, extract action items, or clarify details.
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: 1,
                      maxWidth: '80%'
                    }}
                  >
                    {['What were the main topics?', 'Summarize action items', 'Who said what?'].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setChatQuery(suggestion);
                          // Focus on the text field
                          document.querySelector('input[type="text"]')?.focus();
                        }}
                        sx={{
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          py: 0.5,
                          borderColor: 'rgba(0, 0, 0, 0.12)',
                          color: 'text.secondary',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            borderColor: 'primary.light'
                          }
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%',
                    animation: 'fadeIn 0.5s ease-out',
                    '@keyframes fadeIn': {
                      '0%': { opacity: 0 },
                      '100%': { opacity: 1 }
                    }
                  }}
                >
                  <ChatIcon color="action" sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                  <Typography variant="h6" color="textSecondary" align="center">No transcript available</Typography>
                  <Typography variant="body2" color="textSecondary" align="center" sx={{mt:1, mb: 2, maxWidth: '70%'}}>
                    Record or load a meeting first to chat about it.
                  </Typography>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => setTabValue(0)}
                    sx={{ 
                      mt: 2, 
                      borderRadius: '24px',
                      px: 3,
                      boxShadow: '0 3px 5px rgba(0,0,0,0.12)',
                      '&:hover': {
                        boxShadow: '0 5px 8px rgba(0,0,0,0.2)'
                      }
                    }}
                  >
                    Go to Recording
                  </Button>
                </Box>
              )
            )}
          </Box>          <Box 
            component="form" 
            onSubmit={handleChatSubmit} 
            sx={{ 
              p: 1.5, 
              backgroundColor: 'transparent',
              flexShrink: 0,
              position: 'relative',
              '&:before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.06), transparent)',
              }
            }}
          >
            <TextField
              fullWidth
              variant="outlined"
              size="medium"
              placeholder={rawTranscript 
                ? "Ask a question about the transcript..." 
                : "Record or load a meeting first"}
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              disabled={isAiResponding || !rawTranscript}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '28px',
                  backgroundColor: rawTranscript ? 'white' : 'rgba(0, 0, 0, 0.02)',
                  border: 'none',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  '&.Mui-focused': {
                    boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.25), 0 2px 8px rgba(0,0,0,0.1)',
                  },
                  '&:hover': {
                    boxShadow: '0 3px 8px rgba(0,0,0,0.08)',
                    backgroundColor: rawTranscript ? 'white' : 'rgba(0, 0, 0, 0.03)'
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: '1px'
                  }
                },
                '& .MuiOutlinedInput-input': {
                  padding: '14px 16px',
                  fontSize: '0.95rem'
                },
                '& .MuiInputBase-root.Mui-disabled': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  opacity: 0.8,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.1)'
                  }
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="submit"
                      color={chatQuery.trim() && !isAiResponding && rawTranscript ? "primary" : "default"}
                      disabled={!chatQuery.trim() || isAiResponding || !rawTranscript}
                      title={!rawTranscript ? "No transcript available" : "Send message"}
                      sx={{ 
                        mx: 0.5, // Add margin for better spacing
                        bgcolor: chatQuery.trim() && !isAiResponding && rawTranscript 
                          ? 'primary.main' 
                          : 'transparent',
                        color: chatQuery.trim() && !isAiResponding && rawTranscript 
                          ? 'white' 
                          : undefined,
                        transform: chatQuery.trim() && !isAiResponding && rawTranscript 
                          ? 'scale(1.1)' // Make active button slightly larger
                          : 'scale(1)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: chatQuery.trim() && !isAiResponding && rawTranscript 
                            ? 'primary.dark' 
                            : undefined,
                          transform: chatQuery.trim() && !isAiResponding && rawTranscript 
                            ? 'scale(1.15)' // Grow slightly on hover when active
                            : 'scale(1.05)'
                        }
                      }}
                    >
                      {isAiResponding ? 
                        <CircularProgress 
                          size={22} 
                          thickness={4} 
                          color="inherit"
                          sx={{
                            animation: 'pulse 1.2s ease-in-out infinite alternate',
                            '@keyframes pulse': {
                              '0%': { opacity: 0.6 },
                              '100%': { opacity: 1 }
                            }
                          }}
                        /> : 
                        <SendIcon />
                      }
                    </IconButton>
                  </InputAdornment>
                ),
              }}              onKeyDown={(e) => {
                // Submit on Enter (not Shift+Enter)
                if (e.key === 'Enter' && !e.shiftKey) {
                  // Only if we have content and not already processing
                  if (chatQuery.trim() && !isAiResponding && rawTranscript) {
                    e.preventDefault();
                    handleChatSubmit(e);
                  } else if (!rawTranscript) {
                    // Provide feedback if no transcript available
                    e.preventDefault();
                    setError('Please record or load a meeting first before chatting.');
                  } else if (!chatQuery.trim()) {
                    // Empty query feedback
                    e.preventDefault();
                  }
                } else if (e.key === 'Escape') {
                  // Clear input on Escape
                  setChatQuery('');
                  e.target.blur();
                }
              }}
            />
          </Box>
        </Box>
      </TabPanel>

      {/* Summary Tab */}
      <TabPanel hidden={tabValue !== 2} value={tabValue} index={2}>
        {summary ? (
         <Box>
            <Card sx={{ mb: 3, boxShadow: 3 }}>
                <CardContent>
                    <Typography variant="h5" gutterBottom component="div" color="primary.main">{summary.title || "Meeting Summary"}</Typography>
                    <Divider sx={{ my: 2 }} />
                    {summary.overall && (<Box mb={2}><Typography variant="subtitle1" fontWeight="bold">Overall Summary</Typography><Typography variant="body2" sx={{whiteSpace: 'pre-wrap', mt:0.5}}>{summary.overall}</Typography></Box>)}
                    {summary.keyPoints && summary.keyPoints.length > 0 && (<Box mb={2}><Typography variant="subtitle1" fontWeight="bold">Key Discussion Points</Typography><List dense sx={{pt:0}}>{summary.keyPoints.map((point, index) => (<ListItem key={`kp-${index}`} sx={{pl:0}}><ListItemIcon sx={{minWidth: 28}}><CheckCircleIcon fontSize="small" color="action" /></ListItemIcon><ListItemText primary={point} /></ListItem>))}</List></Box>)}
                    {summary.actionItems && summary.actionItems.length > 0 && (<Box><Typography variant="subtitle1" fontWeight="bold">Action Items</Typography><List dense sx={{pt:0}}>{summary.actionItems.map((item, index) => (<ListItem key={`ai-${index}`} sx={{pl:0}}><ListItemIcon sx={{minWidth: 28}}><InsightsIcon fontSize="small" color="secondary" /></ListItemIcon><ListItemText primary={item} /></ListItem>))}</List></Box>)}
                </CardContent>
            </Card>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button variant="outlined" startIcon={<InsightsIcon />} sx={{ mr: 1 }}>Export Summary</Button>
            </Box>
         </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}> <SummarizeIcon color="action" sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} /> <Typography variant="h6" color="textSecondary" align="center">No summary available yet.</Typography> <Button variant="contained" color="primary" onClick={generateSummary} disabled={!rawTranscript || isProcessing} sx={{ mt: 2 }}>Generate Summary</Button> </Box>
        )}
      </TabPanel>
    </Box>
  );
};

export default Transcription;