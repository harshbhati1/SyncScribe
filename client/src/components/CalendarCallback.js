import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';

const CalendarCallback = () => {
  const [status, setStatus] = useState('Processing your request...');
  const [error, setError] = useState('');
  const navigate = useNavigate();  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
      setError(`Authorization failed: ${errorParam}`);
      console.error('Google OAuth error:', errorParam);
      
      // Still redirect after delay, but longer to show error
      setTimeout(() => {
        navigate('/dashboard?tab=calendar');
      }, 5000);
      return;
    }
    
    if (!code) {
      setError('No authorization code received from Google');
      console.error('Missing authorization code in callback');
      
      // Still redirect after delay
      setTimeout(() => {
        navigate('/dashboard?tab=calendar');
      }, 3000);
      return;
    }
    
    // Store the code in localStorage for the GoogleCalendarView to use
    localStorage.setItem('googleAuthCode', code);
    console.log('CalendarCallback: Stored Google auth code in localStorage');
    
    // Code is present and no error, proceed with normal redirect
    setStatus('Authorization successful! Redirecting to calendar...');
    
    // Automatically redirect back to dashboard after a short delay
    const timer = setTimeout(() => {
      navigate('/dashboard?tab=calendar');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      sx={{ height: '100vh', bgcolor: '#f8fafc' }}
    >
      <Box
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          bgcolor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          maxWidth: '400px',
          width: '90%'
        }}
      >
        {error ? (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            <CircularProgress sx={{ color: '#ff7300', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1, color: '#0b4f75', fontWeight: 600 }}>
              Connecting Your Calendar
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center' }}>
              {status}
            </Typography>
            <Typography variant="body2" sx={{ mt: 2, color: '#94a3b8', textAlign: 'center' }}>
              Redirecting you back to the dashboard...
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};

export default CalendarCallback;
