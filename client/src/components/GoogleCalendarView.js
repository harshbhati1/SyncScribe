import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import { 
  Box, 
  Typography, 
  Button, 
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { transcriptionAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

// Calendar localization setup for date-fns
const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Custom CSS to override default styles
const calendarStyles = `
  .rbc-time-view {
    background-color: white;
  }
  .rbc-time-header {
    background-color: white;
    border-bottom: none;
  }
  .rbc-time-content {
    border-top: 1px solid #e4e4e7;
  }
  .rbc-time-slot {
    background-color: white;
  }
  .rbc-time-gutter {
    background-color: white;
  }
  .rbc-day-slot .rbc-time-slot {
    border-top: none;
  }
  .rbc-time-view .rbc-header {
    border-bottom: none;
  }
  /* Remove the empty row above 12 AM */
  .rbc-time-view .rbc-time-header-gutter {
    position: relative;
  }
  .rbc-time-view .rbc-allday-cell {
    display: none;
  }
  /* Fix to remove the gap above 12 AM */
  .rbc-time-view .rbc-time-header-content {
    min-height: 0;
    border-top: none;
  }
`;

// Styled components
const CalendarContainer = styled(Box)(({ theme }) => ({
  height: 'calc(100vh - 180px)',
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
}));

const ConnectButton = styled(Button)(({ theme }) => ({
  borderRadius: '24px',
  padding: theme.spacing(1, 3),
  textTransform: 'none',
  fontWeight: 600,
  backgroundColor: '#ff7300',
  color: '#ffffff',
  boxShadow: '0 2px 6px rgba(255, 115, 0, 0.25)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: '#fc9e4f',
    boxShadow: '0 4px 12px rgba(255, 115, 0, 0.3)',
    transform: 'translateY(-2px)',
  },
}));

const GoogleCalendarView = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  
  // Inject custom CSS
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = calendarStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  
  // Check if user has connected Google Calendar
  useEffect(() => {
    const tokens = localStorage.getItem('calendarTokens');
    if (tokens) {
      setIsConnected(true);
      fetchEvents(new Date());
    }
  }, []);
  
  // Handle Google Calendar authorization
  const connectToGoogleCalendar = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await transcriptionAPI.getCalendarAuthUrl();
      if (response && response.data && response.data.success) {
        // Open Google auth page in the same window
        // The callback route will handle the redirect back to the calendar tab
        window.location.href = response.data.authUrl;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (err) {
      setError('Failed to connect to Google Calendar. Please try again.');
      console.error('Error connecting to Google Calendar:', err);
    } finally {
      setIsLoading(false);
    }
  };
  // Handle authorization code exchange after redirect
  useEffect(() => {
    // Check for code in URL params first (for direct navigation)
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    
    // Then check localStorage (from CalendarCallback)
    const storedCode = localStorage.getItem('googleAuthCode');
    
    const code = urlCode || storedCode;
    
    if (code) {
      console.log('GoogleCalendarView: Authorization code detected in URL or localStorage');
      
      // Clear the URL parameters and stored code
      if (urlCode) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      if (storedCode) {
        localStorage.removeItem('googleAuthCode');
      }
      
      // Exchange the code for tokens
      exchangeCodeForTokens(code);
    }
  }, []);
    // Exchange authorization code for tokens
  const exchangeCodeForTokens = async (code) => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log(`GoogleCalendarView: Exchanging code (${code.substring(0, 10)}...) for tokens`);
      const response = await transcriptionAPI.exchangeCalendarCode(code);
      
      if (response && response.data && response.data.success) {
        console.log('GoogleCalendarView: Token exchange successful');
        // Store tokens (in production, you'd store these more securely)
        localStorage.setItem('calendarTokens', JSON.stringify(response.data.tokens));
        setIsConnected(true);
        fetchEvents(selectedDate);
      } else {
        if (response && response.data) {
          console.error('GoogleCalendarView: Token exchange failed with response:', response.data);
          throw new Error(response.data.error || 'Failed to exchange authorization code');
        } else {
          console.error('GoogleCalendarView: Token exchange failed with invalid response');
          throw new Error('Invalid response from server');
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.details || err.message || 'Unknown error';
      setError(`Failed to connect to Google Calendar: ${errorMsg}`);
      console.error('GoogleCalendarView: Error exchanging code:', err);
      if (err.response) {
        console.error('GoogleCalendarView: Error response:', err.response.data);
      }
    } finally {
      setIsLoading(false);
    }
  };  // Fetch calendar events for the selected date
  const fetchEvents = async (date) => {
    setIsLoading(true);
    setError('');
    
    const tokens = localStorage.getItem('calendarTokens');
    if (!tokens) {
      console.log('GoogleCalendarView: No tokens found in localStorage');
      setIsConnected(false);
      setIsLoading(false);
      return;
    }
    
    try {
      console.log('GoogleCalendarView: Found tokens in localStorage');
      const parsedTokens = JSON.parse(tokens);
      
      if (!parsedTokens.access_token) {
        console.error('GoogleCalendarView: No access_token found in parsed tokens');
        localStorage.removeItem('calendarTokens');
        setIsConnected(false);
        setError('Invalid token format. Please reconnect to Google Calendar.');
        setIsLoading(false);
        return;
      }
      
      const { access_token } = parsedTokens;
      console.log('GoogleCalendarView: Fetching events with token:', access_token.substring(0, 10) + '...');
      console.log('GoogleCalendarView: For date:', date.toISOString());
      
      const response = await transcriptionAPI.getCalendarEvents(
        access_token, 
        date.toISOString()
      );
      
      if (response && response.data && response.data.success) {
        console.log(`GoogleCalendarView: Successfully fetched ${response.data.events.length} events`);
        
        // Format events for the calendar
        const formattedEvents = response.data.events.map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        }));
        
        setEvents(formattedEvents);
      } else if (response && response.data && response.data.requiresAuth) {
        console.warn('GoogleCalendarView: Token expired or invalid, need to reconnect');
        // Token expired, need to reconnect - but don't throw an error
        localStorage.removeItem('calendarTokens');
        setIsConnected(false);
        setError('Calendar authorization expired. Please reconnect to Google Calendar.');
      } else {
        console.error('GoogleCalendarView: Failed response:', response?.data);
        setError('Failed to fetch calendar events. Please try reconnecting.');
      }
    } catch (err) {
      // Handle calendar errors gracefully without affecting the main app authentication
      console.error('GoogleCalendarView: Error fetching calendar events:', err);
      
      if (err.code === 'CALENDAR_AUTH_EXPIRED' || err.requiresReauth) {
        // This is a controlled error from our API wrapper
        console.warn('GoogleCalendarView: Calendar auth expired (handled error)');
        localStorage.removeItem('calendarTokens');
        setIsConnected(false);
        setError('Your calendar connection has expired. Please reconnect to Google Calendar.');
      } else {
        // Generic error handling
        const errorMsg = err.message || 'Unknown error';
        setError(`Failed to load calendar events: ${errorMsg}`);
        
        // If we suspect this is an auth error, clear tokens
        if (errorMsg.includes('auth') || errorMsg.includes('cred') || errorMsg.includes('token')) {
          localStorage.removeItem('calendarTokens');
          setIsConnected(false);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle date change in the calendar
  const handleNavigate = (date) => {
    setSelectedDate(date);
    fetchEvents(date);
  };
  
  // Handle clicking on a calendar event
  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };
  
  // Create a new meeting from the selected calendar event
  const createMeetingFromEvent = () => {
    if (selectedEvent) {
      // Store event title to use as meeting title
      localStorage.setItem('currentMeetingTitle', selectedEvent.title);
      localStorage.setItem('titleManuallySet', 'true');
      
      // Navigate to the transcription page to start a new meeting
      navigate('/transcription');
      
      // Close the dialog
      setIsDialogOpen(false);
    }
  };

  return (
    <CalendarContainer>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}
      
      {!isConnected ? (
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center"
          height="100%"
        >
          <Typography variant="h5" gutterBottom sx={{ color: '#0b4f75', fontWeight: 600 }}>
            Connect to Google Calendar
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', maxWidth: 500, color: '#64748b' }}>
            Connect your Google Calendar to view your scheduled meetings and quickly create SyncScribe meetings for them.
          </Typography>
          <ConnectButton 
            onClick={connectToGoogleCalendar}
            disabled={isLoading}
            startIcon={isLoading && <CircularProgress size={20} color="inherit" />}
          >
            {isLoading ? 'Connecting...' : 'Connect Google Calendar'}
          </ConnectButton>
        </Box>
      ) : (
        <>
          <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ color: '#0b4f75', fontWeight: 600 }}>
              Your Calendar
            </Typography>
            {isLoading && (
              <CircularProgress size={24} sx={{ color: '#ff7300' }} />
            )}
          </Box>          <Paper 
            elevation={0} 
            sx={{ 
              flexGrow: 1, 
              borderRadius: '12px', 
              border: '1px solid rgba(226, 232, 240, 0.8)',
              p: 2,
              '& .rbc-calendar': {
                height: '100%'
              },
              '& .rbc-time-header': {
                background: 'white'
              },
              '& .rbc-day-slot .rbc-time-slot': {
                borderTop: 'none'
              },
              '& .rbc-day-bg': {
                background: 'white'
              },
              '& .rbc-time-view': {
                border: '1px solid #e4e4e7',
                borderRadius: '8px',
                overflow: 'hidden'
              },              '& .rbc-time-content': {
                borderTop: '1px solid #e4e4e7',
                marginTop: 0,
                paddingTop: 0
              },
              '& .rbc-time-header-content': {
                borderTop: 'none'
              },
              '& .rbc-allday-cell': {
                display: 'none'
              }
            }}
          >            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              onNavigate={handleNavigate}
              onSelectEvent={handleSelectEvent}
              defaultView="day"
              views={['day', 'week']}              dayLayoutAlgorithm="no-overlap"
              showAllEvents={false}
              length={0}
              min={new Date(0, 0, 0, 0, 0, 0)}
              max={new Date(0, 0, 0, 23, 59, 59)}formats={{
                timeGutterFormat: (date, culture, localizer) => 
                  localizer.format(date, 'h a', culture)
              }}
              components={{
                timeSlotWrapper: ({ children }) => React.cloneElement(children, {
                  style: {
                    ...children.props.style,
                    backgroundColor: 'white'
                  }                })
              }}
            />
          </Paper>
        </>
      )}
      
      {/* Dialog for creating meeting from event */}
      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
        <DialogTitle sx={{ color: '#0b4f75', fontWeight: 600 }}>
          Create Meeting for: {selectedEvent?.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Would you like to create a new SyncScribe meeting for this calendar event?
            The meeting will be titled "{selectedEvent?.title}".
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setIsDialogOpen(false)}
            sx={{ color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={createMeetingFromEvent}
            variant="contained"
            sx={{ 
              bgcolor: '#ff7300', 
              '&:hover': { bgcolor: '#fc9e4f' },
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: '24px',
              px: 3
            }}
          >
            Create Meeting
          </Button>
        </DialogActions>
      </Dialog>
    </CalendarContainer>
  );
};

export default GoogleCalendarView;
