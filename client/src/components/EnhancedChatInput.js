import React from 'react';
import { 
  Box, 
  TextField, 
  InputAdornment, 
  IconButton, 
  CircularProgress 
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

/**
 * Enhanced Chat Input component with improved styling and animations
 * Matches the SyncScribe dashboard design system
 */
const EnhancedChatInput = ({ 
  chatQuery, 
  setChatQuery, 
  handleChatSubmit, 
  isAiResponding, 
  rawTranscript,
  setError
}) => {

  const handleKeyDown = (e) => {
    // Submit on Enter (not Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      // Only if we have content and not already processing
      if (chatQuery.trim() && !isAiResponding && rawTranscript) {
        e.preventDefault();
        handleChatSubmit(e);
      } else if (!rawTranscript) {
        // Provide feedback if no transcript available
        e.preventDefault();
        setError('Please record or load a meeting first before chatting.');
      } else if (!chatQuery.trim()) {
        // Empty query feedback
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      // Clear input on Escape
      setChatQuery('');
      e.target.blur();
    }
  };

  return (
    <Box 
      component="form" 
      onSubmit={handleChatSubmit} 
      sx={{ 
        p: 1.5,
        backgroundColor: 'transparent',
        flexShrink: 0,
        position: 'relative',
        '&:before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(11, 79, 117, 0.1), transparent)',
        }
      }}
    >
      <TextField
        fullWidth
        variant="outlined"
        size="medium"
        placeholder={rawTranscript 
          ? "Ask a question about the transcript..." 
          : "Record or load a meeting first"}
        value={chatQuery}
        onChange={(e) => setChatQuery(e.target.value)}
        disabled={isAiResponding || !rawTranscript}
        onKeyDown={handleKeyDown}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '28px',
            backgroundColor: rawTranscript ? '#ffffff' : 'rgba(11, 79, 117, 0.02)',
            border: 'none',
            transition: 'all 0.3s ease-in-out',
            boxShadow: '0 4px 12px rgba(11, 79, 117, 0.08)',
            '&.Mui-focused': {
              boxShadow: '0 0 0 2px rgba(255, 115, 0, 0.25), 0 4px 12px rgba(11, 79, 117, 0.12)',
            },
            '&:hover': {
              boxShadow: '0 6px 16px rgba(11, 79, 117, 0.12)',
              backgroundColor: rawTranscript ? '#ffffff' : 'rgba(11, 79, 117, 0.04)',
              transform: 'translateY(-1px)'
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(0, 0, 0, 0.1)',
              borderWidth: '1px'
            }
          },
          '& .MuiOutlinedInput-input': {
            padding: '14px 16px',
            fontSize: '0.95rem',
            caretColor: '#ff7300'
          },
          '& .MuiInputBase-root.Mui-disabled': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            opacity: 0.8,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(0, 0, 0, 0.1)'
            }
          }
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                type="submit"
                color={chatQuery.trim() && !isAiResponding && rawTranscript ? "primary" : "default"}
                disabled={!chatQuery.trim() || isAiResponding || !rawTranscript}
                title={!rawTranscript ? "No transcript available" : "Send message"}
                sx={{
                  mx: 0.5, // Add margin for better spacing
                  bgcolor: chatQuery.trim() && !isAiResponding && rawTranscript 
                    ? '#ff7300' 
                    : 'transparent',
                  color: chatQuery.trim() && !isAiResponding && rawTranscript 
                    ? 'white' 
                    : undefined,
                  transform: chatQuery.trim() && !isAiResponding && rawTranscript 
                    ? 'scale(1.1)' // Make active button slightly larger
                    : 'scale(1)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    bgcolor: chatQuery.trim() && !isAiResponding && rawTranscript 
                      ? '#fc9e4f' 
                      : 'rgba(11, 79, 117, 0.08)',
                    transform: chatQuery.trim() && !isAiResponding && rawTranscript 
                      ? 'scale(1.15)' // Grow slightly on hover when active
                      : 'scale(1.05)',
                    boxShadow: chatQuery.trim() && !isAiResponding && rawTranscript
                      ? '0 0 8px rgba(255, 115, 0, 0.5)'
                      : 'none'
                  }
                }}
              >
                {isAiResponding ? 
                  <CircularProgress 
                    size={22} 
                    thickness={4} 
                    color="inherit"
                    sx={{
                      animation: 'pulse 1.2s ease-in-out infinite alternate',
                      '@keyframes pulse': {
                        '0%': { opacity: 0.6 },
                        '100%': { opacity: 1 }
                      }
                    }}
                  /> : 
                  <SendIcon />
                }
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
};

export default EnhancedChatInput;
