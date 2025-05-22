import React from 'react';
import { 
  ListItem, 
  Box, 
  Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';

/**
 * Enhanced Message Bubble component for TwinMind chat
 * Creates consistent styling for user and AI messages
 */
const MessageBubble = ({ message, cleanMarkdownFormatting }) => {
  return (    <ListItem
      key={message.id}
      alignItems="flex-start"
      onClick={(e) => {
        // Prevent event bubbling from message bubbles
        e.stopPropagation();
      }}
      sx={{
        flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
        px: 0, 
        py: { xs: 0.5, sm: 0.7 }, // Responsive vertical padding
        mb: { xs: 1, sm: 1.5 }, // Responsive margin between messages
        animation: 'fadeIn 0.3s ease-in-out',
        '@keyframes fadeIn': {
          '0%': { opacity: 0, transform: 'translateY(5px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      }}
    >
      {/* Avatar for user or AI */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mr: message.sender === 'user' ? 0 : { xs: 1, sm: 1.5 },
          ml: message.sender === 'user' ? { xs: 1, sm: 1.5 } : 0,
          mt: 0.5
        }}
      >
        {message.sender === 'user' ? (
          <Box
            sx={{
              width: { xs: 28, sm: 32 }, // Smaller on mobile
              height: { xs: 28, sm: 32 }, // Smaller on mobile
              borderRadius: '50%',
              backgroundColor: '#ff7300',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 3px 8px rgba(255, 115, 0, 0.25)',
              flexShrink: 0, // Prevent avatar from shrinking
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 4px 10px rgba(255, 115, 0, 0.35)'
              }
            }}
          >
            <PersonIcon sx={{ fontSize: { xs: 16, sm: 18 }, color: 'white' }} />
          </Box>
        ) : (
          <Box
            sx={{
              width: { xs: 28, sm: 32 }, // Smaller on mobile
              height: { xs: 28, sm: 32 }, // Smaller on mobile
              borderRadius: '50%',
              backgroundColor: '#0b4f75',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 3px 8px rgba(11, 79, 117, 0.2)',
              flexShrink: 0, // Prevent avatar from shrinking
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 4px 10px rgba(11, 79, 117, 0.3)'
              }
            }}
          >
            <SmartToyIcon sx={{ fontSize: { xs: 16, sm: 18 }, color: 'white' }} />
          </Box>
        )}
      </Box>

      <Box 
        sx={{  
          maxWidth: {xs: '85%', sm: '75%', md: '70%'}, // Responsive width based on screen size
          backgroundColor: message.sender === 'user' 
            ? '#ff7300' 
            : (message.isError ? '#fef2f2' : '#ffffff'),
          color: message.sender === 'user' 
            ? '#ffffff' 
            : (message.isError ? '#b91c1c' : '#334155'),
          borderRadius: message.sender === 'user' 
            ? '18px 18px 4px 18px'  
            : '18px 18px 18px 4px', // Improved bubble style
          p: {xs: 1.5, sm: 1.8}, // Increased responsive padding
          boxShadow: message.sender === 'user'
            ? '0 4px 12px rgba(255, 115, 0, 0.25)'
            : '0 2px 8px rgba(0,0,0,0.06)',
          position: 'relative', // For creating the time tooltip
          transition: 'all 0.2s ease-in-out', // Smooth transitions
          border: message.sender === 'user' 
            ? 'none' 
            : '1px solid rgba(226, 232, 240, 0.8)',
          '&:hover': {
            boxShadow: message.sender === 'user'
              ? '0 6px 16px rgba(255, 115, 0, 0.35)'
              : '0 6px 16px rgba(11, 79, 117, 0.15)', 
            transform: 'translateY(-3px)'
          },
          '& .list-item': {
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            flexWrap: 'nowrap'
          },
          '& .list-number': {
            minWidth: '1.5rem',
            fontWeight: 500,
            flexShrink: 0
          },
          '& .list-bullet': {
            minWidth: '1.2rem',
            marginRight: '0.3rem',
            flexShrink: 0
          },
          '& .list-content': {
            flexGrow: 1,
            wordBreak: 'break-word'
          }
        }}
      >
        {/* User messages don't need formatting, AI messages do */}
        {message.sender === 'user' ? (
          <Typography 
            variant="body2" 
            sx={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word', 
              lineHeight: 1.6,
              fontSize: { xs: '0.875rem', sm: '0.875rem', md: '1rem' } // Responsive font size
            }}
          >
            {message.text}
          </Typography>
        ) : (
          <Typography 
            variant="body2"
            sx={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word', 
              lineHeight: 1.6,
              fontSize: { xs: '0.875rem', sm: '0.875rem', md: '1rem' }, // Responsive font size
              '& strong': { fontWeight: 600 },
              '& em': { fontStyle: 'italic' },
              '& code': { 
                fontFamily: 'monospace',
                backgroundColor: 'rgba(0,0,0,0.05)',
                padding: '0.1rem 0.3rem',
                borderRadius: '3px',
                fontSize: { xs: '0.8125rem', sm: '0.8125rem', md: '0.875rem' }, // Smaller code font on mobile
                wordBreak: 'break-word'
              },
              '& pre': { 
                overflowX: 'auto', 
                maxWidth: '100%',
                backgroundColor: 'rgba(0,0,0,0.04)',
                padding: { xs: '0.3rem', sm: '0.5rem' }, // Responsive padding
                borderRadius: '4px',
                margin: '0.5rem 0',
                fontSize: { xs: '0.8125rem', sm: '0.8125rem', md: '0.875rem' }, // Smaller code font on mobile
                whiteSpace: 'pre-wrap' // Allow wrapping in code blocks
              },
              '& ul': { paddingLeft: { xs: '1rem', sm: '1.5rem' }, marginTop: '0.5rem', marginBottom: '0.5rem' },
              '& li': { marginBottom: '0.25rem' }
            }}
            dangerouslySetInnerHTML={{ __html: cleanMarkdownFormatting(message.text) }}
          />
        )}
        
        {/* Streaming indicator - optional */}
        {message.sender === 'ai' && message.isStreaming && (
          <Box 
            component="span" 
            sx={{ 
              display: 'inline-flex', 
              alignItems: 'center',
              ml: 0.5
            }}
          />
        )}
      </Box>
    </ListItem>
  );
};

export default MessageBubble;
