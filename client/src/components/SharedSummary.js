import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Container,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  Button
} from '@mui/material';
import { styled } from '@mui/material/styles';
import apiRequest from '../services/api';

const StyledContainer = styled(Container)(({ theme }) => ({
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(6),
}));

const SummaryTitle = styled(Typography)(({ theme }) => ({
  color: '#0b4f75',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

const SummaryCard = styled(Card)(({ theme }) => ({
  borderRadius: '16px',
  boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
  marginBottom: theme.spacing(4),
  overflow: 'visible',
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '8px',
    background: 'linear-gradient(90deg, #1E62EB 0%, #4a7ef0 100%)',
    borderRadius: '16px 16px 0 0',
  }
}));

const SectionHeading = styled(Typography)(({ theme }) => ({
  color: '#0b4f75',
  fontWeight: 600,
  marginTop: theme.spacing(3),
  marginBottom: theme.spacing(1),
  fontSize: '1.1rem'
}));

// Create separate components for action items and regular bullet points
const BulletItem = styled(ListItem)(({ theme, isAction }) => ({
  padding: theme.spacing(0.5, 1),
  paddingLeft: 0,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(11, 79, 117, 0.03)',
    borderRadius: '8px'
  },
  display: 'flex',
  alignItems: 'flex-start',
  '& .MuiListItemIcon-root': {
    minWidth: '32px',
  },
  '&::before': {
    content: '"•"',
    color: isAction ? '#ff7300' : '#0b4f75', // Use orange for action items, blue for others
    fontWeight: 'bold',
    display: 'inline-block',
    width: '28px',
    marginLeft: '8px',
    fontSize: '1.2em',
    marginRight: '4px'
  }
}));

const SharedSummary = () => {
  const { shareId } = useParams();
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSharedSummary = async () => {
      try {
        setLoading(true);
        const response = await apiRequest(`/summary/shared/${shareId}`);
        
        if (response.data && response.data.data) {
          setSummaryData(response.data.data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching shared summary:', err);
        setError('The shared summary could not be loaded. It may have expired or been removed.');
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      fetchSharedSummary();
    } else {
      setError('No summary ID provided');
      setLoading(false);
    }
  }, [shareId]);

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="80vh"
      >
        <CircularProgress size={60} thickness={4} sx={{ color: '#1E62EB' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <StyledContainer maxWidth="md">
        <Alert severity="error" sx={{ marginTop: 4, marginBottom: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          href="/" 
          sx={{
            mt: 2,
            borderRadius: '24px',
            padding: '8px 24px',
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(11, 79, 117, 0.1)',
          }}
        >
          Return to Home
        </Button>
      </StyledContainer>
    );
  }

  if (!summaryData || !summaryData.summary) {
    return (
      <StyledContainer maxWidth="md">
        <Alert severity="warning">
          No summary data available.
        </Alert>
      </StyledContainer>
    );
  }

  const { summary, meetingTitle, createdAt } = summaryData;
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <StyledContainer maxWidth="md">
      <SummaryTitle variant="h4">
        {meetingTitle || 'Shared Meeting Summary'}
      </SummaryTitle>
      
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Shared on {formattedDate}
      </Typography>

      <SummaryCard>
        <CardContent sx={{ padding: 3 }}>
          {summary.title && (
            <>
              <Typography variant="h5" fontWeight={600} color="#1E62EB">
                {summary.title}
              </Typography>
              <Divider sx={{ my: 2 }} />
            </>
          )}

          {summary.overall && (
            <>
              <SectionHeading variant="h6">Overall Summary</SectionHeading>
              <Typography paragraph sx={{ ml: 2 }}>
                {summary.overall}
              </Typography>
            </>
          )}          {summary.sections && summary.sections.map((section, index) => {
            // Check if this is an action items section
            const isActionSection = section.headline.toLowerCase().includes('action') || 
                                    section.headline.toLowerCase().includes('next step') ||
                                    section.headline.toLowerCase().includes('task');
            
            // Standardize action section headline if needed
            const displayHeadline = isActionSection ? "ACTION ITEMS AND NEXT STEPS" : section.headline;
            
            return (
              <Box key={index} mt={3}>
                <SectionHeading variant="h6">
                  {displayHeadline}
                </SectionHeading>
                <List dense sx={{ pl: 0 }}>                  {section.bulletPoints && section.bulletPoints.map((bullet, bulletIndex) => (
                    <BulletItem key={bulletIndex} disableGutters isAction={isActionSection}>
                      <ListItemText 
                        primary={bullet} 
                        primaryTypographyProps={{
                          sx: {
                            color: '#334155',
                            fontSize: '0.95rem',
                            lineHeight: 1.5
                          }
                        }}
                      />
                    </BulletItem>
                  ))}
                </List>
              </Box>
            );
          })}

          {/* Handle the legacy format with separate keyPoints and actionItems */}
          {(!summary.sections || summary.sections.length === 0) && (
            <>
              {summary.keyPoints && summary.keyPoints.length > 0 && (
                <Box mt={3}>
                  <SectionHeading variant="h6">Key Discussion Points</SectionHeading>
                  <List dense sx={{ pl: 0 }}>                    {summary.keyPoints.map((point, index) => (
                      <BulletItem key={`kp-${index}`} disableGutters isAction={false}>
                        <ListItemText 
                          primary={point}
                          primaryTypographyProps={{
                            sx: {
                              color: '#334155',
                              fontSize: '0.95rem',
                              lineHeight: 1.5
                            }
                          }}
                        />
                      </BulletItem>
                    ))}
                  </List>
                </Box>
              )}
              
              {summary.actionItems && summary.actionItems.length > 0 && (
                <Box mt={3}>
                  <SectionHeading variant="h6">ACTION ITEMS AND NEXT STEPS</SectionHeading>
                  <List dense sx={{ pl: 0 }}>                    {summary.actionItems.map((item, index) => (
                      <BulletItem key={`ai-${index}`} disableGutters isAction={true}>
                        <ListItemText 
                          primary={item}
                          primaryTypographyProps={{
                            sx: {
                              color: '#334155',
                              fontSize: '0.95rem',
                              lineHeight: 1.5
                            }
                          }}
                        />
                      </BulletItem>
                    ))}
                  </List>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </SummaryCard>

      <Box textAlign="center" mt={4}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          This summary was shared via SyncScribe
        </Typography>
        <Button 
          variant="contained" 
          href="/" 
          sx={{
            mt: 1,
            borderRadius: '24px',
            padding: '8px 24px',
            textTransform: 'none',
            fontWeight: 600
          }}
        >
          Create Your Own Summary
        </Button>
      </Box>
    </StyledContainer>
  );
};

export default SharedSummary;
