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
  
  // Check if this is a calendar-related request
  const isCalendarRequest = endpoint.includes('/calendar/');
  
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
    
    // If this is not a calendar request and no token is available, we might have an auth issue
    if (!isCalendarRequest && !endpoint.includes('/auth/')) {
      console.warn('Attempting API request without auth token');
    }
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
      const responseData = await response.json();
      console.warn('Authentication error:', responseData?.error);
      
      // Special case for calendar errors - don't log out the user for calendar issues
      if (isCalendarRequest && (responseData?.error?.message?.includes('Calendar') || 
                               url.includes('calendar/events'))) {
        console.warn('Calendar authentication error - handling separately');
        return { 
          data: { 
            success: false, 
            error: responseData.error || 'Calendar authentication failed', 
            requiresAuth: true 
          }, 
          status: 401 
        };
      }
      
      // Check for token expired error specifically
      const isExpired = responseData?.error?.code === 'token-expired' || 
                       responseData?.error?.message?.includes('expired') ||
                       responseData?.error?.title?.includes('expired');
      
      // Check if the error is retryable
      const isRetryable = responseData?.error?.retryable !== false;
      
      if ((isExpired || !getAuthToken()) && isRetryable) {
        console.log('Token expired or missing. Attempting to refresh...');
        
        // Track refresh attempts to prevent infinite loops
        const refreshAttempt = window.tokenRefreshAttempts || 0;
        window.tokenRefreshAttempts = refreshAttempt + 1;
        
        // If we've tried too many times, force a complete re-login
        if (window.tokenRefreshAttempts > 3) {
          console.error('Too many token refresh attempts. Forcing re-authentication.');
          localStorage.removeItem('authToken');
          sessionStorage.removeItem('authState');
          document.cookie = `authSession=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          window.tokenRefreshAttempts = 0; // Reset for next login
          window.location.href = '/login';
          return null;
        }
        
        try {
          // Import auth context to use the forceRefreshToken function
          const { auth } = await import('../services/firebase');
          
          // Check if we have a current user first
          if (!auth.currentUser) {
            console.warn('No current user found in Firebase auth. Cannot refresh token.');
            localStorage.removeItem('authToken'); 
            window.location.href = '/login';
            return null;
          }
          
          // Try to get a refresh function
          const { forceRefreshToken } = await import('../contexts/AuthContext').then(module => {
            // If useAuth is exported directly, import it and call it
            try {
              return module.useAuth();
            } catch (e) {
              // Otherwise try to access the context directly (fallback)
              console.log('Using auth token refresh fallback method');
              return { forceRefreshToken: async () => {
                if (auth.currentUser) {
                  return await auth.currentUser.getIdToken(true);
                }
                return null;
              }};
            }
          });
          
          // Use the forceRefreshToken function if available, otherwise fall back to direct token refresh
          const newToken = await forceRefreshToken() || 
                          (auth.currentUser ? await auth.currentUser.getIdToken(true) : null);
          
          if (newToken) {
            console.log('Token refreshed successfully');
            localStorage.setItem('authToken', newToken);
            document.cookie = `authSession=active; path=/; max-age=3600; SameSite=Strict`;
            
            // Retry the request with new token
            headers['Authorization'] = `Bearer ${newToken}`;
            const retryOptions = {
              ...options,
              headers,
            };
            
            console.log('Retrying request with new token');
            const retryResponse = await fetch(url, retryOptions);
            
            // If we still get 401 after refresh, something else is wrong
            if (retryResponse.status === 401) {
              console.error('Still getting 401 after token refresh. User may need to re-authenticate.');
              localStorage.removeItem('authToken');
              window.location.href = '/login';
              return null;
            }
            
            const retryData = await retryResponse.json();
            return { data: retryData, status: retryResponse.status };
          } else {
            console.error('No current user or token refresh failed');
          }
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
        }
      } else if (!isRetryable) {
        console.warn('Authentication error is not retryable. Reason:', responseData?.error?.code);
      } else {
        console.warn('Authentication error is not due to token expiration. Code:', responseData?.error?.code);
      }
      
      // If token refresh failed or user not logged in, redirect to login
      console.warn('Authentication failed. Redirecting to login...');
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
export const transcriptionAPI = {
  processAudio: async (audioData, options = {}) => {
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
    // Method to generate a meeting summary
  generateSummary: (transcript, meetingId) => apiRequest('/summary/generate', {
    method: 'POST',
    body: JSON.stringify({
      transcript,
      meetingId
    })
  }),
  
  // Method to create a shareable link for a summary
  createSummaryShareLink: (summary, meetingTitle) => apiRequest('/summary/share', {
    method: 'POST',
    body: JSON.stringify({
      summary,
      meetingTitle
    })
  }),
  
  // Function to share summary and get a shareable link
  shareSummary: (summary, meetingTitle) => apiRequest('/summary/share', {
    method: 'POST',
    body: JSON.stringify({
      summary,
      meetingTitle
    })
  }),
  
  // Function to format summary for export (will be used by the server-side share feature)
  exportSummary: (summary, meetingTitle) => {
    if (!summary) {
      throw new Error('No summary data available to export');
    }
    
    const currentDate = new Date().toLocaleDateString();
    let exportContent = `# ${meetingTitle || 'Meeting Summary'}\n`;
    exportContent += `Generated on: ${currentDate}\n\n`;
    
    if (summary.title) {
      exportContent += `# ${summary.title}\n\n`;
    }
    
    if (summary.overall) {
      exportContent += `## Overall Summary\n${summary.overall}\n\n`;
    }
    
    if (summary.sections && Array.isArray(summary.sections)) {
      // Process sections, ensuring action items come last
      const sortedSections = [...summary.sections].sort((a, b) => {
        const aIsAction = a.headline.toLowerCase().includes('action') || 
                          a.headline.toLowerCase().includes('next step');
        const bIsAction = b.headline.toLowerCase().includes('action') || 
                          b.headline.toLowerCase().includes('next step');
        
        if (aIsAction && !bIsAction) return 1; // Action items go last
        if (!aIsAction && bIsAction) return -1; // Non-action items go first
        return 0;
      });
      
      sortedSections.forEach(section => {
        exportContent += `## ${section.headline}\n${section.content}\n\n`;
      });
    }
    
    return exportContent;
  },
  
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
        })
      }).then(response => {        if (!response.ok) {
          clearTimeout(safetyTimeoutId);
          return response.json().then(err => {
            // Special handling for rate limiting (429)
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
              if (line.trim() === '') {
                continue;
              }
              if (!line.startsWith('data:')) {
                continue;
              }
              
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
                } else if (eventData.error) {
                  // Handle error messages sent as stream events
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
  },  // Method to save a meeting with Firestore storage
  saveMeeting: (meeting) => apiRequest('/transcription/meeting', {
    method: 'POST',
    body: JSON.stringify(meeting)
  }),
  
  // Method to get an existing meeting by ID
  getMeeting: (meetingId) => apiRequest(`/transcription/meeting/${meetingId}`, {
    method: 'GET'
  }),
  
  // Method to get all meetings for a user
  getMeetings: () => apiRequest('/transcription/meetings', {
    method: 'GET'
  }),
  
  // Method to update a meeting title
  updateMeetingTitle: (meetingId, title) => apiRequest(`/transcription/meeting/${meetingId}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title })
  }),
  
  // Method to update a meeting favorite status
  updateMeetingFavorite: (meetingId, isFavorite) => apiRequest(`/transcription/meeting/${meetingId}/favorite`, {
    method: 'PATCH',
    body: JSON.stringify({ isFavorite })
  }),
  
  // Method to delete a meeting
  deleteMeeting: (meetingId) => apiRequest(`/transcription/meeting/${meetingId}`, {
    method: 'DELETE'
  }),
  // Method to generate a meeting summary
  generateSummary: (transcript, meetingId) => apiRequest('/summary/generate', {
    method: 'POST',
    body: JSON.stringify({
      transcript,
      meetingId
    })
  }),
  // Calendar Integration Methods
  getCalendarAuthUrl: () => {
    console.log('API: Requesting calendar auth URL');
    return apiRequest('/calendar/auth-url', {
      method: 'GET'
    });
  },
  
  exchangeCalendarCode: (code) => {
    console.log('API: Exchanging authorization code, length:', code.length);
    return apiRequest('/calendar/exchange-code', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  },
    getCalendarEvents: (accessToken, date) => {
    console.log('API: Getting calendar events for date:', date);
    
    // Check if token exists - don't even try if not
    if (!accessToken) {
      console.error('API: No access token provided for calendar events');
      return Promise.reject(new Error('No calendar access token'));
    }
    
    // Check if there's a session in progress - don't make calendar calls if user isn't properly logged in
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      console.warn('API: Attempting to fetch calendar events without being logged in');
      return Promise.reject({
        code: 'AUTH_REQUIRED',
        message: 'You must be logged in to access calendar',
        requiresAuth: true
      });
    }
    
    return apiRequest(`/calendar/events?accessToken=${encodeURIComponent(accessToken)}&date=${encodeURIComponent(date)}`, {
      method: 'GET'
    }).catch(error => {
      // Special handling for calendar token errors
      if (error.status === 401 || error.code === 401 || 
          (error.message && error.message.includes('Invalid Credentials'))) {
        console.error('API: Calendar token invalid or expired');
        
        // Clear stored calendar tokens to force re-auth
        if (localStorage.getItem('calendarTokens')) {
          console.log('API: Clearing stored calendar tokens');
          localStorage.removeItem('calendarTokens');
        }
        
        // Return a structured error for the UI to handle
        return Promise.reject({
          code: 'CALENDAR_AUTH_EXPIRED',
          message: 'Your Google Calendar access has expired. Please reconnect.',
          requiresReauth: true
        });
      }
      
      // Pass through other errors
      return Promise.reject(error);
    });
  }
};

// Export for general use
export default apiRequest;
