import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
// Assuming you would import ffmpeg related libraries if you implement this
// import { FFmpeg } from '@ffmpeg/ffmpeg'; // Or @ffmpeg/ffmpeg/dist/esm for ESM
// import { fetchFile, toBlobURL } from '@ffmpeg/util';

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

// WAV Encoding Helper Functions (Kept for reference, but would be replaced by ffmpeg)
function pcmToWavBlobOriginal(pcmData, sampleRate, numChannels = 1, bitDepth = 16) {
  const format = 1; // PCM
  const subChunk1Size = 16; // For PCM
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const subChunk2Size = pcmData.length * (bitDepth / 8); // This assumes pcmData is already scaled to bitDepth
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
      const s = Math.max(-1, Math.min(1, pcmData[i])); // pcmData is Float32Array from -1 to 1
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  } else if (bitDepth === 8) {
    for (let i = 0; i < pcmData.length; i++) {
      const s = Math.max(-1, Math.min(1, pcmData[i]));
      view.setUint8(offset, (s + 1) * 127.5); // Convert to 0-255 range for Uint8
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

  // --- FFmpeg setup (conceptual) ---
  const ffmpegRef = useRef(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  // const loadFFmpeg = useCallback(async () => {
  //   if (ffmpegRef.current) {
  //       console.log("FFmpeg already initialized or loading.");
  //       if (!ffmpegRef.current.loaded) await ffmpegRef.current.load(); // Ensure it's loaded
  //       setFfmpegLoaded(true);
  //       return;
  //   }
  //   try {
  //       console.log("Initializing FFmpeg...");
  //       const newFFmpeg = new FFmpeg();
  //       // Example: const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  //       // await newFFmpeg.load({
  //       //   coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
  //       //   wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  //       // });
  //       // For local setup, you might need to serve these files or use a different loading mechanism.
  //       // This part is highly dependent on your project setup and how you serve ffmpeg.wasm files.
  //       // For simplicity, we'll assume it's loaded.
  //       // You'd need to implement the actual loading based on ffmpeg.wasm documentation.
  //       console.log("FFmpeg load attempt (conceptual - implement actual loading)");
  //       ffmpegRef.current = newFFmpeg; // Store the instance
  //       // ffmpegRef.current.loaded = true; // Mark as loaded after successful load
  //       setFfmpegLoaded(true); // This would be set after actual successful load
  //       console.log("FFmpeg conceptually loaded.");
  //   } catch (e) {
  //       console.error("Error loading FFmpeg:", e);
  //       setError("Failed to load audio processing tools.");
  //   }
  // }, []);

  // useEffect(() => {
  //   loadFFmpeg(); // Attempt to load FFmpeg on component mount
  //   return () => {
  //       // Optional: Terminate FFmpeg if needed, though often not necessary for client-side
  //       // if (ffmpegRef.current && ffmpegRef.current.loaded) {
  //       //   try { ffmpegRef.current.terminate(); } catch(e) {}
  //       // }
  //   }
  // }, [loadFFmpeg]);
  // --- End FFmpeg setup ---


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
      analyserNodeRef.current = audioCtx.createAnalyser();
      analyserNodeRef.current.fftSize = 2048;
      sourceNode.connect(analyserNodeRef.current);
      return true;
    } catch (err) { console.error('Error initializing visualizer:', err); return false; }
  }, []);

  const drawVisualization = useCallback(() => {
    // ... (Visualization drawing logic - keep as is, ensure it uses recordingRef.current)
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
      if(canvasRef.current) drawVisualization();
    }
    return () => { 
      if (visualizerAnimationRef.current) cancelAnimationFrame(visualizerAnimationRef.current);
    };
  }, [recording, initializeAudioVisualizer, drawVisualization]); 

  const processAudioChunkRef = useRef(null);
  const handleStopOverallRecordingRef = useRef(null); // Ref for main stop function

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
    // This function remains the same as it just sends the blob
    if (!audioBlob || audioBlob.size < (audioBlob.type === 'audio/wav' ? 1000 : 100) ) {
      console.warn('[Recorder] processAudioChunk: Blob too small or null.', {size: audioBlob?.size, type: audioBlob?.type, isFinal: isFinalSessionChunk});
      if (isFinalSessionChunk) setIsProcessingAudio(false);
      return;
    }
    setIsProcessingAudio(true);
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
        setIsProcessingAudio(false);
        if (recordingRef.current) handleStopOverallRecordingRef.current?.();
        return;
      }
      
      console.log(`[Recorder] Sending ${audioBlob.type} audio (is_final: ${isFinalSessionChunk}) to backend.`);
      const response = await fetch('http://localhost:3000/api/transcription/process', {
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
        });
      }
    } catch (err) {
      console.error('Error in processAudioChunk API call:', err);
      setError(`Transcription error: ${err.message}.`);
       if (onTranscriptionUpdate) {
        onTranscriptionUpdate(`[Error: ${err.message.substring(0,50)}]`, { error: true, isFinal: isFinalSessionChunk });
      }
    } finally {
      setIsProcessingAudio(false);
    }
  }, [onTranscriptionUpdate, displayTime]);

  const encodeAndSendCurrentAudio = useCallback(async (isFinal) => {
    if (pcmDataQueueRef.current.length === 0 && !isFinal) { // Don't send empty interim chunks
      console.log("[Recorder] encodeAndSend: No PCM data for interim chunk.");
      return;
    }
     if (pcmDataQueueRef.current.length === 0 && isFinal) {
      console.log("[Recorder] encodeAndSend: No PCM data for final chunk, sending empty signal if needed by backend.");
      // Optionally send an empty "final" signal if your backend expects it
      // For now, we'll just return if no data.
      setIsProcessingAudio(false);
      return;
    }


    console.log(`[Recorder] encodeAndSend: Preparing to encode ${pcmDataQueueRef.current.length} PCM buffers. isFinal: ${isFinal}`);
    let totalLength = 0;
    pcmDataQueueRef.current.forEach(buffer => totalLength += buffer.length);
    
    if (totalLength === 0) {
        console.warn("[Recorder] encodeAndSend: Concatenated PCM data is empty after checking queue length.");
        if (isFinal) setIsProcessingAudio(false);
        pcmDataQueueRef.current = []; // Ensure it's cleared
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
    
    // --- CONCEPTUAL FFmpeg Integration Point ---
    // if (ffmpegRef.current && ffmpegLoaded) {
    //   console.log(`[Recorder] encodeAndSend: Encoding WAV using FFmpeg at sampleRate: ${sampleRate}`);
    //   setIsProcessingAudio(true); // Indicate processing has started for this chunk
    //   try {
    //     const ffmpeg = ffmpegRef.current;
    //     const inputFileName = 'input.pcm';
    //     const outputFileName = 'output.wav';

    //     // Convert Float32Array PCM to Uint8Array for FFmpeg
    //     // This step depends on how you want to feed raw PCM to FFmpeg.
    //     // FFmpeg usually expects raw PCM data in a specific format (e.g., s16le for 16-bit signed little-endian).
    //     // This conversion can be complex. For simplicity, assuming a direct way to pass Float32Array or converting it.
    //     // This is a placeholder for the actual conversion.
    //     // const pcmU8Array = new Uint8Array(concatenatedPcm.buffer); // This is NOT directly s16le

    //     // You would need to correctly format concatenatedPcm into what FFmpeg expects for raw PCM input.
    //     // For example, converting Float32Array (-1 to 1) to Int16Array (-32768 to 32767)
    //     const pcmInt16 = new Int16Array(concatenatedPcm.length);
    //     for (let i = 0; i < concatenatedPcm.length; i++) {
    //         pcmInt16[i] = Math.max(-1, Math.min(1, concatenatedPcm[i])) * 32767;
    //     }
    //     const pcmU8ArrayFromInt16 = new Uint8Array(pcmInt16.buffer);


    //     await ffmpeg.writeFile(inputFileName, pcmU8ArrayFromInt16);
    //     // Command to convert raw PCM (s16le = signed 16-bit little-endian) to WAV
    //     // Adjust -ar (sample rate) and -ac (channels) as needed.
    //     await ffmpeg.exec([
    //       '-f', 's16le',        // Input format: signed 16-bit little-endian PCM
    //       '-ar', String(sampleRate), // Input sample rate
    //       '-ac', '1',            // Input channels (mono)
    //       '-i', inputFileName,   // Input file
    //       outputFileName         // Output WAV file
    //     ]);
    //     const outputData = await ffmpeg.readFile(outputFileName);
    //     await ffmpeg.deleteFile(inputFileName);
    //     await ffmpeg.deleteFile(outputFileName);
        
    //     const wavBlob = new Blob([outputData], { type: 'audio/wav' });
    //     console.log(`[Recorder] FFmpeg encoded WAV blob size: ${wavBlob.size}`);
    //     await processAudioChunkRef.current?.(wavBlob, isFinal);

    //   } catch (ffmpegError) {
    //     console.error("Error during FFmpeg encoding:", ffmpegError);
    //     setError("Audio encoding failed with FFmpeg.");
    //     if (isFinal) setIsProcessingAudio(false);
    //   }
    // } else {
      // Fallback to original JavaScript WAV encoding if FFmpeg not loaded or not used
      console.log(`[Recorder] encodeAndSend: Encoding WAV using JavaScript function at sampleRate: ${sampleRate}`);
      const wavBlob = pcmToWavBlobOriginal(concatenatedPcm, sampleRate); // Use original function
      await processAudioChunkRef.current?.(wavBlob, isFinal);
    // }
    // --- End CONCEPTUAL FFmpeg Integration Point ---

  }, [TARGET_SAMPLE_RATE, ffmpegLoaded /* processAudioChunkRef, ffmpegRef */]);


  const handleStartOverallRecording = useCallback(async () => {
    console.log('[Recorder] User clicked Start Recording.');
    setError('');
    setDisplayTime(0);
    if (onTranscriptionUpdate) onTranscriptionUpdate('', { type: 'reset' });

    // if (!ffmpegLoaded) { // Optional: Check if ffmpeg is loaded before starting
    //     console.warn("FFmpeg not loaded yet. Attempting to load...");
    //     // await loadFFmpeg(); // Ensure it's loaded
    //     // if (!ffmpegLoaded) { // Re-check after load attempt
    //     //     setError("Audio processing tools could not be loaded. Please try again.");
    //     //     return;
    //     // }
    // }

    cleanupAudioProcessing(true); 

    const stream = await requestMicrophonePermission();
    if (!stream) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      // Attempt to create AudioContext with the target sample rate
      let createdAudioContext;
      try {
        createdAudioContext = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
      } catch (e) {
        console.warn(`Could not create AudioContext with target sample rate ${TARGET_SAMPLE_RATE}. Using default. Error: ${e.message}`);
        createdAudioContext = new AudioCtx(); // Fallback to default sample rate
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
  }, [onTranscriptionUpdate, initializeAudioVisualizer, cleanupAudioProcessing, CHUNK_DURATION, TARGET_SAMPLE_RATE, encodeAndSendCurrentAudio, /*loadFFmpeg, ffmpegLoaded*/]);

  const internalHandleStopOverallRecording = useCallback(async () => {
    console.log('[Recorder] User clicked Stop Recording.');
    setRecording(false); 

    if (chunkIntervalIdRef.current) {
      clearInterval(chunkIntervalIdRef.current);
      chunkIntervalIdRef.current = null;
      console.log("[Recorder] Chunk interval timer cleared.");
    }

    console.log("[Recorder] Processing final audio chunk on stop.");
    await encodeAndSendCurrentAudio(true); 

    cleanupAudioProcessing(true); 
    
    setDisplayTime(0); 
  }, [encodeAndSendCurrentAudio, cleanupAudioProcessing]);

  useEffect(() => { processAudioChunkRef.current = internalProcessAudioChunk; }, [internalProcessAudioChunk]);
  useEffect(() => { handleStopOverallRecordingRef.current = internalHandleStopOverallRecording; }, [internalHandleStopOverallRecording]);


  return (
    <Box sx={{ mb: 4, p:2, border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, gap: 2 }}>
        <ActionButton
          variant={recording ? "outlined" : "contained"}
          color={recording ? "error" : "primary"}
          onClick={recording ? handleStopOverallRecordingRef.current : handleStartOverallRecording}
          disabled={isProcessingAudio && !recording} 
          startIcon={isProcessingAudio && recording ? <CircularProgress size={20} color="inherit"/> : (recording ? <StopIcon /> : <MicIcon />)}
          sx={{ minWidth: '180px', height: '48px', fontSize: '1rem' }}
        >
          {isProcessingAudio && recording ? "Processing audio..." : (recording ? "Stop Recording" : "Start Recording")}
        </ActionButton>
      </Box>

      {/* { !ffmpegLoaded && <Typography variant="caption" color="textSecondary">Loading audio tools...</Typography> } */}

      {isProcessingAudio && !recording && ( 
        <Box sx={{textAlign: 'center', my:1}}>
          <CircularProgress size={24} />
          <Typography variant="caption" display="block">Finalizing...</Typography>
        </Box>
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
