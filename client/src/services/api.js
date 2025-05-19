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
    
    const data = await response.json();    console.log('API response received:', { status: response.status });
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
  processAudio: (audioChunk, meetingId) => apiRequest('/transcription/process', {
    method: 'POST',
    body: JSON.stringify({ 
      audioChunk, 
      meetingId 
    })
  }),
  generateSummary: (transcription, meetingId) => apiRequest('/transcription/summary', {
    method: 'POST',
    body: JSON.stringify({ 
      transcription, 
      meetingId 
    })
  }),
  chatWithTranscript: (transcription, query) => apiRequest('/transcription/chat', {
    method: 'POST',
    body: JSON.stringify({ 
      transcription, 
      query 
    })
  }),
  // New method to fetch an existing meeting by ID
  getMeeting: (meetingId) => apiRequest(`/transcription/meeting/${meetingId}`, {
    method: 'GET'
  }),
  // New method to save a meeting
  saveMeeting: (meeting) => apiRequest('/transcription/meeting', {
    method: 'POST',
    body: JSON.stringify(meeting)
  })
};

// Export for general use
export default apiRequest;
