import React, { useState, useRef, useEffect } from 'react';
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
  Divider,
  IconButton
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import apiRequest from '../services/api';

const Transcription = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [transcriptionSegments, setTranscriptionSegments] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('New Meeting');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const recordingTimeRef = useRef(0);
  const [recordingTime, setRecordingTime] = useState(0);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

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
      }

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

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
      
      // Create form data for API request
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Send to backend for transcription
      const response = await apiRequest('/transcription/process', {
        method: 'POST',
        headers: {
          // Don't set Content-Type here, as FormData will set it automatically with boundary
        },
        body: formData
      });
      
      if (response && response.data && response.data.text) {
        // Add new transcription segment
        const newSegment = {
          id: Date.now(),
          text: response.data.text,
          timestamp: new Date().toISOString()
        };
        
        setTranscriptionSegments(prev => [...prev, newSegment]);
        setTranscription(prev => prev + ' ' + response.data.text);
      }
      
      // Clear processed audio chunks
      audioChunksRef.current = [];
      
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

  // Format recording time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Save transcription
  const saveTranscription = async () => {
    try {
      setIsProcessing(true);
      const response = await apiRequest('/transcription/save', {
        method: 'POST',
        body: JSON.stringify({
          title: meetingTitle,
          text: transcription,
          segments: transcriptionSegments
        })
      });
      
      if (response && response.status === 200) {
        alert('Transcription saved successfully!');
      }
      
      setIsProcessing(false);
    } catch (err) {
      console.error('Error saving transcription:', err);
      setError('Failed to save transcription. Please try again.');
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

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Meeting Transcription
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Button
            variant={isRecording ? "contained" : "outlined"}
            color={isRecording ? "error" : "primary"}
            startIcon={isRecording ? <StopIcon /> : <MicIcon />}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            sx={{ mr: 2 }}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </Button>
          
          {isRecording && (
            <Typography variant="body2" color="error">
              Recording: {formatTime(recordingTime)}
            </Typography>
          )}
          
          {isProcessing && (
            <CircularProgress size={24} sx={{ ml: 2 }} />
          )}
        </Box>
        
        {transcription && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Transcription
              </Typography>
              <Box>
                <IconButton color="primary" onClick={saveTranscription} disabled={isProcessing || isRecording}>
                  <SaveIcon />
                </IconButton>
                <IconButton color="error" onClick={resetTranscription} disabled={isProcessing || isRecording}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Box>
            
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: '#f9f9f9'
              }}
            >
              <Typography variant="body1">
                {transcription || "No transcription yet."}
              </Typography>
            </Paper>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Transcription;
