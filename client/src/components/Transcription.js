import React, { useState, useRef, useEffect } from 'react';
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
  Container,
  AppBar,
  Toolbar,
  Avatar,
  Chip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
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

// Styled components for Transcription UI
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: 'none',
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
}));

const TabPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  height: 'calc(100vh - 160px)',
  overflow: 'auto',
}));

const TranscriptHighlight = styled('span')(({ theme, active }) => ({
  backgroundColor: active ? 'rgba(255, 213, 79, 0.5)' : 'transparent',
  padding: '0 2px',
  borderRadius: '4px',
  transition: 'background-color 0.3s ease',
}));

const RecordingIndicator = styled(Box)(({ theme, isRecording }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: isRecording ? 'rgba(255, 82, 82, 0.1)' : 'rgba(255, 255, 255, 0.1)',
  padding: theme.spacing(1.5),
  borderRadius: '30px',
  marginBottom: theme.spacing(2),
}));

const RecordingDot = styled('div')(({ theme, isRecording }) => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  backgroundColor: isRecording ? '#ff5252' : '#c1c1c1',
  marginRight: theme.spacing(1),
  animation: isRecording ? 'pulse 1.5s infinite ease-in-out' : 'none',
  '@keyframes pulse': {
    '0%': {
      transform: 'scale(0.95)',
      boxShadow: '0 0 0 0 rgba(255, 82, 82, 0.7)',
    },
    '70%': {
      transform: 'scale(1)',
      boxShadow: '0 0 0 5px rgba(255, 82, 82, 0)',
    },
    '100%': {
      transform: 'scale(0.95)',
      boxShadow: '0 0 0 0 rgba(255, 82, 82, 0)',
    },
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

const ChatButton = styled(Button)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  left: '50%',
  transform: 'translateX(-50%)',
  borderRadius: '30px',
  padding: theme.spacing(1.5, 3),
  boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
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
  // State variables
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [transcriptionSegments, setTranscriptionSegments] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [meetingTitle, setMeetingTitle] = useState(() => {
    // Get meeting title from localStorage if it exists, otherwise use default
    return localStorage.getItem('currentMeetingTitle') || 'New Meeting';
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatting, setIsChatting] = useState(false);  const [summary, setSummary] = useState(null);
  const [audioLevels, setAudioLevels] = useState(Array(9).fill({ level: 3, isSilent: true }));
  
  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);  const recordingTimeRef = useRef(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const chatEndRef = useRef(null);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
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
  }, [chatMessages]);  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);
    // Update meeting title if the meeting ID changes
  useEffect(() => {
    if (meetingId) {
      const storedMeetingId = localStorage.getItem('currentMeetingId');
      const storedMeetingTitle = localStorage.getItem('currentMeetingTitle');
      
      if (storedMeetingId === meetingId && storedMeetingTitle) {
        // We have the exact meeting ID and title stored
        setMeetingTitle(storedMeetingTitle);
      } else {
        // We need to fetch the real title - in a production app
        // this would be an API call to get the meeting details
        
        // For demo purposes, if we don't have the stored title for this ID,
        // we'll check if this is one of our hardcoded favorites
        if (!storedMeetingTitle || storedMeetingId !== meetingId) {
          // Only use favorite titles for fav IDs (used in our Dashboard)
          if (meetingId.startsWith('fav')) {
            // For favorites, try to load from the list (would normally be an API call)
            const favId = meetingId;
            // This is a simulated lookup that would be replaced by an API call
            const favTitles = {
              'fav1': 'Weekly standup meeting',
              'fav2': 'Product roadmap discussion',
              'fav3': 'UX review with design team',
              'fav4': 'Quarterly planning session',
              'fav5': 'API integration discussion',
              'fav6': 'Customer feedback analysis'
            };
            
            if (favTitles[favId]) {
              setMeetingTitle(favTitles[favId]);
              // Also update localStorage for consistency
              localStorage.setItem('currentMeetingId', favId);
              localStorage.setItem('currentMeetingTitle', favTitles[favId]);
            } else {
              // Fall back to a generic title with the ID
              setMeetingTitle(`Meeting ${meetingId}`);
            }
          } else {
            // For non-favorite meetings
            setMeetingTitle(`Meeting ${meetingId}`);
          }
        }
      }
    }
  }, [meetingId]);
  
  // Handle title editing
  const handleTitleClick = () => {
    setNewTitle(meetingTitle);
    setEditingTitle(true);
  };
  
  const handleTitleChange = (e) => {
    setNewTitle(e.target.value);
  };
    const handleTitleSave = async () => {
    if (newTitle.trim()) {
      try {
        // In a production app, you'd save this to the backend
        // await transcriptionAPI.updateMeetingTitle(meetingId, newTitle);
        const trimmedTitle = newTitle.trim();
        setMeetingTitle(trimmedTitle);
        
        // Update localStorage to keep the name in sync
        localStorage.setItem('currentMeetingTitle', trimmedTitle);
        
        // In a real implementation, you'd also update the Dashboard data via an API
      } catch (err) {
        console.error('Error updating meeting title:', err);
        setError('Failed to update meeting title. Please try again.');
      }
    }
    setEditingTitle(false);
  };

  // Request microphone permissions
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return stream;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone access denied. Please grant permission to use this feature.');
      return null;
    }
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      setError('');
      setIsProcessing(true);
      
      const stream = await requestMicrophonePermission();
      if (!stream) {
        setIsProcessing(false);
        return;
      }      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];      // Set up audio analyzer for visualization with improved sensitivity 
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      // Use more frequencyBins for higher resolution analysis
      analyser.smoothingTimeConstant = 0.5; // Balance between smooth transitions and responsiveness
      
      const audioSource = audioContext.createMediaStreamSource(stream);
      audioSource.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Keep track of silence detection
      let silenceCounter = 0;
      const SILENCE_THRESHOLD = 5; // Threshold for what counts as silence
      const SILENCE_DURATION = 10; // How many consecutive silent frames to consider real silence
      
      // Update audio levels at animation frame rate with improved silence detection
      const updateAudioLevels = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          analyser.getByteFrequencyData(dataArray);
          
          // Get average level from speech frequency range (300Hz-3000Hz)
          // This targets human voice more accurately than full spectrum
          const speechRange = dataArray.slice(2, 40); // Adjusted for focus on speech frequencies
          const sum = speechRange.reduce((a, b) => a + b, 0);
          const avg = sum / speechRange.length;
          
          // Determine if this is silence based on average level
          const isSilent = avg < SILENCE_THRESHOLD;
          
          if (isSilent) {
            silenceCounter++;
          } else {
            silenceCounter = 0;
          }
          
          // Enhanced normalization for better visualization
          // More dynamic range - uses logarithmic scaling for better representation
          let normalizedLevel;
          
          // If truly silent (multiple consecutive frames), show minimal activity
          if (silenceCounter > SILENCE_DURATION) {
            normalizedLevel = 3; // Minimal height for silence
          } else {
            // Apply logarithmic scaling for better human perception of sound levels
            normalizedLevel = Math.min(100, Math.max(5, 
              avg < 10 ? avg * 1.5 : 
              avg < 30 ? 15 + (avg - 10) * 2 : 
              55 + Math.log10(avg - 29) * 20
            ));
          }
          
          setAudioLevels(prev => {
            const newLevels = [...prev, {
              level: normalizedLevel,
              isSilent: silenceCounter > SILENCE_DURATION
            }];
            return newLevels.slice(-9); // Keep only the 9 most recent levels
          });
          
          requestAnimationFrame(updateAudioLevels);
        }
      };
      
      updateAudioLevels();

      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording
      mediaRecorder.start(2000); // Capture in 2-second intervals for periodic transcription
      setIsRecording(true);
      setIsProcessing(false);
      
      // Set timer for recording duration
      recordingTimeRef.current = 0;
      recordingIntervalRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
        
        // Process audio chunk every 10 seconds
        if (recordingTimeRef.current % 10 === 0) {
          processAudioChunk();
        }
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please try again.');
      setIsProcessing(false);
    }
  };
  // Process audio chunk for transcription
  const processAudioChunk = async () => {
    if (audioChunksRef.current.length === 0) return;
    
    try {
      // Create blob from audio chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // For simplicity, we'll convert blob to base64 and send as JSON
      // In production, you'd use FormData and stream the file for better performance
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        // Get base64 data (remove data:audio/webm;base64, prefix)
        const base64Audio = reader.result.split(',')[1];
        
        // Send to backend for transcription
        const response = await transcriptionAPI.processAudio(base64Audio, meetingId);
        
        if (response && response.data && response.data.segment) {
          const segment = response.data.segment;
          
          // Add new transcription segment
          const newSegment = {
            id: segment.id,
            text: segment.text,
            timestamp: segment.timestamp || new Date().toISOString()
          };
          
          setTranscriptionSegments(prev => [...prev, newSegment]);
          
          // Append to full transcription with speaker formatting
          setTranscription(prev => {
            // If this is the first segment or a new speaker
            if (!prev || Math.random() > 0.7) {
              const speakers = ['Alex', 'Jamie', 'Sam', 'Taylor'];
              const speaker = speakers[Math.floor(Math.random() * speakers.length)];
              return `${prev ? prev + '\n\n' : ''}${speaker}: ${segment.text}`;
            } else {
              // Continue current speaker's text
              return `${prev} ${segment.text}`;
            }
          });
        }
        
        // Clear processed audio chunks
        audioChunksRef.current = [];
      };
      
    } catch (err) {
      console.error('Error processing audio chunk:', err);
      // Don't stop recording on transcription error, just log it
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    try {
      setIsProcessing(true);
      
      // Stop the media recorder
      mediaRecorderRef.current.stop();
        // Stop all tracks in the stream
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      // Clear recording interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      
      setIsRecording(false);
      // Reset audio levels with proper object structure to match our updated visualization
      setAudioLevels(Array(9).fill({ level: 3, isSilent: true }));
      
      // Final processing of any remaining audio
      await processAudioChunk();
      
      setIsProcessing(false);
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError('Error stopping recording. Some data might not be processed.');
      setIsProcessing(false);
      setIsRecording(false);
    }
  };
  // This formatTime function is already defined above
  // const formatTime = (seconds) => {
  //   const mins = Math.floor(seconds / 60);
  //   const secs = seconds % 60;
  //   return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  // };  // Save transcription
  const saveTranscription = async () => {
    try {
      setIsProcessing(true);
      
      // Prepare meeting data
      const meetingData = {
        id: meetingId || `meeting-${Date.now()}`, // Generate temp ID if none exists
        title: meetingTitle,
        transcript: transcription,
        segments: transcriptionSegments,
        date: new Date().toISOString()
      };
      
      // In a production app, this would save to the backend
      // const response = await transcriptionAPI.saveMeeting(meetingData);
      
      // For now, we'll simulate saving with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a new ID for simulation purposes if one wasn't provided
      const newMeetingId = meetingId || meetingData.id;
      
      // Update localStorage with the latest meeting info
      localStorage.setItem('currentMeetingId', newMeetingId);
      localStorage.setItem('currentMeetingTitle', meetingTitle);
      
      // If this was a new meeting and we got an ID back, navigate to the proper URL
      if (!meetingId) {
        // In a real app: navigate(`/transcription/${response.data.id}`);
        navigate(`/transcription/${newMeetingId}`);
      }
      
      // Show success notification
      setError(''); // Clear any previous errors
      alert('Meeting saved successfully!');
      setIsProcessing(false);
    } catch (err) {
      console.error('Error saving meeting:', err);
      setError('Failed to save meeting. Please try again.');
      setIsProcessing(false);
    }
  };
  
  // Handle sending a chat message
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;
    
    try {
      setIsChatting(true);
      
      // Add user message to chat
      const userMessage = {
        id: Date.now(),
        text: chatQuery,
        sender: 'user'
      };
      setChatMessages(prevMessages => [...prevMessages, userMessage]);
      
      // Clear input field
      const queryText = chatQuery;
      setChatQuery('');
      
      // Get response from API
      const response = await transcriptionAPI.chatWithTranscript(transcription, queryText);
      
      if (response && response.data && response.data.response) {
        // Add AI response to chat
        const aiMessage = {
          id: Date.now() + 1,
          text: response.data.response.answer,
          sender: 'ai'
        };
        setChatMessages(prevMessages => [...prevMessages, aiMessage]);
      }
    } catch (err) {
      console.error('Error sending chat message:', err);
      setError('Failed to get a response. Please try again.');
      
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 2,
        text: 'Sorry, there was an error processing your question.',
        sender: 'system'
      };
      setChatMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsChatting(false);
    }
  };

  // Generate meeting summary
  const generateSummary = async () => {
    try {
      setIsProcessing(true);
      const response = await transcriptionAPI.generateSummary(transcription);
      
      if (response && response.data && response.data.summary) {
        setSummary(response.data.summary);
        // Switch to summary tab
        setTabValue(1);
      }
      
      setIsProcessing(false);
    } catch (err) {
      console.error('Error generating summary:', err);
      setError('Failed to generate summary. Please try again.');
      setIsProcessing(false);
    }
  };

  // Reset transcription
  const resetTranscription = () => {
    if (window.confirm('Are you sure you want to delete this transcription? This action cannot be undone.')) {
      setTranscription('');
      setTranscriptionSegments([]);
    }
  };

  // Load existing meeting data if meetingId is provided
  useEffect(() => {
    const loadMeetingData = async () => {
      if (meetingId) {
        try {
          setIsProcessing(true);
          // For now, we'll simulate loading meeting data
          // In a production app, we'd fetch this from an API
          if (meetingId === '1') {
            setMeetingTitle('TwinMind App Development Discussion');
            setTranscription('Welcome to our app development discussion.\n\nJohn: I think we should focus on the UI first.\n\nSarah: That makes sense, but we also need to fix the backend authentication issues.\n\nMike: Let\'s prioritize the features based on the user feedback we received last week.\n\nJohn: Good point. The transcription feature was highly requested.');
            
            // Set up some initial chat messages for this meeting
            setChatMessages([
              { id: 1, text: 'What were the main points discussed?', sender: 'user' },
              { id: 2, text: 'The main points discussed were UI development, backend authentication issues, and feature prioritization based on user feedback. The transcription feature was mentioned as highly requested by users.', sender: 'ai' }
            ]);
            
          } else if (meetingId === '2') {
            setMeetingTitle('TwinMind AI App Overview: Founder\'s Conversation');
            setTranscription('Alex: Welcome to our product overview discussion.\n\nEmma: Thanks for joining. Let\'s start with the AI capabilities.\n\nAlex: The app will use Gemini for real-time transcription and summary generation.\n\nEmma: Great, and what about the roadmap?\n\nAlex: We\'re planning to add Google Calendar integration in the next sprint, followed by meeting analytics.');
          } else if (meetingId === '3') {
            setMeetingTitle('TwinMind Feature Discussion: Audio');
            setTranscription('David: Let\'s discuss the audio options.\n\nLisa: I think we should add different quality options for the recordings.\n\nDavid: Good idea. We also need to simplify the UI flow for starting recordings.\n\nLisa: Agreed. And we should add an option to save recordings locally or to the cloud.\n\nDavid: That would be great for users with limited internet connectivity.');          } else {
            // For any other meeting ID, use the title from localStorage if available
            const storedTitle = localStorage.getItem('currentMeetingTitle');
            if (storedTitle) {
              setMeetingTitle(storedTitle);
            } else {
              // Only fall back to a generic title if nothing is stored
              setMeetingTitle(`Meeting ${meetingId}`);
            }
            setTranscription('No transcript available for this meeting yet.');
          }
        } catch (err) {
          console.error('Error loading meeting data:', err);
          setError('Failed to load meeting data.');
        } finally {
          setIsProcessing(false);
        }
      }
    };

    loadMeetingData();
  }, [meetingId]);
  
  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header App Bar */}
      <StyledAppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>          <Box sx={{ flexGrow: 1 }}>
            {editingTitle ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TextField
                  value={newTitle}
                  onChange={handleTitleChange}
                  variant="outlined"
                  size="small"
                  autoFocus
                  onBlur={handleTitleSave}
                  onKeyPress={(e) => e.key === 'Enter' && handleTitleSave()}
                  sx={{ mr: 1 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          onClick={handleTitleSave}
                          size="small"
                        >
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            ) : (
              <EditableTitle variant="h6" component="div" noWrap onClick={handleTitleClick}>
                {meetingTitle}
              </EditableTitle>
            )}
            
            {isRecording && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <RecordingDot isRecording={isRecording} />
                <Typography variant="caption" color="error" sx={{ mr: 1 }}>
                  Recording: {formatTime(recordingTime)}
                </Typography>                <div className="audio-wave-container">
                  {audioLevels.length > 0 ? 
                    audioLevels.map((audioData, index) => (
                      <div 
                        key={index} 
                        className={`audio-wave ${audioData.isSilent ? 'silence' : ''}`}
                        style={{ 
                          height: `${Math.max(3, audioData.level * 0.3)}px`,
                          opacity: audioData.level / 100 * 0.6 + 0.4,
                          backgroundColor: audioData.isSilent ? '#aaaaaa' : '#1E62EB',
                        }} 
                      />
                    )) : 
                    Array.from({ length: 9 }).map((_, index) => (
                      <div key={index} className="audio-wave default-animation" />
                    ))
                  }
                </div>
              </Box>
            )}
          </Box>
          
          {!isRecording && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<MicIcon />}
              onClick={startRecording}
              disabled={isProcessing}
            >
              Record
            </Button>
          )}
            {isRecording && (
            <Button
              variant="contained"
              color="error"
              startIcon={<StopIcon />}
              onClick={stopRecording}
              disabled={isProcessing}
            >
              Stop
            </Button>
          )}
          
          {isProcessing && (
            <CircularProgress size={24} sx={{ ml: 2 }} />
          )}
        </Toolbar>
        
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            '& .MuiTab-root': { 
              textTransform: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              py: 1.5
            }
          }}
        >
          <Tab 
            icon={<ArticleIcon fontSize="small" />} 
            iconPosition="start" 
            label="Transcript" 
          />
          <Tab 
            icon={<ChatIcon fontSize="small" />} 
            iconPosition="start" 
            label="Chat" 
          />
          <Tab 
            icon={<SummarizeIcon fontSize="small" />} 
            iconPosition="start" 
            label="Summary" 
          />
        </Tabs>
      </StyledAppBar>
      
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Transcript Tab */}
      <TabPanel hidden={tabValue !== 0} value={tabValue} index={0}>
        {isProcessing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        
        {transcription ? (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
              <IconButton color="primary" onClick={saveTranscription} disabled={isProcessing || isRecording} size="small">
                <SaveIcon fontSize="small" />
              </IconButton>
              <IconButton color="error" onClick={resetTranscription} disabled={isProcessing || isRecording} size="small">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                height: 'calc(100vh - 240px)',
                overflowY: 'auto',
                backgroundColor: '#f9f9f9'
              }}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {transcription}
              </Typography>
            </Paper>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <ActionButton
                variant="contained"
                color="primary"
                startIcon={<SummarizeIcon />}
                onClick={generateSummary}
                disabled={isProcessing || isRecording || !transcription}
              >
                Generate Summary
              </ActionButton>
            </Box>
          </>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: 'calc(100vh - 240px)'
          }}>
            <RecordingIndicator isRecording={isRecording}>
              <RecordingDot isRecording={isRecording} />
              <Typography variant="body2" color={isRecording ? "error" : "textSecondary"}>
                {isRecording ? "Recording in progress..." : "No active recording"}
              </Typography>
            </RecordingIndicator>
            
            <Typography variant="body1" color="textSecondary" align="center">
              {isRecording 
                ? "TwinMind is listening in the background. Leave it on during your meeting."
                : "Press the Record button to start capturing your meeting."
              }
            </Typography>
          </Box>
        )}
      </TabPanel>
      
      {/* Chat Tab */}
      <TabPanel hidden={tabValue !== 1} value={tabValue} index={1}>
        {transcription ? (
          <>
            <Box 
              sx={{ 
                height: 'calc(100vh - 240px)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Paper
                variant="outlined"
                sx={{ 
                  p: 2, 
                  flexGrow: 1,
                  overflowY: 'auto',
                  mb: 2,
                  backgroundColor: '#f9f9f9'
                }}
              >
                {chatMessages.length > 0 ? (
                  <List>
                    {chatMessages.map((message) => (
                      <ListItem
                        key={message.id}
                        alignItems="flex-start"
                        sx={{ 
                          flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
                          px: 1 
                        }}
                      >
                        <Box 
                          sx={{ 
                            maxWidth: '80%',
                            backgroundColor: message.sender === 'user' ? 'primary.light' : 'background.paper',
                            color: message.sender === 'user' ? 'white' : 'text.primary',
                            borderRadius: 2,
                            p: 1.5,
                            boxShadow: 1
                          }}
                        >
                          <Typography variant="body2">
                            {message.text}
                          </Typography>
                        </Box>
                      </ListItem>
                    ))}
                    <div ref={chatEndRef} />
                  </List>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <ChatIcon color="primary" sx={{ fontSize: 40, mb: 2, opacity: 0.6 }} />
                    <Typography variant="body1" color="textSecondary" align="center">
                      Ask questions about your meeting transcript
                    </Typography>
                    <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 1 }}>
                      For example: "What were the key decisions made?"
                    </Typography>
                  </Box>
                )}
              </Paper>
              
              <Box component="form" onSubmit={handleChatSubmit}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Ask a question about your transcript..."
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  disabled={isChatting}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton 
                          type="submit" 
                          color="primary" 
                          disabled={!chatQuery.trim() || isChatting}
                        >
                          {isChatting ? <CircularProgress size={24} /> : <SendIcon />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            </Box>
          </>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: 'calc(100vh - 240px)'
          }}>
            <Typography variant="body1" color="textSecondary" align="center">
              No transcription available. Start recording a meeting first.
            </Typography>
          </Box>
        )}
      </TabPanel>
      
      {/* Summary Tab */}
      <TabPanel hidden={tabValue !== 2} value={tabValue} index={2}>
        {summary ? (
          <Box>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {summary.title}
                </Typography>
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Key Points
                </Typography>
                <List dense>
                  {summary.keyPoints.map((point, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={point} />
                    </ListItem>
                  ))}
                </List>
                
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                  Action Items
                </Typography>
                <List dense>
                  {summary.actionItems.map((item, index) => (
                    <ListItem key={index}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CheckCircleIcon fontSize="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={item} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
            
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<InsightsIcon />}
                sx={{ mr: 1 }}
              >
                Export Summary
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: 'calc(100vh - 240px)'
          }}>
            <SummarizeIcon sx={{ fontSize: 40, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1" color="textSecondary" align="center">
              No summary available yet.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={generateSummary}
              disabled={!transcription || isProcessing}
              sx={{ mt: 2 }}
            >
              Generate Summary
            </Button>
          </Box>
        )}
      </TabPanel>
    </Box>
  );
};

export default Transcription;
