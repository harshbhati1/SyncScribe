import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import backgroundImg from '../assets/background.jpg';

// Material UI imports
import { 
  Box, 
  Button, 
  Container, 
  Alert, 
  Paper, 
  Link
} from '@mui/material';
import { styled } from '@mui/material/styles';
import GoogleIcon from '@mui/icons-material/Google';

// Custom styled components
const LoginContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '100vh',
  background: `linear-gradient(to bottom, rgba(30, 98, 235, 0.7), rgba(255, 152, 0, 0.6)), url(${backgroundImg})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  padding: theme.spacing(3),
  color: '#fff',
  textAlign: 'center',
}));

const LogoContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(3),
}));

const Logo = styled('div')(({ theme }) => ({
  fontFamily: '"Inter", sans-serif',
  fontWeight: 800,
  fontSize: '2.5rem',
  letterSpacing: '-0.025em',
  marginBottom: theme.spacing(1),
  background: 'linear-gradient(45deg, #ffffff 30%, #ff9800 90%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}));

const AuthButton = styled(Button)(({ theme, variant }) => ({
  width: '100%',
  padding: theme.spacing(1.5),
  margin: theme.spacing(1, 0),
  borderRadius: 28,
  textTransform: 'none',
  fontWeight: 500,
  fontSize: '0.9rem',
  boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.15)',
  ...(variant === 'google' && {
    backgroundColor: '#fff',
    color: '#333',
    '&:hover': {
      backgroundColor: '#f5f5f5',
      boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
    },
  }),
  ...(variant === 'apple' && {
    backgroundColor: '#000',
    color: '#fff',
    '&:hover': {
      backgroundColor: '#222',
      boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
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
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <LogoContainer>
          <Logo>twin mind</Logo>
        </LogoContainer>

        <Container maxWidth="xs" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, width: '100%', borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Paper elevation={0} sx={{ width: '100%', backgroundColor: 'transparent' }}>
            <AuthButton
              variant="google"
              startIcon={<GoogleIcon />}
              onClick={handleGoogleSignIn}
              disabled={loading}
              sx={{ 
                position: 'relative', 
                overflow: 'hidden',
                py: 1.5,
                width: '100%',
                fontSize: '1rem',
                letterSpacing: '0.2px'
              }}
            >
              Continue with Google
            </AuthButton>
          </Paper>
        </Container>
      </Box>

      <Footer>
        <Link href="#" color="inherit" underline="hover" sx={{ fontSize: '0.75rem', opacity: 0.8, '&:hover': { opacity: 1 } }}>
          Privacy Policy
        </Link>
        <Link href="#" color="inherit" underline="hover" sx={{ fontSize: '0.75rem', opacity: 0.8, '&:hover': { opacity: 1 } }}>
          Terms of Service
        </Link>
      </Footer>
    </LoginContainer>
  );
};

export default Login;
