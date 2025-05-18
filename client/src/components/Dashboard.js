import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import {
  Box,
  Typography,
  Button,
  Container,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  AppBar,
  Toolbar,
  Avatar,
  IconButton
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const Dashboard = () => {
  const { currentUser, logOut } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user profile data to verify authentication works
    const fetchProfileData = async () => {
      try {
        const response = await authAPI.getUserProfile();
        if (response && response.data) {
          setProfileData(response.data);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to fetch profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const handleLogout = async () => {
    try {
      await logOut();
      // Redirect happens automatically via auth listener
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to log out');
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            TwinMind
          </Typography>
          {currentUser && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ mr: 2 }}>
                  {currentUser.displayName}
                </Typography>
                <Avatar 
                  src={currentUser.photoURL} 
                  alt={currentUser.displayName} 
                  sx={{ mr: 2 }}
                />
              </Box>
              <IconButton color="inherit" onClick={handleLogout}>
                <LogoutIcon />
              </IconButton>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to TwinMind
        </Typography>

        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            User Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <Box>
              <Typography><strong>Email:</strong> {currentUser.email}</Typography>
              <Typography><strong>Name:</strong> {currentUser.displayName}</Typography>
              <Typography><strong>User ID:</strong> {currentUser.uid}</Typography>
            </Box>
          )}
        </Paper>

        <Card elevation={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Backend Authentication Test
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {loading ? (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress size={30} />
              </Box>
            ) : profileData ? (
              <Box>
                <Box display="flex" alignItems="center" sx={{ color: 'success.main', mb: 2 }}>
                  <CheckCircleIcon sx={{ mr: 1 }} />
                  <Typography>
                    Authentication successful! Backend recognizes you.
                  </Typography>
                </Box>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    backgroundColor: '#f5f5f5',
                    maxHeight: '200px',
                    overflow: 'auto'
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(profileData, null, 2)}
                  </pre>
                </Paper>
              </Box>
            ) : (
              <Alert severity="warning">
                Backend authentication test failed. Make sure your server is running.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>  );
};

export default Dashboard;
