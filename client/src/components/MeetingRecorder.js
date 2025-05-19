import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// Styled components for MeetingRecorder
const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: '24px',
  padding: theme.spacing(1, 3),
  textTransform: 'none',
  fontWeight: 500,
}));

const RecordingIndicator = styled(Box)(({ theme, isRecording }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: isRecording ? 'rgba(255, 82, 82, 0.2)' : 'rgba(255, 255, 255, 0.1)',
  padding: theme.spacing(1.2),
  borderRadius: '30px',
  marginTop: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  width: 'fit-content',
  margin: '10px auto',
  boxShadow: isRecording ? '0 0 8px rgba(255, 82, 82, 0.3)' : 'none',
  transition: 'all 0.3s ease',
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

const VisualizerCanvas = styled('canvas')(({ theme }) => ({
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: '12px',
  width: '100%',
  height: '120px',
  marginTop: theme.spacing(2),
  backgroundColor: 'white',
  display: 'block',
  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
}));

// Main MeetingRecorder component
// This component handles the audio recording, pause/resume, stopping,
// and sending audio chunks for transcription. It calls `onTranscriptionUpdate`
// with new text segments for the parent to manage.
const MeetingRecorder = ({ onTranscriptionUpdate }) => {
  // State variables for this component's internal logic
  const [recording, setRecording] = useState(false); // Is a recording session active?
  const [paused, setPaused] = useState(false);     // Is the current recording paused?
  const [isProcessing, setIsProcessing] = useState(false);  // Is an audio chunk being sent/processed?
  const [error, setError] = useState('');                   // Stores error messages for display
  const [recordingTime, setRecordingTime] = useState(0);    // UI display for recording duration

  // Refs for mutable values that persist across renders
  const mediaRecorderRef = useRef(null);      // Holds the MediaRecorder instance
  const audioChunksRef = useRef([]);          // Accumulates audio data blobs for the current segment
  const recordingIntervalRef = useRef(null);  // ID for the recording timer
  const recordingTimeRef = useRef(0);         // Internal counter for recording time
  const canvasRef = useRef(null);             // Ref to the visualizer canvas
  const audioContextRef = useRef(null);       // Web Audio API AudioContext
  const analyserRef = useRef(null);           // AnalyserNode for visualization
  const animationFrameRef = useRef(null);     // requestAnimationFrame ID
  const streamRef = useRef(null);             // Active MediaStream from microphone

  // Helper to format seconds to MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Effect for the recording timer
  useEffect(() => {
    if (recording && !paused) {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [recording, paused]);

  // Effect for component unmount cleanup
  useEffect(() => {
    return () => {
      console.log('[Recorder] Unmounting component, performing full cleanup...');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.error("Error closing audio context on unmount:", err));
      }
      mediaRecorderRef.current = null;
      audioContextRef.current = null;
      analyserRef.current = null;
    };
  }, []);

  // Request microphone permission
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone access denied. Please grant permission.');
      streamRef.current = null;
      return null;
    }
  };

  // Initialize audio visualizer
  const initializeVisualizer = async (stream) => {
    try {
      if (!stream || !stream.active) {
        console.warn('[Visualizer] Attempted to initialize with invalid stream.');
        return false;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 44100 });

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      console.log('[Visualizer] AudioContext state:', audioContextRef.current.state);

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      console.log('[Visualizer] Initializing visualization loop.');
      visualize();
      return true;
    } catch (err) {
      console.error('Error initializing audio visualizer:', err);
      setError('Failed to initialize audio visualization.');
      return false;
    }
  };

  // Waveform drawing loop
  const visualize = useCallback(() => {
    if (paused || !canvasRef.current || !analyserRef.current) {
      if (!paused && (!canvasRef.current || !analyserRef.current)) {
        animationFrameRef.current = requestAnimationFrame(visualize);
      } else if (paused) {
        console.log('[Visualizer] Visualization paused.');
      }
      return;
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      console.warn('[Visualizer] AudioContext suspended. Attempting resume.');
      audioContextRef.current.resume().catch(e => console.error('[Visualizer] Error resuming context:', e));
      animationFrameRef.current = requestAnimationFrame(visualize);
      return;
    }

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
    const { width, height } = canvas;
    canvasCtx.fillStyle = 'white';
    canvasCtx.fillRect(0, 0, width, height);
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = '#e0e0e0';
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, height / 2);
    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();

    const bufferLength = analyserRef.current.fftSize;
    const timeDomainDataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(timeDomainDataArray);

    if (recording && !paused) {
      const amplificationFactor = 8.0;
      for (let i = 0; i < timeDomainDataArray.length; i++) {
        const deviation = timeDomainDataArray[i] - 128;
        timeDomainDataArray[i] = 128 + deviation * amplificationFactor;
        timeDomainDataArray[i] = Math.max(0, Math.min(255, timeDomainDataArray[i]));
      }
    }

    canvasCtx.beginPath();
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = (recording && !paused) ? '#ff7300' : '#cccccc';
    const sliceWidth = width / timeDomainDataArray.length;
    let x = 0;
    for (let i = 0; i < timeDomainDataArray.length; i++) {
      const v = timeDomainDataArray[i] / 128.0;
      const y = v * height / 2;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }
    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();

    animationFrameRef.current = requestAnimationFrame(visualize);
  }, [recording, paused]);

  // Function to start a new recording
  const startRecording = async () => {
    try {
      console.log('[Recorder] Start recording action initiated...');
      setError('');
      setIsProcessing(true);
      // Signal parent to clear its transcript state
      if (onTranscriptionUpdate) onTranscriptionUpdate('', { type: 'reset' }); 
      setPaused(false);

      // Thorough cleanup of previous session
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      audioChunksRef.current = [];

      const newStream = await requestMicrophonePermission();
      if (!streamRef.current || !newStream) {
        setIsProcessing(false);
        return;
      }

      if (streamRef.current.getAudioTracks()[0]?.muted) {
        setError('Microphone is muted. Please unmute.');
      }

      let options = { audioBitsPerSecond: 128000 };
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      }
      console.log('[Recorder] Using MediaRecorder options:', options);

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      await initializeVisualizer(streamRef.current);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[Recorder] Chunk received: ${(event.data.size / 1024).toFixed(2)} KB. Chunks buffered: ${audioChunksRef.current.length}`);
        }
      };

      recordingTimeRef.current = 0;
      setRecordingTime(0);

      // Define the onstop handler for the MediaRecorder
      const handleMediaRecorderStop = async () => {
        console.log('[MediaRecorder] onstop. `recording` state:', recording, '`paused` state:', paused);
        // Process accumulated audio. This is for timeslices or the final chunk on manual stop.
        await processAudioChunk();

        // If the overall recording session is still active and not paused, restart for the next timeslice.
        if (recording && !paused && streamRef.current && streamRef.current.active) {
          console.log('[MediaRecorder] Timeslice ended, restarting for next chunk...');
          try {
            // Re-create MediaRecorder for robustness, using the same active stream
            mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
            mediaRecorderRef.current.ondataavailable = (event) => {
              if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
                console.log(`[Recorder] Chunk (restarted MR): ${(event.data.size / 1024).toFixed(2)} KB. Buffered: ${audioChunksRef.current.length}`);
              }
            };
            mediaRecorderRef.current.onstop = handleMediaRecorderStop; // Re-assign this handler
            mediaRecorderRef.current.start(30000); // ** TIMESLICE SET TO 30 SECONDS **
            console.log('[MediaRecorder] Restarted with 30-second timeslice.');
          } catch (restartErr) {
            console.error('Error restarting MediaRecorder:', restartErr);
            setError('Error during recording. Please try again.');
            setRecording(false); setPaused(false);
            if (streamRef.current?.getTracks) streamRef.current.getTracks().forEach(track => track.stop());
          }
        } else {
          console.log('[MediaRecorder] Not restarting (session ended, paused, or stream inactive).');
        }
      };
      mediaRecorderRef.current.onstop = handleMediaRecorderStop;

      mediaRecorderRef.current.start(30000); // ** TIMESLICE SET TO 30 SECONDS **
      console.log('[MediaRecorder] Started with 30-second timeslice.');

      setRecording(true);
      setPaused(false);
      setIsProcessing(false);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`Failed to start recording: ${err.message}.`);
      setIsProcessing(false);
    }
  };

  // Function to send audio chunks to backend
  const processAudioChunk = async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('No audio chunks to process.');
      return;
    }

    setIsProcessing(true);
    const currentMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm;codecs=opus';
    const audioBlob = new Blob(audioChunksRef.current, { type: currentMimeType });
    const chunksForThisProcess = [...audioChunksRef.current]; // For potential retry
    audioChunksRef.current = [];

    console.log(`Processing audio blob (type: ${currentMimeType}, size: ${(audioBlob.size / 1024).toFixed(2)} KB)`);

    if (audioBlob.size < 100) {
      console.warn('Audio blob too small, skipping API call.');
      setIsProcessing(false);
      return;
    }

    try {
      const formData = new FormData();
      const fileExtension = currentMimeType.split('/')[1]?.split(';')[0] || 'webm';
      formData.append('audio_data', audioBlob, `rec-${Date.now()}.${fileExtension}`);
      // 'is_final' is true if the *overall recording session* has been stopped by the user.
      // The `recording` state reflects this user intent.
      formData.append('is_final', (!recording).toString());
      formData.append('timestamp', new Date().toISOString());
      formData.append('recording_time', recordingTimeRef.current.toString());

      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required. Please log in.');
        setIsProcessing(false); setRecording(false); setPaused(false);
        return;
      }

      console.log(`Sending audio for transcription (is_final: ${!recording})`);

      const response = await fetch('http://localhost:3000/api/transcription/process', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        let detail = `Server error: ${response.status}.`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.detail) detail = errorJson.error.detail;
        } catch (e) { /* Not JSON */ }
        throw new Error(detail.substring(0, 150));
      }

      const data = await response.json();
      // If server sends an error fallback or an error within the segment
      if (data.isErrorFallback || data.segment?.error) {
        console.warn('Received error from server for segment:', data.segment?.errorDetail || data.segment?.text);
        const errorMsg = data.segment?.text || "Transcription error for segment.";
        if (onTranscriptionUpdate) {
            // Send error text to parent to display if desired
            onTranscriptionUpdate(` [Error: ${errorMsg.substring(0,100)}]`, { 
                id: data.segment?.id || `error-${Date.now()}`, 
                error: true, 
                isFinal: !recording 
            });
        }
      } else if (data?.segment?.text) {
        const newTextSegment = data.segment.text;
        console.log('Transcription segment received:', newTextSegment.substring(0, 50) + "...");
        if (onTranscriptionUpdate) {
          // Pass ONLY the new segment text and details to the parent
          onTranscriptionUpdate(newTextSegment, {
            id: data.segment.id || `segment-${Date.now()}`,
            // text: newTextSegment, // The first arg to onTranscriptionUpdate is now the text
            timestamp: data.segment.timestamp || new Date().toISOString(),
            isFinal: data.segment.isFinal || !recording, // Mark as final if overall recording stopped
          });
        }
        if (error) setError(''); // Clear general error on success
      } else {
        console.log('Transcription segment was empty or had no text (no error reported by server).');
      }
    } catch (err) {
      console.error('Error in processAudioChunk:', err);
      setError(`Transcription error: ${err.message}.`);
      // Basic retry logic for network-like errors
      if (err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('failed to fetch')) {
        if (recording || paused) { // Only re-queue if session is still active
          console.warn('Network-like error, re-queueing chunks.');
          audioChunksRef.current = [...chunksForThisProcess, ...audioChunksRef.current];
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to fully stop the recording session
  const stopRecording = async () => {
    console.log('stopRecording called. MediaRecorder state:', mediaRecorderRef.current?.state);
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      setRecording(false); setPaused(false); setIsProcessing(false);
      cleanupAfterRecordingStopped();
      return;
    }

    setIsProcessing(true);
    setRecording(false); // User intends to stop the entire session
    setPaused(false);

    if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
      console.log('Stopping MediaRecorder (will trigger onstop for final processing)...');
      
      // Detach previous onstop if any, and set a new one for final actions
      mediaRecorderRef.current.onstop = async () => {
        console.log('[MediaRecorder] Final onstop after user clicked Stop Recording.');
        await processAudioChunk(); // Process any final buffered data
        cleanupAfterRecordingStopped();
        setIsProcessing(false); 
      };

      if (mediaRecorderRef.current.state === 'paused') {
        try { mediaRecorderRef.current.resume(); console.log('[Recorder] Resumed from pause to execute stop.'); }
        catch (e) { console.error('[Recorder] Error resuming from pause during stop:', e); }
      }
      if (mediaRecorderRef.current.state === 'recording') { // Check again after potential resume
        try { mediaRecorderRef.current.requestData(); console.log('[Recorder] Requested final data.'); }
        catch (e) { console.warn('[Recorder] Error requesting final data during stop:', e); }
      }
      try { mediaRecorderRef.current.stop(); } 
      catch (e) { 
        console.error('[Recorder] Error calling MediaRecorder.stop():', e);
        cleanupAfterRecordingStopped(); // Ensure cleanup if stop() itself errors
        setIsProcessing(false);
      }
    } else {
      cleanupAfterRecordingStopped();
      setIsProcessing(false);
    }
  };

  // Centralized cleanup function
  const cleanupAfterRecordingStopped = () => {
    console.log('Cleaning up resources (audio context, stream, refs).');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.ondataavailable = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
      }
      mediaRecorderRef.current = null;
    }
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    recordingIntervalRef.current = null;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(err => console.error("Error closing AudioContext in cleanup:", err));
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    audioChunksRef.current = [];
    console.log('Cleanup complete.');
  };

  // Function to pause the current recording
  const pauseRecording = async () => {
    console.log('pauseRecording called. MediaRecorder state:', mediaRecorderRef.current?.state);
    if (!mediaRecorderRef.current || !recording || paused || mediaRecorderRef.current.state !== 'recording') {
      console.log('Cannot pause. Conditions not met.');
      return;
    }
    try {
      console.log('[Recorder] Attempting to pause MediaRecorder.');
      // For pause, we simply pause the MediaRecorder.
      // Audio chunks will be processed by the timeslice's onstop, or when fully stopped.
      mediaRecorderRef.current.pause();
      setPaused(true);
      console.log('MediaRecorder paused. Visualizer will freeze.');
    } catch (err) {
      console.error('Error pausing recording:', err);
      setError(`Failed to pause: ${err.message}.`);
    }
  };

  // Function to resume a paused recording
  const resumeRecording = async () => {
    console.log('resumeRecording called. MediaRecorder state:', mediaRecorderRef.current?.state);
    if (!mediaRecorderRef.current || !recording || !paused || mediaRecorderRef.current.state !== 'paused') {
      console.log('Cannot resume. Conditions not met.');
      return;
    }
    try {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      mediaRecorderRef.current.resume();
      setPaused(false);
      console.log('MediaRecorder resumed. Restarting visualization loop.');
      if (!animationFrameRef.current) {
        visualize();
      }
    } catch (err) {
      console.error('Error resuming recording:', err);
      setError(`Failed to resume: ${err.message}.`);
    }
  };
  
  // JSX for the component's UI
  return (
    <Box sx={{ mb: 4, p:2, border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, gap: 2 }}>
        <ActionButton
          variant={recording ? "outlined" : "contained"}
          color={recording ? "error" : "primary"}
          onClick={recording ? stopRecording : startRecording}
          disabled={isProcessing && !recording && !paused} 
          startIcon={isProcessing && recording ? <CircularProgress size={20} color="inherit"/> : (recording ? <StopIcon /> : <MicIcon />)}
          sx={{ minWidth: '180px', height: '48px', fontSize: '1rem' }}
        >
          {isProcessing && recording ? "Processing..." : (recording ? "Stop Recording" : "Start Recording")}
        </ActionButton>

        {recording && (
          <ActionButton
            onClick={paused ? resumeRecording : pauseRecording}
            variant="outlined"
            color="info"
            disabled={isProcessing} 
            startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
            sx={{ minWidth: '120px', height: '48px', fontSize: '1rem' }}
          >
            {paused ? "Resume" : "Pause"}
          </ActionButton>
        )}
      </Box>

      {isProcessing && !recording && !paused && <Box sx={{textAlign: 'center', my:1}}><CircularProgress size={24} /><Typography variant="caption" display="block">Finalizing...</Typography></Box>}
      
      {recording && ( 
        <RecordingIndicator isRecording={!paused}> 
          <RecordingDot isRecording={!paused} />
          <Typography variant="body2" sx={{ color: paused ? '#555' : '#ff5252', fontWeight: 'bold' }}>
            {paused ? "Paused " : "Recording "}{formatTime(recordingTime)}
          </Typography>
        </RecordingIndicator>
      )}

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2, textAlign: 'center', p:1, backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: '4px' }}>
          {error}
        </Typography>
      )}
      
      <VisualizerCanvas ref={canvasRef} sx={{ mt: 2 }} /> 

      {/* The parent component (Transcription.js) will be responsible for displaying the full transcript */}
      {/* This MeetingRecorder component only calls onTranscriptionUpdate with new segments. */}
      {/* We can show a placeholder or status here if needed, but the main transcript is in the parent. */}
      {recording && !paused && !isProcessing && (
         <Typography variant="caption" display="block" textAlign="center" sx={{mt:1, color: 'text.secondary'}}>
            Listening... New transcript segments appear every 30 seconds.
         </Typography>
      )}
       {recording && paused && (
         <Typography variant="caption" display="block" textAlign="center" sx={{mt:1, color: 'text.secondary'}}>
            Recording paused.
         </Typography>
      )}

    </Box>
  );
};

export default MeetingRecorder;
