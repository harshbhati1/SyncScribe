/**
 * API Service
 * Handles API requests with authentication
 */

// Connect to server port 3000 as specified in server's .env file
const API_BASE_URL = 'http://localhost:3000/api';

// Get stored auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Make authenticated API request
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add auth token if available
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('Using auth token:', token.substring(0, 10) + '...');
  } else {
    console.log('No auth token available');
  }
  
  console.log(`Making API request to: ${url}`);
  
  // Request options
  const requestOptions = {
    ...options,
    headers,
  };
  
  try {
    const response = await fetch(url, requestOptions);
    
    // Handle unauthorized response (token expired)
    if (response.status === 401) {
      // Could implement token refresh or redirect to login
      console.warn('Authentication error. Redirecting to login...');
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      return null;
    }
    
    const data = await response.json();
    console.log('API response received:', { status: response.status });
    return { data, status: response.status };
  } catch (error) {
    console.error('API request failed:', error.message);
    console.error('Full error:', error);
    throw error;
  }
};

// Auth-specific API calls
export const authAPI = {
  verifyToken: () => apiRequest('/auth/verify'),
  getUserProfile: () => apiRequest('/auth/profile'),
};

// Transcription-specific API calls
export const transcriptionAPI = {  processAudio: async (audioData, options = {}) => {
    const token = getAuthToken();
    if (!token) {
      console.error("No auth token available for audio processing");
      throw new Error("Authentication required");
    }

    // Create form data for file upload
    const formData = new FormData();
    
    // Add the audio file data
    if (audioData instanceof Blob) {
      // If it's already a Blob or File object
      formData.append('audio_data', audioData);
    } else {
      console.error("Invalid audio data format: expected a Blob");
      throw new Error("Invalid audio data format");
    }
    
    // Add any additional options as form fields
    if (options.is_final !== undefined) {
      formData.append('is_final', options.is_final.toString());
    }
    
    if (options.timestamp) {
      formData.append('timestamp', options.timestamp);
    }
    
    if (options.recording_time !== undefined) {
      formData.append('recording_time', options.recording_time.toString());
    }

    const url = `${API_BASE_URL}/transcription/process`;
    
    try {
      console.log(`Sending audio data (${audioData.size} bytes) to ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // NOTE: Don't set Content-Type when using FormData, browser will set it with boundary
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Audio processing failed with status ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Audio processing response:', data);
      return data;
    } catch (error) {
      console.error('Audio processing request failed:', error);
      throw error;
    }
  },
  
  generateSummary: (transcription, meetingId) => apiRequest('/transcription/summary', {
    method: 'POST',
    body: JSON.stringify({ 
      transcription, 
      meetingId 
    })
  }),
    chatWithTranscript: (fullTranscript, clientSideChatHistory, newUserQuery, callbacks) => {
    const url = `${API_BASE_URL}/chat`;
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return new Promise((resolve, reject) => {
      console.log(`Making streaming API request to: ${url}`);
      console.log(`Transcript length: ${fullTranscript?.length || 0}, Chat history: ${clientSideChatHistory?.length || 0} messages`);
        // Set a safety timeout to ensure we don't leave the UI hanging
      let safetyTimeoutId = setTimeout(() => {
        console.log("Chat request safety timeout triggered - forcing completion");
        if (callbacks && callbacks.onEnd) {
          callbacks.onEnd();
        }
        resolve({ status: 'timeout', message: 'Request timed out' });
      }, 60000); // 60 second safety timeout (increased from 40s)
      
      fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
          fullTranscript, 
          clientSideChatHistory, 
          newUserQuery 
        })      }).then(response => {
        if (!response.ok) {
          clearTimeout(safetyTimeoutId);
          return response.json().then(err => {          // Special handling for rate limiting (429)
            if (response.status === 429) {
              const retryAfter = response.headers.get('Retry-After') || '30';
              throw new Error(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
            }
            if (response.status === 500) {
              // Enhanced 500 error handling with more details
              const errorMessage = err.details || err.error || 'Internal server error';
              const errorCode = err.code || 'UNKNOWN_ERROR';
              console.error(`Server error (${errorCode}):`, errorMessage);
              throw new Error(`Server error: ${errorMessage}. Please try again later or refresh the page.`);
            }
            throw new Error(err.error || `HTTP error! status: ${response.status}`);
          }).catch(err => {
            throw new Error(`Network error: ${err.message || 'Unknown error'}`);
          });
        }

        // For streaming responses
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function readStream() {
          return reader.read().then(({ value, done }) => {
            if (done) {
              console.log("Stream complete - reader done");
              clearTimeout(safetyTimeoutId);
              if (callbacks && callbacks.onEnd) {
                callbacks.onEnd();
              }
              resolve({ status: 'complete' });
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); // Keep the incomplete line in the buffer
              // Reset the safety timeout each time we get data
            clearTimeout(safetyTimeoutId);
            safetyTimeoutId = setTimeout(() => {
              console.log("Chat stream timeout - forcing end");
              if (callbacks && callbacks.onEnd) {
                callbacks.onEnd();
              }
              resolve({ status: 'timeout', message: 'Stream timed out' });
            }, 30000); // 30 second stream timeout (increased from 20s)

            for (const line of lines) {
              if (line.trim() === '') continue;
              if (!line.startsWith('data:')) continue;
              
              try {
                const eventData = JSON.parse(line.substring(5).trim());
                if (eventData.endOfStream) {
                  clearTimeout(safetyTimeoutId);
                  console.log("End of stream event received");
                  if (callbacks && callbacks.onEnd) {
                    callbacks.onEnd();
                  }
                  resolve({ status: 'complete' }); // Make sure we resolve the promise when stream ends
                } else if (eventData.textChunk) {
                  if (callbacks && callbacks.onChunk) {
                    callbacks.onChunk(eventData.textChunk);
                  }
                } else if (eventData.error) {                // Handle error messages sent as stream events
                  const errorObj = new Error(eventData.errorMessage || eventData.error || 'Unknown stream error');
                  errorObj.code = eventData.errorCode || 'STREAM_ERROR';
                  errorObj.isRetryable = eventData.retryable === true;
                  
                  // Enhanced user-friendly error message based on code
                  if (eventData.errorCode === 'RATE_LIMITED' || errorObj.message.includes('rate limit')) {
                    errorObj.friendlyMessage = 'Rate limit reached. Please wait 30-60 seconds before trying again.';
                  } else if (eventData.errorCode === 'SERVER_ERROR') {
                    errorObj.friendlyMessage = 'Server error occurred. Please try again in a moment.';
                  } else {
                    errorObj.friendlyMessage = eventData.errorMessage || 'An error occurred while processing your request.';
                  }
                  
                  if (callbacks && callbacks.onError) {
                    callbacks.onError(errorObj);
                  } else {
                    console.error('Chat stream error:', errorObj);
                  }
                  // We don't resolve here as more chunks might come with partial results
                }
              } catch (err) {
                console.error('Error parsing SSE data:', err, 'Line:', line);
                // Try to recover and continue reading 
              }
            }
            
            return readStream();
          }).catch(err => {            clearTimeout(safetyTimeoutId);
            console.error('Stream read error:', err);
            if (callbacks && callbacks.onError) {
              // Enhance error message for specific errors
              if (err.message && err.message.includes('Too Many Requests')) {
                err = new Error('Rate limit reached. Please wait a moment before trying again. (429: Too Many Requests)');
              }
              callbacks.onError(err);
            }
            reject(err);
          });
        }

        readStream();
      }).catch(err => {        clearTimeout(safetyTimeoutId);
        console.error('Fetch error:', err);
        if (callbacks && callbacks.onError) {
          // Enhance error message for specific errors
          if (err.message && (err.message.includes('429') || err.message.includes('Too Many Requests'))) {
            err = new Error('Rate limit reached. Please wait 30-60 seconds before trying again. (429: Too Many Requests)');
          }
          callbacks.onError(err);
        }
        reject(err);
      });
    });
  },
  // New method to fetch an existing meeting by ID
  getMeeting: (meetingId) => apiRequest(`/transcription/meeting/${meetingId}`, {
    method: 'GET'
  }),  // New method to save a meeting
  saveMeeting: (meeting) => apiRequest('/transcription/meeting', {
    method: 'POST',
    body: JSON.stringify(meeting)
  }),
  
  // Method to generate a meeting summary
  generateSummary: (transcript, meetingId) => apiRequest('/summary/generate', {
    method: 'POST',
    body: JSON.stringify({
      transcript,
      meetingId
    })
  })
};

// Export for general use
export default apiRequest;
