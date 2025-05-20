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
import SendIcon from '@mui/icons-material/Send';
import ArticleIcon from '@mui/icons-material/Article';
import SummarizeIcon from '@mui/icons-material/Summarize';
import InsightsIcon from '@mui/icons-material/Insights';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
  const [animatedDisplayedTranscript, setAnimatedDisplayedTranscript] = useState(''); // For UI with animation
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
  const currentAiMessageIdRef = useRef(null); // To manage the ID of the AI message being built during streaming

  // --- Refs ---
  const mediaRecorderRefLocal = useRef(null);
  const audioChunksRefLocal = useRef([]);
  const recordingIntervalRefLocal = useRef(null);
  const recordingTimeRefLocal = useRef(0);
  const [recordingTimeLocal, setRecordingTimeLocal] = useState(0);
  const chatEndRef = useRef(null); // For scrolling chat to bottom

  // --- Animation Refs for main transcript---
  const animationQueueRef = useRef([]);
  const currentChunkToAnimateRef = useRef("");
  const currentCharIndexRef = useRef(0);
  const animationTimerIdRef = useRef(null);
  const typingSpeedMs = 30; // Milliseconds per character for main transcript animation

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

  // --- Animation Core Logic for Main Transcript ---
  const processAnimationQueue = useCallback(() => {
    if (animationTimerIdRef.current) {
      clearTimeout(animationTimerIdRef.current);
      animationTimerIdRef.current = null;
    }
    if (currentCharIndexRef.current < currentChunkToAnimateRef.current.length) {
      const charToAppend = currentChunkToAnimateRef.current[currentCharIndexRef.current];
      setAnimatedDisplayedTranscript(prev => prev + charToAppend);
      currentCharIndexRef.current++;
      animationTimerIdRef.current = setTimeout(processAnimationQueue, typingSpeedMs);
    } else {
      if (animationQueueRef.current.length > 0) {
        const nextRawChunk = animationQueueRef.current.shift();
        setAnimatedDisplayedTranscript(prevDisplayTranscript => { // Using callback to get latest prevDisplayTranscript for spacing
          let chunkToAnimateWithSpace = nextRawChunk;
          if (prevDisplayTranscript.length > 0 &&
              !prevDisplayTranscript.endsWith(' ') &&
              nextRawChunk && !nextRawChunk.startsWith(' ')) {
            chunkToAnimateWithSpace = " " + nextRawChunk;
          } else if (prevDisplayTranscript.length > 0 &&
                     prevDisplayTranscript.endsWith(' ') &&
                     nextRawChunk && nextRawChunk.startsWith(' ')) {
            chunkToAnimateWithSpace = nextRawChunk.substring(1);
          } else if (prevDisplayTranscript.length === 0 &&
                     nextRawChunk && nextRawChunk.startsWith(' ')) {
            chunkToAnimateWithSpace = nextRawChunk.substring(1);
          }
          currentChunkToAnimateRef.current = chunkToAnimateWithSpace || "";
          currentCharIndexRef.current = 0;
          if (currentChunkToAnimateRef.current.length > 0) {
            animationTimerIdRef.current = setTimeout(processAnimationQueue, typingSpeedMs);
          } else {
            Promise.resolve().then(processAnimationQueue); // Process next in queue if current chunk became empty
          }
          return prevDisplayTranscript; // This set state is mainly to ensure the callback has fresh prev state
        });
      } else {
        currentChunkToAnimateRef.current = "";
        animationTimerIdRef.current = null; // Animation idle
      }
    }
  }, [typingSpeedMs]); // typingSpeedMs is stable

  // --- Callback for MeetingRecorder component (updates main transcript) ---
  const handleMeetingRecorderUpdate = useCallback((textChunk, metadata) => {
    if (metadata && metadata.type === 'reset') {
      setRawTranscript("");
      setAnimatedDisplayedTranscript("");
      setTranscriptionSegments([]);
      animationQueueRef.current = [];
      if (animationTimerIdRef.current) clearTimeout(animationTimerIdRef.current);
      animationTimerIdRef.current = null;
      currentChunkToAnimateRef.current = '';
      currentCharIndexRef.current = 0;
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
          return newRaw;
        });
        animationQueueRef.current.push(chunkToProcess); // Add to animation queue
        if (!animationTimerIdRef.current && !currentChunkToAnimateRef.current) { // If animation is idle, start it
          processAnimationQueue();
        }
      }
    }
    if (metadata) {
      setTranscriptionSegments(prev => [...prev, { ...metadata, text: chunkToProcess || "" }]);
    }
  }, [processAnimationQueue]); // processAnimationQueue is stable due to useCallback

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

  // Cleanup for animation and local recording interval
  useEffect(() => {
    const animationTimer = animationTimerIdRef.current;
    const intervalTimer = recordingIntervalRefLocal.current;
    const mediaRecorder = mediaRecorderRefLocal.current;

    return () => {
      if (animationTimer) clearTimeout(animationTimer);
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
    e.preventDefault();
    if (!chatQuery.trim() || isAiResponding) return;

    const currentTextQuery = chatQuery;
    const historyToSend = chatMessages.map(msg => ({ // Transform to { sender, text } if backend expects that
        sender: msg.sender,
        text: msg.text
    })); // Send a snapshot of history

    const userMessage = {
      id: `user-${Date.now()}`,
      text: currentTextQuery,
      sender: 'user'
    };
    setChatMessages(prevMessages => [...prevMessages, userMessage]);
    setChatQuery('');
    setIsAiResponding(true);
    currentAiMessageIdRef.current = `ai-${Date.now()}`;

    setChatMessages(prevMessages => [
      ...prevMessages,
      { id: currentAiMessageIdRef.current, text: "", sender: 'ai', isStreaming: true }
    ]);

    try {
      await transcriptionAPI.chatWithTranscript(
        rawTranscript,
        historyToSend, // Pass the captured history
        currentTextQuery,
        {
          onChunk: (textChunk) => {
            setChatMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === currentAiMessageIdRef.current
                  ? { ...msg, text: (msg.text || "") + textChunk }
                  : msg
              )
            );
          },
          onEnd: () => {
            setChatMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === currentAiMessageIdRef.current
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
            setIsAiResponding(false);
            currentAiMessageIdRef.current = null;
          },
          onError: (error) => {
            console.error("Chat stream error:", error);
            setChatMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === currentAiMessageIdRef.current
                  ? { ...msg, text: (msg.text || "") + `\n[Error: ${error.message || 'Could not get response'}]`, isStreaming: false, isError: true }
                  : msg
              )
            );
            setIsAiResponding(false);
            currentAiMessageIdRef.current = null;
            setError(`Chat error: ${error.message || 'Failed to get response'}`);
          }
        }
      );
    } catch (apiSetupError) {
      console.error("Error setting up chat stream:", apiSetupError);
      setChatMessages(prevMessages =>
          prevMessages.map(msg =>
              msg.id === currentAiMessageIdRef.current
              ? { ...msg, text: `[Error: ${apiSetupError.message || 'Failed to initiate chat'}]`, isStreaming: false, isError: true }
              : msg
          ).filter(msg => !(msg.id === currentAiMessageIdRef.current && msg.text === "" && msg.isError))
      );
      setIsAiResponding(false);
      currentAiMessageIdRef.current = null;
      setError(`Chat setup error: ${apiSetupError.message || 'Failed to initiate chat'}`);
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
      </TabPanel>

      {/* Chat Tab */}
      <TabPanel hidden={tabValue !== 1} value={tabValue} index={1}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Paper variant="outlined" sx={{ p: 2, flexGrow: 1, overflowY: 'auto', mb: 1, backgroundColor: 'background.default' }}>
            {chatMessages.length > 0 ? (
              <List sx={{py:0}}>
                {chatMessages.map((message) => (
                  <ListItem
                    key={message.id}
                    alignItems="flex-start"
                    sx={{
                      flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
                      px: 0, py: 0.5, // Reduced padding
                      mb: 1, // Margin between messages
                    }}
                  >
                    <Box sx={{
                        maxWidth: '75%', // Slightly reduced max width
                        backgroundColor: message.sender === 'user' ? 'primary.main' : (message.isError ? 'error.light' : '#e0e0e0'),
                        color: message.sender === 'user' ? 'primary.contrastText' : (message.isError ? 'error.dark' : 'text.primary'),
                        borderRadius: message.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', // Bubble style
                        p: 1.25, // Adjusted padding
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {message.text}
                        {message.sender === 'ai' && message.isStreaming && (
                          <CircularProgress size={12} sx={{ ml: 0.5, display: 'inline-block', verticalAlign: 'middle', color: 'inherit' }} />
                        )}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
                <div ref={chatEndRef} />
              </List>
            ) : ( <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}> <ChatIcon color="action" sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} /> <Typography variant="h6" color="textSecondary" align="center">Chat with your transcript</Typography> <Typography variant="body2" color="textSecondary" align="center" sx={{mt:1}}>Ask questions after recording or loading a meeting.</Typography></Box> )}
          </Paper>
          <Box component="form" onSubmit={handleChatSubmit} sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper', flexShrink: 0 }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Ask a question about the transcript..."
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              disabled={isAiResponding || !rawTranscript}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="submit"
                      color="primary"
                      disabled={!chatQuery.trim() || isAiResponding}
                      title="Send message"
                    >
                      {isAiResponding ? <CircularProgress size={24} /> : <SendIcon />}
                    </IconButton>
                  </InputAdornment>
                )
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