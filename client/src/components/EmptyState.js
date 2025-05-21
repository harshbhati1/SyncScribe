import React from 'react';
import { 
  Box, 
  Typography, 
  Button,
  useTheme
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import ChatIcon from '@mui/icons-material/Chat';
import SummarizeIcon from '@mui/icons-material/Summarize';

/**
 * Enhanced Empty State component for TwinMind
 * Used to display informative messages when content is not available
 */
const EmptyState = ({ 
  type = 'transcript', // 'transcript', 'chat', 'summary'
  hasTranscript = false,
  onButtonClick = null,
  buttonText = 'Get Started'
}) => {
  const theme = useTheme();
  
  // Configuration for different empty states
  const config = {
    transcript: {
      icon: <ArticleIcon sx={{ fontSize: 48, color: '#0b4f75', opacity: 0.7 }} />,
      title: 'Start recording to get started',
      description: 'Your live transcript will appear here as you speak.',
      bgGradient: 'linear-gradient(135deg, rgba(11, 79, 117, 0.08) 0%, rgba(255, 115, 0, 0.08) 100%)'
    },
    chat: {
      icon: hasTranscript 
        ? <ChatIcon sx={{ fontSize: 40, color: '#ff7300' }} />
        : <ChatIcon sx={{ fontSize: 48, color: '#0b4f75', opacity: 0.7 }} />,
      title: hasTranscript 
        ? 'Chat with your transcript' 
        : 'No transcript available',
      description: hasTranscript
        ? 'Ask questions about your meeting transcript. I can help summarize key points, extract action items, or clarify details.'
        : 'Record or load a meeting first to chat about it.',
      bgGradient: hasTranscript
        ? 'rgba(255, 115, 0, 0.1)'
        : 'rgba(11, 79, 117, 0.08)',
      animation: hasTranscript 
        ? 'pulse 2s infinite' 
        : 'none'
    },
    summary: {
      icon: <SummarizeIcon sx={{ fontSize: 48, color: '#0b4f75', opacity: 0.7 }} />,
      title: 'No summary available yet',
      description: 'Generate a summary to get key insights, action items, and highlights from your meeting transcript.',
      bgGradient: 'linear-gradient(135deg, rgba(11, 79, 117, 0.08) 0%, rgba(255, 115, 0, 0.08) 100%)'
    }
  };
  
  const currentConfig = config[type];
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        padding: 4,
        animation: 'fadeIn 0.5s ease-out',
        '@keyframes fadeIn': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 }
        }
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: currentConfig.bgGradient,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          mb: 3,
          boxShadow: type === 'chat' && hasTranscript
            ? '0 6px 16px rgba(255, 115, 0, 0.15)'
            : '0 6px 16px rgba(11, 79, 117, 0.1)',
          animation: currentConfig.animation,
          '@keyframes pulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(255, 115, 0, 0.4)' },
            '70%': { boxShadow: '0 0 0 15px rgba(255, 115, 0, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(255, 115, 0, 0)' }
          }
        }}
      >
        {currentConfig.icon}
      </Box>
      
      <Typography 
        variant="h6" 
        sx={{ 
          color: '#0b4f75', 
          fontWeight: 600,
          textAlign: 'center',
          mb: 1
        }}
      >
        {currentConfig.title}
      </Typography>
      
      <Typography 
        variant="body2"
        sx={{
          color: '#64748b',
          textAlign: 'center',
          maxWidth: '400px',
          lineHeight: 1.6,
          mb: onButtonClick ? 4 : 2
        }}
      >
        {currentConfig.description}
      </Typography>
      
      {onButtonClick && (
        <Button 
          variant="contained" 
          onClick={onButtonClick}
          sx={{ 
            mt: 2, 
            borderRadius: '24px',
            px: 3,
            py: 1,
            backgroundColor: '#ff7300',
            color: '#ffffff',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: '0 4px 12px rgba(255, 115, 0, 0.25)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: '#fc9e4f',
              boxShadow: '0 6px 16px rgba(255, 115, 0, 0.35)',
              transform: 'translateY(-2px)'
            }
          }}
        >
          {buttonText}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
