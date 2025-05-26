import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';

// Styled components (Keep as is)
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
    '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 82, 82, 0.7)'},
    '70%': { transform: 'scale(1)', boxShadow: '0 0 0 5px rgba(255, 82, 82, 0)'},
    '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 82, 82, 0)'},
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

// WAV Encoding Helper Functions
function pcmToWavBlob(pcmData, sampleRate, numChannels = 1, bitDepth = 16) {
  const format = 1; // PCM
  const subChunk1Size = 16; // For PCM
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const subChunk2Size = pcmData.length * (bitDepth / 8); 
  const chunkSize = 36 + subChunk2Size;

  const buffer = new ArrayBuffer(44 + subChunk2Size);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, chunkSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, subChunk1Size, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, subChunk2Size, true);

  let offset = 44;
  if (bitDepth === 16) {
    for (let i = 0; i < pcmData.length; i++) {
      const s = Math.max(-1, Math.min(1, pcmData[i])); 
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  } else if (bitDepth === 8) {
    for (let i = 0; i < pcmData.length; i++) {
      const s = Math.max(-1, Math.min(1, pcmData[i]));
      view.setUint8(offset, (s + 1) * 127.5); 
      offset += 1;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}


const MeetingRecorder = ({ onTranscriptionUpdate }) => {
  const [recording, setRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); 
  const [isFinalizing, setIsFinalizing] = useState(false); // True only when the *final* chunk is processing after stop
  const [error, setError] = useState('');
  const [displayTime, setDisplayTime] = useState(0);

  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const mediaStreamSourceNodeRef = useRef(null);
  const scriptProcessorNodeRef = useRef(null);
  const pcmDataQueueRef = useRef([]); 
  
  const chunkIntervalIdRef = useRef(null);
  const displayTimerIntervalRef = useRef(null);
  const CHUNK_DURATION = 30000; 
  const TARGET_SAMPLE_RATE = 16000; 

  const recordingRef = useRef(recording);
  useEffect(() => { recordingRef.current = recording; }, [recording]);

  const canvasRef = useRef(null);
  const analyserNodeRef = useRef(null); 
  const visualizerAnimationRef = useRef(null);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (recording) {
      if (displayTimerIntervalRef.current) clearInterval(displayTimerIntervalRef.current);
      displayTimerIntervalRef.current = setInterval(() => setDisplayTime(prev => prev + 1), 1000);
    } else {
      if (displayTimerIntervalRef.current) clearInterval(displayTimerIntervalRef.current);
    }
    return () => { if (displayTimerIntervalRef.current) clearInterval(displayTimerIntervalRef.current); };
  }, [recording]);

  const requestMicrophonePermission = async () => {
    if (streamRef.current && streamRef.current.active) {
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length > 0 && audioTracks.every(t => t.enabled && t.readyState === 'live')) {
        return streamRef.current;
      }
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone access denied.');
      return null;
    }
  };

  const initializeAudioVisualizer = useCallback(async (audioCtx, sourceNode) => {
    if (!audioCtx || !sourceNode || !canvasRef.current) return false;
    try {
      if (analyserNodeRef.current) analyserNodeRef.current.disconnect(); // Disconnect old one if exists
      analyserNodeRef.current = audioCtx.createAnalyser();
      analyserNodeRef.current.fftSize = 2048;
      sourceNode.connect(analyserNodeRef.current);
      return true;
    } catch (err) { console.error('Error initializing visualizer:', err); return false; }
  }, []);

  const drawVisualization = useCallback(() => {
    if (!analyserNodeRef.current || !canvasRef.current || !audioContextRef.current || audioContextRef.current.state === 'closed') {
      if (visualizerAnimationRef.current) cancelAnimationFrame(visualizerAnimationRef.current);
      visualizerAnimationRef.current = null;
      return;
    }
     if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(e => console.warn('Visualize: resume failed', e));
    }
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    const bufferLength = analyserNodeRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    canvasCtx.fillStyle = 'rgb(255, 255, 255)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    if (recordingRef.current && analyserNodeRef.current.getByteTimeDomainData) {
        analyserNodeRef.current.getByteTimeDomainData(dataArray);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(255, 115, 0)';
        canvasCtx.beginPath();
        const sliceWidth = WIDTH * 1.0 / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * HEIGHT / 2;
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        canvasCtx.lineTo(WIDTH, HEIGHT / 2);
        canvasCtx.stroke();
    } else { 
        canvasCtx.lineWidth = 1;
        canvasCtx.strokeStyle = 'rgb(204, 204, 204)';
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, HEIGHT / 2);
        canvasCtx.lineTo(WIDTH, HEIGHT / 2);
        canvasCtx.stroke();
    }
    if (recordingRef.current) {
        visualizerAnimationRef.current = requestAnimationFrame(drawVisualization);
    } else {
        if (visualizerAnimationRef.current) cancelAnimationFrame(visualizerAnimationRef.current);
        visualizerAnimationRef.current = null;
    }
  }, []); 

  useEffect(() => { 
    if (recordingRef.current && mediaStreamSourceNodeRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
      if (!analyserNodeRef.current && canvasRef.current) {
        initializeAudioVisualizer(audioContextRef.current, mediaStreamSourceNodeRef.current).then(success => {
          if (success && recordingRef.current) { 
            if (visualizerAnimationRef.current) cancelAnimationFrame(visualizerAnimationRef.current);
            visualizerAnimationRef.current = requestAnimationFrame(drawVisualization);
          }
        });
      } else if (analyserNodeRef.current && canvasRef.current) {
         if (visualizerAnimationRef.current) cancelAnimationFrame(visualizerAnimationRef.current);
         visualizerAnimationRef.current = requestAnimationFrame(drawVisualization);
      }
    } else {
      if (visualizerAnimationRef.current) {
        cancelAnimationFrame(visualizerAnimationRef.current);
        visualizerAnimationRef.current = null;
      }
      if(canvasRef.current && (!audioContextRef.current || audioContextRef.current.state !== 'running' || !recordingRef.current)) {
        drawVisualization(); // Draw idle state
      }
    }
    return () => { 
      if (visualizerAnimationRef.current) cancelAnimationFrame(visualizerAnimationRef.current);
    };
  }, [recording, initializeAudioVisualizer, drawVisualization]); 

  const processAudioChunkRef = useRef(null);
  const handleStopOverallRecordingRef = useRef(null);

  const cleanupAudioProcessing = useCallback((stopStreamTracks = true) => {
    console.log('[Recorder] cleanupAudioProcessing called. stopStreamTracks:', stopStreamTracks);
    if (chunkIntervalIdRef.current) clearInterval(chunkIntervalIdRef.current);
    chunkIntervalIdRef.current = null;

    if (scriptProcessorNodeRef.current) {
      scriptProcessorNodeRef.current.onaudioprocess = null;
      scriptProcessorNodeRef.current.disconnect();
      scriptProcessorNodeRef.current = null;
    }
    if (mediaStreamSourceNodeRef.current) {
      mediaStreamSourceNodeRef.current.disconnect();
      mediaStreamSourceNodeRef.current = null;
    }
    if (analyserNodeRef.current) {
        analyserNodeRef.current.disconnect();
        analyserNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.warn("Error closing AudioContext:", e));
      audioContextRef.current = null;
    }
    if (stopStreamTracks && streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    pcmDataQueueRef.current = [];
    console.log("[Recorder] Web Audio API resources cleaned up.");
  }, []);

  const internalProcessAudioChunk = useCallback(async (audioBlob, isFinalSessionChunk) => {
    if (!audioBlob || audioBlob.size < (audioBlob.type === 'audio/wav' ? 1000 : 100) ) {
      console.warn('[Recorder] processAudioChunk: Blob too small or null.', {size: audioBlob?.size, type: audioBlob?.type, isFinal: isFinalSessionChunk});
      if (isFinalSessionChunk) {
        setIsProcessingAudio(false);
        setIsFinalizing(false);
      }
      return;
    }
    
    setIsProcessingAudio(true); 
    if(isFinalSessionChunk) setIsFinalizing(true);

    console.log(`[Recorder] processAudioChunk: Processing blob (type: ${audioBlob.type}, size: ${(audioBlob.size / 1024).toFixed(2)} KB), isFinal: ${isFinalSessionChunk}`);

    try {
      const formData = new FormData();
      const fileExtension = audioBlob.type.split('/')[1] || 'bin';
      formData.append('audio_data', audioBlob, `rec-${Date.now()}.${fileExtension}`);
      formData.append('is_final', String(isFinalSessionChunk));
      formData.append('timestamp', new Date().toISOString());
      formData.append('recording_time', String(displayTime));

      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required.');
        if (recordingRef.current && handleStopOverallRecordingRef.current) {
             handleStopOverallRecordingRef.current();
        }
        throw new Error("Auth token not found");
      }
      
      console.log(`[Recorder] Sending ${audioBlob.type} audio (is_final: ${isFinalSessionChunk}) to backend.`);
      const response = await fetch('https://twinmind-14ro.onrender.com/api/transcription/process', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error in processAudioChunk:', {status: response.status, text: errorText});
        throw new Error(`Server error: ${response.status}`);
      }
      const data = await response.json();
      console.log('[Recorder] Received data from backend:', data);
      if (onTranscriptionUpdate && (data.segment?.text !== undefined || (isFinalSessionChunk && data.segment))) {
        onTranscriptionUpdate(data.segment.text || "", {
          isFinal: data.segment?.isFinal || isFinalSessionChunk,
          id: data.segment?.id,
          timestamp: data.segment?.timestamp,
          type: 'segment' 
        });
      }
    } catch (err) {
      console.error('Error in processAudioChunk API call:', err);
      setError(`Transcription error: ${err.message}.`);
       if (onTranscriptionUpdate) {
        onTranscriptionUpdate(`[Error: ${err.message.substring(0,50)}]`, { error: true, isFinal: isFinalSessionChunk, type: 'error' });
      }
    } finally {
      setIsProcessingAudio(false);
      if(isFinalSessionChunk) setIsFinalizing(false);
    }
  }, [onTranscriptionUpdate, displayTime]);

  const encodeAndSendCurrentAudio = useCallback(async (isFinal) => {
    if (pcmDataQueueRef.current.length === 0 && !isFinal) { 
      console.log("[Recorder] encodeAndSend: No PCM data for interim chunk.");
      return;
    }
     if (pcmDataQueueRef.current.length === 0 && isFinal) {
      console.log("[Recorder] encodeAndSend: No PCM data for final chunk.");
      if (onTranscriptionUpdate) {
        onTranscriptionUpdate("", {isFinal: true, type: 'segment_final_empty'});
      }
      // If it's final and empty, ensure processing/finalizing flags are reset
      setIsProcessingAudio(false);
      setIsFinalizing(false);
      return;
    }

    console.log(`[Recorder] encodeAndSend: Preparing to encode ${pcmDataQueueRef.current.length} PCM buffers. isFinal: ${isFinal}`);
    let totalLength = 0;
    pcmDataQueueRef.current.forEach(buffer => totalLength += buffer.length);
    
    if (totalLength === 0) {
        console.warn("[Recorder] encodeAndSend: Concatenated PCM data is empty after checking queue length.");
        if (isFinal) {
            setIsProcessingAudio(false);
            setIsFinalizing(false);
        }
        pcmDataQueueRef.current = [];
        return;
    }

    const concatenatedPcm = new Float32Array(totalLength);
    let offset = 0;
    pcmDataQueueRef.current.forEach(buffer => {
      concatenatedPcm.set(buffer, offset);
      offset += buffer.length;
    });
    pcmDataQueueRef.current = []; 

    const sampleRate = audioContextRef.current?.sampleRate || TARGET_SAMPLE_RATE;
    
    console.log(`[Recorder] encodeAndSend: Encoding WAV using JavaScript function at sampleRate: ${sampleRate}`);
    const wavBlob = pcmToWavBlob(concatenatedPcm, sampleRate); 
    await processAudioChunkRef.current?.(wavBlob, isFinal);

  }, [TARGET_SAMPLE_RATE, onTranscriptionUpdate]); 


  const handleStartOverallRecording = useCallback(async () => {
    console.log('[Recorder] User clicked Start Recording.');    setError('');
    setDisplayTime(0);
    setIsFinalizing(false); // Ensure finalizing is false when starting
    // No longer reset previous transcription - allow it to accumulate
    
    cleanupAudioProcessing(true);

    const stream = await requestMicrophonePermission();
    if (!stream) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      let createdAudioContext;
      try {
        createdAudioContext = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
      } catch (e) {
        console.warn(`Could not create AudioContext with target sample rate ${TARGET_SAMPLE_RATE}. Using default. Error: ${e.message}`);
        createdAudioContext = new AudioCtx(); 
      }
      audioContextRef.current = createdAudioContext;
      
      console.log(`[Recorder] AudioContext created. Actual sampleRate: ${audioContextRef.current.sampleRate}`);
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      mediaStreamSourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      const bufferSize = 4096; 
      scriptProcessorNodeRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1); 

      scriptProcessorNodeRef.current.onaudioprocess = (audioProcessingEvent) => {
        if (!recordingRef.current) return; 
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0); 
        pcmDataQueueRef.current.push(new Float32Array(inputData));
      };
      
      mediaStreamSourceNodeRef.current.connect(scriptProcessorNodeRef.current);
      scriptProcessorNodeRef.current.connect(audioContextRef.current.destination); 

      await initializeAudioVisualizer(audioContextRef.current, mediaStreamSourceNodeRef.current);

      setRecording(true); 

      // Notify parent that recording has started
      if (onTranscriptionUpdate) {
        onTranscriptionUpdate("", { type: "recording_started", timestamp: new Date().toISOString() });
      }

      if (chunkIntervalIdRef.current) clearInterval(chunkIntervalIdRef.current);
      chunkIntervalIdRef.current = setInterval(() => {
        if (recordingRef.current) { 
          console.log("[Recorder] 30s Interval: Encoding and sending current audio data.");
          encodeAndSendCurrentAudio(false); 
        } else {
          clearInterval(chunkIntervalIdRef.current); 
        }
      }, CHUNK_DURATION);

      console.log("[Recorder] Recording started with Web Audio API. Chunking every 30s.");

    } catch (err) {
      console.error("Error starting Web Audio recording:", err);
      setError("Failed to start audio capture: " + err.message);
      cleanupAudioProcessing(true);
      setRecording(false);
    }
  }, [onTranscriptionUpdate, initializeAudioVisualizer, cleanupAudioProcessing, CHUNK_DURATION, TARGET_SAMPLE_RATE, encodeAndSendCurrentAudio]);
  const internalHandleStopOverallRecording = useCallback(async () => {
    console.log('[Recorder] User clicked Stop Recording.');
    setRecording(false); 

    if (chunkIntervalIdRef.current) {
      clearInterval(chunkIntervalIdRef.current);
      chunkIntervalIdRef.current = null;
      console.log("[Recorder] Chunk interval timer cleared.");
    }
    
    setIsFinalizing(true); // Indicate that we are now processing the *final* chunk
    // isProcessingAudio will be set by encodeAndSendCurrentAudio/internalProcessAudioChunk
    console.log("[Recorder] Processing final audio chunk on stop.");
    await encodeAndSendCurrentAudio(true); 

    // Notify parent that recording has stopped and transcript should be auto-saved
    // We'll use a 'stopped' event type with an empty text
    if (onTranscriptionUpdate) {
      onTranscriptionUpdate("", {
        type: 'recording_stopped',
        isFinal: true,
        shouldSave: true,
        timestamp: new Date().toISOString()
      });
    }

    // Only clean up audio processing after sending the recording_stopped event
    cleanupAudioProcessing(true); 
    
    setDisplayTime(0); 
    // setIsFinalizing(false) will be handled by internalProcessAudioChunk's finally block
  }, [encodeAndSendCurrentAudio, cleanupAudioProcessing, onTranscriptionUpdate]);

  useEffect(() => { processAudioChunkRef.current = internalProcessAudioChunk; }, [internalProcessAudioChunk]);
  useEffect(() => { handleStopOverallRecordingRef.current = internalHandleStopOverallRecording; }, [internalHandleStopOverallRecording]);

  return (
    <Box 
      sx={{ mb: 4, p:2, border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}
      onClick={(e) => {
        // Make sure clicks inside the recorder component don't bubble up
        e.stopPropagation();
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, gap: 2 }}>        <ActionButton
          variant={recording ? "outlined" : "contained"}
          color={recording ? "error" : "primary"}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('[Recorder] Action button clicked, recording:', recording);
            if (recording) {
              handleStopOverallRecordingRef.current();
            } else {
              handleStartOverallRecording();
            }
          }}
          disabled={!recording && isFinalizing} // Disable "Start Recording" if previous session is still finalizing
          startIcon={
            isFinalizing ? <CircularProgress size={20} color="inherit" titleaccess="Finalizing..." /> :
            (recording ? 
              (isProcessingAudio ? <CircularProgress size={20} color="inherit" titleaccess="Processing segment..." /> : <StopIcon />) 
              : <MicIcon />)
          }
          sx={{ minWidth: '180px', height: '48px', fontSize: '1rem' }}
        >
          {isFinalizing ? "Finalizing..." : (recording ? "Stop Recording" : "Start Recording")}
        </ActionButton>
      </Box>
      
      {/* Subtle indicator for interim chunk processing when recording is active */}
      {recording && isProcessingAudio && !isFinalizing && (
        <Typography variant="caption" display="block" textAlign="center" sx={{ color: 'text.secondary', my: 0.5 }}>
          Processing audio segment...
        </Typography>
      )}
      
      {recording && (
        <RecordingIndicator isRecording={true}>
          <RecordingDot isRecording={true} />
          <Typography variant="body2" sx={{ color: '#ff5252', fontWeight: 'bold' }}>
            Recording {formatTime(displayTime)}
          </Typography>
        </RecordingIndicator>
      )}

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2, textAlign: 'center', p:1, backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: '4px' }}>
          {error}
        </Typography>
      )}
      
      <VisualizerCanvas ref={canvasRef} />
    </Box>
  );
};

export default MeetingRecorder;