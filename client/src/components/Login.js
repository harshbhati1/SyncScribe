import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import backgroundImg from '../assets/background.jpg';

// Material UI imports
import { 
  Box, 
  Typography, 
  Button, 
  Container, 
  Alert, 
  Paper, 
  Link,
  Stack
} from '@mui/material';
import { styled } from '@mui/material/styles';
import GoogleIcon from '@mui/icons-material/Google';
import AppleIcon from '@mui/icons-material/Apple';

// Custom styled components
const LoginContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '100vh',
  background: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3)), url(${backgroundImg})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  padding: theme.spacing(3),
  color: '#fff',
  textAlign: 'center',
}));

const AuthButton = styled(Button)(({ theme, variant }) => ({
  width: '100%',
  padding: theme.spacing(1.5),
  margin: theme.spacing(1, 0),
  borderRadius: 25,
  textTransform: 'none',
  fontWeight: 500,
  ...(variant === 'google' && {
    backgroundColor: '#fff',
    color: '#333',
    '&:hover': {
      backgroundColor: '#f1f1f1',
    },
  }),
  ...(variant === 'apple' && {
    backgroundColor: '#000',
    color: '#fff',
    '&:hover': {
      backgroundColor: '#333',
    },
  }),
}));

const Footer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
  maxWidth: 300,
  marginBottom: theme.spacing(2),
}));

const Login = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await signInWithGoogle();
      // Redirect to dashboard after successful login
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer>
      <Typography variant="h3" component="div" fontWeight="bold" sx={{ mt: 5 }}>
        TwinMind
      </Typography>

      <Container maxWidth="xs" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ mb: 4 }}>
          Your AI Meeting Assistant
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
            {error}
          </Alert>
        )}

        <Paper elevation={0} sx={{ width: '100%', backgroundColor: 'transparent' }}>
          <AuthButton
            variant="google"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            Continue with Google
          </AuthButton>
          
          <AuthButton
            variant="apple"
            startIcon={<AppleIcon />}
            disabled
          >
            Continue with Apple
          </AuthButton>
        </Paper>
      </Container>

      <Footer>
        <Link href="#" color="inherit" underline="hover">Privacy Policy</Link>
        <Link href="#" color="inherit" underline="hover">Terms of Service</Link>
      </Footer>
    </LoginContainer>
  );
};

export default Login;
