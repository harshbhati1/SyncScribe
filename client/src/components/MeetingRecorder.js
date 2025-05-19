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
const MeetingRecorder = ({ onTranscriptionUpdate }) => {
  // State variables to manage component's behavior and UI
  const [recording, setRecording] = useState(false); // Is actively recording (not paused, not stopped)
  const [paused, setPaused] = useState(false);     // Is recording paused?
  const [fullTranscript, setFullTranscript] = useState(''); // Stores the entire transcription
  const [isProcessing, setIsProcessing] = useState(false);  // Is an audio chunk being processed?
  const [error, setError] = useState('');                   // Stores any error messages
  const [recordingTime, setRecordingTime] = useState(0);    // Duration of the current recording in seconds

  // Refs to hold mutable values that don't trigger re-renders on change
  const mediaRecorderRef = useRef(null);      // Holds the MediaRecorder instance
  const audioChunksRef = useRef([]);          // Stores chunks of recorded audio data
  const recordingIntervalRef = useRef(null);  // Interval ID for the recording timer
  const recordingTimeRef = useRef(0);         // Actual recording time in seconds (updated by interval)
  const canvasRef = useRef(null);             // Ref for the visualizer canvas element
  const audioContextRef = useRef(null);       // Ref for the Web Audio API AudioContext
  const analyserRef = useRef(null);           // Ref for the AnalyserNode for visualization
  const animationFrameRef = useRef(null);     // Ref for the requestAnimationFrame ID

  // Helper function to format seconds into MM:SS string
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Effect to manage the recording timer
  useEffect(() => {
    // If we are recording and not paused, start/update the timer
    if (recording && !paused) {
      // Clear any existing interval to prevent multiple timers
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      // Set up a new interval to increment the recording time every second
      recordingIntervalRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current); // Update state to re-render time display
      }, 1000);
    } else {
      // If not recording or if paused, clear the interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
    // Cleanup function: clear interval when component unmounts or dependencies change
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [recording, paused]); // Re-run effect if 'recording' or 'paused' state changes

  // Effect for cleaning up resources when the component unmounts
  useEffect(() => {
    return () => {
      // If MediaRecorder is active, stop it
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      // Clear recording timer interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      // Cancel any pending animation frame for the visualizer
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Close the AudioContext if it exists and is not already closed
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.error("Error closing audio context on unmount:", err));
        audioContextRef.current = null;
      }
      // Stop any media stream tracks
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // Function to request microphone permission from the user
  const requestMicrophonePermission = async () => {
    try {
      // Use Web API to get access to user's audio input
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return stream; // Return the MediaStream if successful
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone access denied. Please grant permission to use this feature.');
      return null; // Return null if permission is denied or an error occurs
    }
  };

  // Function to initialize the audio visualizer
  const initializeVisualizer = async (stream) => {
    try {
      // If an old AudioContext exists, close it before creating a new one
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }
      // Get the AudioContext class (browser-prefixed if necessary)
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 44100 });

      // Some browsers start AudioContext in a 'suspended' state, try to resume it
      if (audioContextRef.current.state === 'suspended') {
        console.log('[Visualizer] AudioContext is suspended, attempting to resume...');
        await audioContextRef.current.resume();
      }
      console.log('[Visualizer] AudioContext state:', audioContextRef.current.state);


      // Create an AnalyserNode to get audio data
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048; // Number of samples for FFT (determines data points for waveform)
      analyserRef.current.smoothingTimeConstant = 0; // No smoothing for time domain data

      // Create a MediaStreamSource from the microphone stream and connect it to the analyser
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Cancel any previous animation frame to avoid multiple loops
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Start the visualization drawing loop
      console.log('[Visualizer] Initializing visualization loop.');
      visualize();
      return true;
    } catch (err) {
      console.error('Error initializing audio visualizer:', err);
      setError('Failed to initialize audio visualization. Please try again.');
      return false;
    }
  };

  // Main function to draw the audio waveform on the canvas
  const visualize = useCallback(() => {
    // If component is paused, or refs are not ready, stop the animation loop for now
    if (paused || !canvasRef.current || !analyserRef.current) {
      // If not paused but refs are missing, we might still be setting up, so request another frame.
      // If paused, we don't request another frame, effectively stopping the loop.
      if (!paused && (!canvasRef.current || !analyserRef.current)) {
         console.log('[Visualizer] Canvas or Analyser not ready, or paused. Paused:', paused);
         animationFrameRef.current = requestAnimationFrame(visualize);
      } else if (paused) {
         console.log('[Visualizer] Visualization paused.');
      }
      return;
    }
    
    // Check AudioContext state again, try to resume if suspended
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.warn('[Visualizer] AudioContext was suspended. Trying to resume for visualization.');
        audioContextRef.current.resume().then(() => {
            console.log('[Visualizer] AudioContext resumed successfully during visualization.');
        }).catch(e => console.error('[Visualizer] Error resuming AudioContext during visualization:', e));
        // We might skip this frame and let the next one try after resume
        animationFrameRef.current = requestAnimationFrame(visualize);
        return;
    }


    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');

    // Ensure canvas internal resolution matches its display size
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas with a white background
    canvasCtx.fillStyle = 'white';
    canvasCtx.fillRect(0, 0, width, height);

    // Draw a faint horizontal center line
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = '#e0e0e0';
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, height / 2);
    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();

    // Get audio time domain data from the analyser
    const bufferLength = analyserRef.current.fftSize; // Use fftSize for time domain data buffer
    const timeDomainDataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(timeDomainDataArray);
    
    // Log a small sample of the raw data to check if we're getting anything other than silence (128)
    // console.log('[Visualizer] Raw audio data sample:', timeDomainDataArray.slice(0, 5));


    // If recording, amplify the signal to make quiet sounds more visible
    if (recording && !paused) { // Only amplify if actively recording and not paused
      const amplificationFactor = 8.0; // Adjust for more/less sensitivity
      for (let i = 0; i < timeDomainDataArray.length; i++) {
        const deviation = timeDomainDataArray[i] - 128; // 128 is the zero-point for Uint8Array
        timeDomainDataArray[i] = 128 + deviation * amplificationFactor;
        // Clamp values to the valid 0-255 range
        timeDomainDataArray[i] = Math.max(0, Math.min(255, timeDomainDataArray[i]));
      }
    }
    // Log a small sample of the amplified data
    // if (recording && !paused) console.log('[Visualizer] Amplified audio data sample:', timeDomainDataArray.slice(0, 5));


    // Begin drawing the waveform path
    canvasCtx.beginPath();
    canvasCtx.lineWidth = 2; // Thickness of the waveform line
    // Waveform color: orange if recording and not paused, otherwise gray
    canvasCtx.strokeStyle = (recording && !paused) ? '#ff7300' : '#cccccc';

    const sliceWidth = width / timeDomainDataArray.length; // Width of each data point on canvas
    let x = 0; // Current x-coordinate on canvas

    // Loop through the data array to draw the waveform
    for (let i = 0; i < timeDomainDataArray.length; i++) {
      // Normalize data (0-255) to a range around 1.0 (for scaling)
      const v = timeDomainDataArray[i] / 128.0;
      // Scale to canvas height, centered around height/2
      const y = v * height / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y); // Starting point of the line
      } else {
        canvasCtx.lineTo(x, y); // Draw line to the next point
      }
      x += sliceWidth; // Move to the next x-coordinate
    }
    canvasCtx.lineTo(width, height / 2); // Ensure line reaches the end of the canvas
    canvasCtx.stroke(); // Render the waveform

    // Request the next frame to continue the animation loop
    animationFrameRef.current = requestAnimationFrame(visualize);
  }, [recording, paused]); // Re-create this callback if 'recording' or 'paused' changes

  // Function to start the recording process
  const startRecording = async () => {
    try {
      console.log('[Recorder] Attempting to start recording...');
      setError('');
      setIsProcessing(true); // Indicate processing while setting up
      setFullTranscript(''); // Clear any previous transcript
      setPaused(false); // Ensure not in paused state when starting new recording
      if(onTranscriptionUpdate) onTranscriptionUpdate('', null); // Notify parent about reset

      // Stop and clean up any existing MediaRecorder instance
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
        if (mediaRecorderRef.current.stream) mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
      }
      audioChunksRef.current = []; // Clear previous audio chunks

      // Get microphone permission and the audio stream
      const stream = await requestMicrophonePermission();
      if (!stream) {
        setIsProcessing(false); // Stop processing if no stream
        return;
      }

      // Check if microphone track is muted
      if (stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].muted) {
          console.warn('[Recorder] Warning: Microphone track is muted!');
          setError('Your microphone appears to be muted. Please unmute it in your system settings or browser.');
          // Optionally, don't proceed if muted, or allow user to start anyway
      }

      // Set MediaRecorder options (codec, bitrate)
      let options = { audioBitsPerSecond: 128000 };
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      } // Add more fallbacks if needed (e.g., audio/mp4)
      console.log('[Recorder] Using MediaRecorder options:', options);

      // Create and configure the MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      await initializeVisualizer(stream); // Initialize visualizer with the new stream

      // Event handler for when audio data is available
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Reset recording timer
      recordingTimeRef.current = 0;
      setRecordingTime(0);

      // Event handler for when MediaRecorder stops (either by chunk interval or manual stop)
      mediaRecorderRef.current.onstop = async () => {
        console.log('[MediaRecorder] onstop event. Recording state:', recording, 'Paused state:', paused);
        await processAudioChunk(); // Process the accumulated audio

        // If still in 'recording' mode (not manually stopped) and stream is active, restart for next chunk
        if (recording && !paused && stream && stream.active) { // Added !paused check
          console.log('[MediaRecorder] Restarting recording for next chunk...');
          try {
             let currentOptions = { audioBitsPerSecond: 128000 };
             // Try to reuse the mimeType if the ref still exists and has it
             if (mediaRecorderRef.current && mediaRecorderRef.current.mimeType) {
                 currentOptions.mimeType = mediaRecorderRef.current.mimeType;
             } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                 currentOptions.mimeType = 'audio/webm;codecs=opus';
             }
            // Re-create MediaRecorder for robustness, especially if previous one was nulled
            mediaRecorderRef.current = new MediaRecorder(stream, currentOptions);
            mediaRecorderRef.current.ondataavailable = (event) => {
              if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = mediaRecorderRef.current.onstop; // Point to the same handler logic
            mediaRecorderRef.current.start(5000); // Start collecting next 5s chunk
          } catch (restartErr) {
            console.error('Error restarting MediaRecorder:', restartErr);
            setError('Error during recording. Please try again.');
            setRecording(false); // Stop if restart fails
            setPaused(false);
            if (stream && stream.getTracks) stream.getTracks().forEach(track => track.stop()); // Clean up stream
          }
        } else if (!recording || paused) {
            console.log('[MediaRecorder] Not restarting: Recording manually stopped, paused, or stream inactive.');
        }
      };

      // Start the recording, collecting data in 5-second intervals (timeslice)
      mediaRecorderRef.current.start(5000);
      setRecording(true); // Update state to reflect recording has started
      setPaused(false);   // Ensure not paused when starting
      setIsProcessing(false); // Done with initial setup processing

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`Failed to start recording: ${err.message}. Please ensure microphone access.`);
      setIsProcessing(false);
    }
  };

  // Function to process a collected audio chunk for transcription
  const processAudioChunk = async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('No audio chunks to process for this interval.');
      return; // Nothing to do
    }

    setIsProcessing(true); // Indicate that a chunk is being processed
    // Determine blob type from MediaRecorder or default to a good one for voice
    const blobType = (mediaRecorderRef.current && mediaRecorderRef.current.mimeType) ?
                     mediaRecorderRef.current.mimeType :
                     'audio/webm;codecs=opus';
    const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
    audioChunksRef.current = []; // Clear chunks for the next interval

    console.log(`Processing audio blob of type ${blobType}, size: ${(audioBlob.size / 1024).toFixed(2)} KB`);

    if (audioBlob.size === 0) {
      console.warn('Audio blob is empty. Skipping API call.');
      setIsProcessing(false);
      return;
    }

    try {
      // Create FormData to send the audio blob as a file
      const formData = new FormData();
      const fileExtension = blobType.split('/')[1]?.split(';')[0] || 'webm'; // Get extension like 'webm' or 'mp4'
      formData.append('audio_data', audioBlob, `recording-${Date.now()}.${fileExtension}`);

      // Get authentication token (assuming it's stored in localStorage)
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required. Please log in.');
        setIsProcessing(false);
        setRecording(false); // Stop recording if not authenticated
        setPaused(false);
        return;
      }

      // Make the API call to the backend for transcription
      const response = await fetch('http://localhost:3000/api/transcription/process', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // Send token for authentication
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text(); // Get error details from server
        console.error('Server error response:', errorData);
        throw new Error(`Server error: ${response.status} ${response.statusText}. Details: ${errorData.substring(0,100)}`);
      }

      const data = await response.json(); // Parse JSON response from server
      // If transcription text is received, update the UI
      if (data?.segment?.text) {
        const newText = data.segment.text;
        setFullTranscript(prev => {
          const updatedTranscript = prev ? `${prev} ${newText}`.trim() : newText;
          // Call parent callback with the updated transcript and segment details
          if (onTranscriptionUpdate) {
            onTranscriptionUpdate(updatedTranscript, {
              id: data.segment.id || `segment-${Date.now()}`,
              text: newText,
              timestamp: data.segment.timestamp || new Date().toISOString(),
              isFinal: data.segment.isFinal || false
            });
          }
          return updatedTranscript;
        });
        if(error) setError(''); // Clear any previous error on success
      } else {
        console.log('Transcription segment was empty or had no text.');
      }
    } catch (err) {
      console.error('Error sending/processing audio chunk:', err);
      setError(`Transcription error: ${err.message}. Some audio may not have been processed.`);
    } finally {
      setIsProcessing(false); // Done processing this chunk
    }
  };

  // Function to stop the recording entirely
  const stopRecording = async () => {
    console.log('stopRecording called. MediaRecorder state:', mediaRecorderRef.current?.state);
    // If no MediaRecorder or it's already inactive, just update UI state
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      setRecording(false);
      setPaused(false);
      setIsProcessing(false);
      // Ensure visualizer stops if it was somehow running
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(e => console.error("Error closing AudioContext in stopRecording (inactive):", e));
          audioContextRef.current = null; // Nullify to prevent reuse
          analyserRef.current = null;
      }
      return;
    }

    setIsProcessing(true); // Indicate we are processing the stop action
    setRecording(false);   // Update recording state immediately
    setPaused(false);      // Ensure pause state is also reset

    // If MediaRecorder is 'recording' or 'paused', stop it.
    // This will trigger its 'onstop' event handler.
    if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
        console.log('Stopping MediaRecorder...');
        // The onstop handler is now responsible for final processing and cleanupAfterRecordingStopped
        mediaRecorderRef.current.onstop = async () => {
            console.log('[MediaRecorder] Final onstop triggered after manual stop call.');
            await processAudioChunk(); // Process any last bit of data
            cleanupAfterRecordingStopped(); // Perform full cleanup
            setIsProcessing(false); // Final processing done
        };
        mediaRecorderRef.current.stop();
    } else {
        // If it's in some other state (shouldn't happen if logic is correct), cleanup directly
        cleanupAfterRecordingStopped();
        setIsProcessing(false);
    }
  };

  // Helper function to clean up all resources after recording has fully stopped
  const cleanupAfterRecordingStopped = () => {
    console.log('Cleaning up resources after recording stopped.');
    // Stop media stream tracks
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    mediaRecorderRef.current = null; // Clear the MediaRecorder ref

    // Clear recording timer
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    // Stop visualizer animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(err => console.error("Error closing AudioContext post-recording:", err));
    }
    audioContextRef.current = null; // Clear AudioContext and AnalyserNode refs
    analyserRef.current = null;
    audioChunksRef.current = []; // Clear any remaining audio chunks
  };


  // Function to pause the current recording
  const pauseRecording = async () => {
    console.log('pauseRecording called. MediaRecorder state:', mediaRecorderRef.current?.state);
    // Can only pause if there's an active MediaRecorder and we are in 'recording' (not already paused) state
    if (!mediaRecorderRef.current || !recording || paused) {
      return;
    }

    try {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause(); // Pause the MediaRecorder
        setPaused(true); // Update state to reflect paused status
        console.log('MediaRecorder paused. Visualization loop will stop via `paused` flag.');
        // The visualize function will see `paused` is true and stop requesting new frames.
      }
    } catch (err) {
      console.error('Error pausing recording:', err);
      setError(`Failed to pause recording: ${err.message}.`);
    }
  };

  // Function to resume a paused recording
  const resumeRecording = async () => {
    console.log('resumeRecording called. MediaRecorder state:', mediaRecorderRef.current?.state);
    // Can only resume if there's an active MediaRecorder, we were 'recording', and it's currently 'paused'
    if (!mediaRecorderRef.current || !recording || !paused) {
      return;
    }

    try {
      if (mediaRecorderRef.current.state === 'paused') {
        // Before resuming MediaRecorder, ensure AudioContext is active
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            console.log('[Recorder] Resuming AudioContext before resuming MediaRecorder...');
            await audioContextRef.current.resume();
        }
        mediaRecorderRef.current.resume(); // Resume the MediaRecorder
        setPaused(false); // Update state
        console.log('MediaRecorder resumed. Restarting visualization loop.');
        // Explicitly restart the visualization loop because it was stopped by the `paused` flag
        if (!animationFrameRef.current) { // Check if it's not already running (it shouldn't be if paused)
            visualize();
        }
      }
    } catch (err) {
      console.error('Error resuming recording:', err);
      setError(`Failed to resume recording: ${err.message}.`);
      // If resume fails, might need to reset paused state or stop recording
      setPaused(true); // Keep it paused if resume fails
    }
  };
  

  // UI Rendering
  return (
    <Box sx={{ mb: 4, p:2, border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      {/* Main action buttons: Start/Stop and Pause/Resume */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, gap: 2 }}>
        <ActionButton
          variant={recording ? "outlined" : "contained"}
          color={recording ? "error" : "primary"}
          onClick={recording ? stopRecording : startRecording}
          // Disable start if processing a stop, allow stopping even if processing a chunk
          disabled={isProcessing && !recording} 
          startIcon={isProcessing && recording ? <CircularProgress size={20} color="inherit"/> : (recording ? <StopIcon /> : <MicIcon />)}
          sx={{ minWidth: '180px', height: '48px', fontSize: '1rem' }}
        >
          {/* Dynamic button text based on state */}
          {isProcessing && recording ? "Processing..." : (recording ? "Stop Recording" : "Start Recording")}
        </ActionButton>

        {/* Show Pause/Resume button only when actively recording */}
        {recording && (
          <ActionButton
            onClick={paused ? resumeRecording : pauseRecording}
            variant="outlined"
            color="info" // Changed color for better distinction
            disabled={isProcessing} // Disable if any processing is happening
            startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
            sx={{ minWidth: '120px', height: '48px', fontSize: '1rem' }}
          >
            {paused ? "Resume" : "Pause"}
          </ActionButton>
        )}
      </Box>

      {/* Indicator when finalizing after stop */}
      {isProcessing && !recording && <Box sx={{textAlign: 'center', my:1}}><CircularProgress size={24} /><Typography variant="caption" display="block">Finalizing...</Typography></Box>}
      
      {/* Recording status indicator (dot and time) */}
      {recording && ( // Show only when 'recording' state is true (active or paused)
        <RecordingIndicator isRecording={!paused}> {/* Pulse dot only if not paused */}
          <RecordingDot isRecording={!paused} />
          <Typography variant="body2" sx={{ color: paused ? '#666' : '#ff5252', fontWeight: 'bold' }}>
            {paused ? "Paused " : "Recording "}{formatTime(recordingTime)}
          </Typography>
        </RecordingIndicator>
      )}

      {/* Error message display */}
      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2, textAlign: 'center', p:1, backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: '4px' }}>
          {error}
        </Typography>
      )}
      
      {/* Waveform visualizer canvas */}
      <VisualizerCanvas ref={canvasRef} sx={{ mt: 2 }} /> 

      {/* Display for the full transcription */}
      {fullTranscript && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <Typography variant="h6" gutterBottom sx={{color: '#333'}}>
            Live Transcription
          </Typography>
          <Typography variant="body1" sx={{whiteSpace: 'pre-wrap', color: '#555'}}>
            {fullTranscript}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MeetingRecorder;
