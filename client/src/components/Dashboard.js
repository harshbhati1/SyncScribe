import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  Badge,
  Menu,
  MenuItem,
  Tooltip,
  Drawer,
  InputBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  ListItemIcon,
  ListItemText,
  List,
  ListItem,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import LogoutIcon from '@mui/icons-material/Logout';
import MicIcon from '@mui/icons-material/Mic';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StarIcon from '@mui/icons-material/Star';
import ForumIcon from '@mui/icons-material/Forum';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// Custom styled components to match the ChatGPT-style design
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#ffffff',
  boxShadow: 'none',
  borderBottom: `1px solid #e4e4e7`,
  color: '#434343',
  position: 'sticky',
  width: '100%',
  transition: theme.transitions.create(['width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  zIndex: theme.zIndex.appBar - 1, // Lower z-index than Drawer
}));

const Sidebar = styled(Box)(({ theme }) => ({
  width: '280px',
  height: '100vh',
  position: 'relative',
  backgroundColor: '#fafafa',
  borderRight: `1px solid #e4e4e7`,
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
  overflowY: 'auto',
  transition: theme.transitions.create('transform', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
}));

// Updated NavSection to better handle the scrollable favorites and recent meetings
const NavSection = styled(Box)(({ theme, scrollable, flexGrow }) => ({
  marginBottom: theme.spacing(2),
  transition: 'max-height 0.3s ease',
  position: 'relative',
  textAlign: 'left',
  ...(flexGrow && {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }),
  ...(scrollable && {
    maxHeight: '150px', // Height for about 3 items
    overflowY: 'auto',
    paddingRight: theme.spacing(0.5),
    '&::-webkit-scrollbar': {
      width: '4px',
    },
    '&::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      background: '#bdbdbd',
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      background: '#9e9e9e',
    }
  }),
  '& > *': {
    textAlign: 'left',
  }
}));

const TabPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
}));

const MeetingCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderRadius: '12px',
  boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
  overflow: 'visible',
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: '#f0f0f0',
  }
}));

const MeetingTime = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  fontWeight: 500,
}));

const NewChatButton = styled(Button)(({ theme }) => ({
  borderRadius: '8px',
  padding: theme.spacing(1.5, 2),
  fontWeight: 500,
  textTransform: 'none',
  width: '100%',
  justifyContent: 'flex-start',
  textAlign: 'left',
  border: '1px solid #e4e4e7',
  backgroundColor: '#ffffff',
  color: '#434343',
  marginBottom: theme.spacing(2),
  '&:hover': {
    backgroundColor: '#f4f4f5',
  },
  '& .MuiButton-startIcon': {
    marginRight: theme.spacing(1.5),
    color: '#ff7300',
  },
}));

const NavTitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  fontWeight: 500,
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  padding: theme.spacing(1, 1.5),
  textAlign: 'left',
  width: '100%',
  display: 'block',
}));

const NavItem = styled(Button)(({ theme, active }) => ({
  borderRadius: '8px',
  padding: theme.spacing(1, 1.5),
  fontWeight: 400,
  fontSize: '0.9rem',
  textTransform: 'none',
  width: '100%',
  justifyContent: 'flex-start',
  textAlign: 'left',
  marginBottom: theme.spacing(0.5),
  color: active ? '#0b4f75' : '#434343',
  backgroundColor: active ? '#81c2f71a' : 'transparent',
  '&:hover': {
    backgroundColor: active ? '#81c2f71a' : '#f4f4f5',
  },
  '& .MuiButton-startIcon': {
    marginRight: theme.spacing(1.5),
  },
  '& .MuiButton-label': {
    justifyContent: 'flex-start',
    textAlign: 'left',
  }
}));

const CaptureButton = styled(Button)(({ theme }) => ({
  borderRadius: '24px',
  padding: theme.spacing(1, 3),
  fontWeight: 500,
  textTransform: 'none',
  backgroundColor: '#ff7300',
  boxShadow: '0px 4px 10px rgba(252, 158, 79, 0.3)',
  '&:hover': {
    backgroundColor: '#ed974c',
    boxShadow: '0px 6px 15px rgba(252, 158, 79, 0.4)',
  },
}));

const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: '#4da6d6',
    color: '#4da6d6',
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    '&::after': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      animation: 'ripple 1.2s infinite ease-in-out',
      border: '1px solid currentColor',
      content: '""',
    },
  },
  '@keyframes ripple': {
    '0%': {
      transform: 'scale(.8)',
      opacity: 1,
    },    '100%': {
      transform: 'scale(2.4)',
      opacity: 0,
    },
  },
}));

const Dashboard = () => {
  const { currentUser, logOut } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [meetings, setMeetings] = useState([]); // Updated to use state setter
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed on all devices
  // We don't need to adjust sidebar visibility on resize anymore
  // since it will always overlay content when opened
    
  // Organize meetings by date
  const [favorites, setFavorites] = useState([]);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [allMeetings, setAllMeetings] = useState([]);
  
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  
  // States for dialog controls
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState(''); 
    // Function to toggle sidebar overlay
  const toggleSidebar = () => {
    // Toggle sidebar visibility on all devices
    setSidebarOpen(!sidebarOpen);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleMenuOpen = (event, meeting) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setActiveItem(meeting);
  };
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setActiveItem(null);
  };
    const toggleFavorite = async (meeting) => {
    try {
      // Check if meeting is already in favorites
      const isFavorite = favorites.some(fav => fav.id === meeting.id);
      
      // First update the UI state for responsiveness
      if (isFavorite) {
        // Remove from favorites
        setFavorites(favorites.filter(fav => fav.id !== meeting.id));
      } else {
        // Add to favorites
        setFavorites([...favorites, meeting]);
      }
      
      // Then update in Firestore
      const { transcriptionAPI } = await import('../services/api');
      
      // Only update real meetings (not demo ones)
      if (!meeting.id.startsWith('fav') && !meeting.id.startsWith('recent')) {
        await transcriptionAPI.updateMeetingFavorite(meeting.id, !isFavorite);
      }
      
      handleMenuClose();
    } catch (err) {
      console.error('Error toggling favorite status:', err);
      setError('Failed to update favorite status. Please try again.');
      
      // Revert UI state if there was an error
      const isFavorite = favorites.some(fav => fav.id === meeting.id);
      if (isFavorite) {
        // Meeting was removed, add it back
        setFavorites([...favorites, meeting]);
      } else {
        // Meeting was added, remove it
        setFavorites(favorites.filter(fav => fav.id !== meeting.id));
      }
    }
  };
    // Function to open the rename dialog
  const handleRenameOpen = () => {
    if (activeItem) {
      setNewMeetingTitle(activeItem.title);
      setRenameDialogOpen(true);
      // Close menu but don't reset activeItem until dialog is processed
      setMenuAnchorEl(null);
    } else {
      console.error('No active item to rename');
      setError('Error: No meeting selected for renaming');
    }
  };  // Function to close the rename dialog
  const handleRenameClose = () => {
    setRenameDialogOpen(false);
    // Clean up the activeItem when dialog is closed without renaming
    setActiveItem(null);
  };
  // Function to handle the rename meeting action
  const handleRenameMeeting = async () => {
    if (!newMeetingTitle.trim()) return;
    
    // Check if activeItem exists
    if (!activeItem) {
      console.error('No active item to rename');
      setError('Error: No meeting selected for renaming');
      setRenameDialogOpen(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Update meeting title in Firestore via API
      const { transcriptionAPI } = await import('../services/api');
      
      if (!activeItem.id.startsWith('fav') && !activeItem.id.startsWith('recent')) {
        // Only update in Firestore if it's a real meeting (not a demo one)
        await transcriptionAPI.updateMeetingTitle(activeItem.id, newMeetingTitle);
      }
      
      // Update all meetings data
      setAllMeetings(allMeetings.map(meeting => 
        meeting.id === activeItem.id ? { ...meeting, title: newMeetingTitle } : meeting
      ));
      
      // Update the meeting title in both favorites and recentMeetings arrays
      const isFavorite = favorites.some(fav => fav.id === activeItem.id);
      
      if (isFavorite) {
        setFavorites(favorites.map(fav => 
          fav.id === activeItem.id ? { ...fav, title: newMeetingTitle } : fav
        ));
      }
      
      setRecentMeetings(recentMeetings.map(meeting => 
        meeting.id === activeItem.id ? { ...meeting, title: newMeetingTitle } : meeting
      ));
      
      // Update localStorage if this is the currently active meeting
      const currentMeetingId = localStorage.getItem('currentMeetingId');
      if (currentMeetingId === activeItem.id) {
        localStorage.setItem('currentMeetingTitle', newMeetingTitle);
      }
      
      setError('Meeting renamed successfully');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      console.error('Error renaming meeting:', err);
      setError('Failed to rename meeting. Please try again.');
    } finally {
      setLoading(false);
      setRenameDialogOpen(false);
      setActiveItem(null);
    }
  };
  // Function to open the delete confirmation dialog
  const handleDeleteOpen = () => {
    setDeleteDialogOpen(true);
    // Close menu but don't reset activeItem until dialog is processed
    setMenuAnchorEl(null);
  };

  // Function to close the delete confirmation dialog
  const handleDeleteClose = () => {
    setDeleteDialogOpen(false);
    // Clean up the activeItem when dialog is closed without deleting
    setActiveItem(null);
  };  // Function to handle the delete meeting action
  const handleDeleteMeeting = async () => {
    // Check if activeItem exists
    if (!activeItem) {
      console.error('No active item to delete');
      setError('Error: No meeting selected for deletion');
      setDeleteDialogOpen(false);
      return;
    }

    try {
      setLoading(true);
      
      // Add API call to delete meeting from Firestore if it's a real meeting
      if (!activeItem.id.startsWith('fav') && !activeItem.id.startsWith('recent')) {
        // Delete from Firestore via API
        const { transcriptionAPI } = await import('../services/api');
        await transcriptionAPI.deleteMeeting(activeItem.id);
      }
      
      // Update all state variables with meeting data
      setAllMeetings(allMeetings.filter(meeting => meeting.id !== activeItem.id));
      
      // Remove from favorites if it exists there
      setFavorites(favorites.filter(fav => fav.id !== activeItem.id));
      
      // Remove from recent meetings
      setRecentMeetings(recentMeetings.filter(meeting => meeting.id !== activeItem.id));
      
      // Clear localStorage if this was the current meeting
      const currentMeetingId = localStorage.getItem('currentMeetingId');
      if (currentMeetingId === activeItem.id) {
        localStorage.removeItem('currentMeetingId');
        localStorage.removeItem('currentMeetingTitle');
      }
      
      // Show a temporary success message
      setError('Meeting deleted successfully');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      console.error('Error deleting meeting:', err);
      setError('Failed to delete meeting. Please try again.');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setActiveItem(null);
    }
  };// Helper function to format date for display
  const formatDate = (dateString) => {
    // Use current date if dateString is invalid or not provided
    const date = dateString ? new Date(dateString) : new Date();
    
    // If the date is invalid, use current date
    const validDate = !isNaN(date.getTime()) ? date : new Date();
    
    const day = validDate.getDate();
    const month = validDate.toLocaleString('default', { month: 'short' });
    const year = validDate.getFullYear();
    
    // Add ordinal suffix to day
    const ordinal = (d) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    return `${day}${ordinal(day)} ${month} ${year}`;
  };
  // Group meetings by date
  const getMeetingsByDate = (meetings) => {
    const grouped = {};
    meetings.forEach(meeting => {
      const dateString = formatDate(meeting.date);
      if (!grouped[dateString]) {
        grouped[dateString] = [];
      }
      grouped[dateString].push(meeting);
    });
    return grouped;
  };
  
  // Get grouped meetings
  const groupedRecentMeetings = getMeetingsByDate(recentMeetings);
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
  // Fetch saved meetings from Firestore
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true);
        const { transcriptionAPI } = await import('../services/api');
        
        const response = await transcriptionAPI.getMeetings();
        
        if (response && response.data && response.data.success) {
          const fetchedMeetings = response.data.data || [];
          
          // Update the recent meetings list with fetched data
          const formattedMeetings = fetchedMeetings.map(meeting => ({
            id: meeting.id,
            title: meeting.title || 'Untitled Meeting',
            date: meeting.createdAt || meeting.updatedAt || new Date().toISOString()
          }));
          
          // Sort by date (newest first)
          formattedMeetings.sort((a, b) => new Date(b.date) - new Date(a.date));
          
          // Store all meetings
          setAllMeetings(fetchedMeetings);
          
          // Get favorite meetings (implement a favorites field in your meeting objects)
          const favoriteMeetings = formattedMeetings.filter(meeting => 
            meeting.isFavorite || fetchedMeetings.find(m => m.id === meeting.id)?.isFavorite
          );
          setFavorites(favoriteMeetings);
          
          // Recent meetings (last 10)
          setRecentMeetings(formattedMeetings.slice(0, 10));
        } else {
          // If no meetings found or API error, initialize with empty arrays
          setAllMeetings([]);
          setRecentMeetings([]);
          setFavorites([]);
        }
      } catch (err) {
        console.error('Error in meetings setup:', err);
        setError('Failed to setup meetings');
        // Initialize with empty arrays on error
        setAllMeetings([]);
        setRecentMeetings([]);
        setFavorites([]);
      } finally {
        setLoading(false);
      }
    };
    
    // Only execute if user is authenticated
    if (currentUser) {
      fetchMeetings();
    }
  }, [currentUser]);  // Sync meeting names from localStorage when returning to Dashboard
  useEffect(() => {
    const storedMeetingId = localStorage.getItem('currentMeetingId');
    const storedMeetingTitle = localStorage.getItem('currentMeetingTitle');
    
    if (storedMeetingId && storedMeetingTitle) {
      // Check if this meeting exists in favorites, recent meetings, or all meetings
      const isFavorite = favorites.some(fav => fav.id === storedMeetingId);
      const isRecent = recentMeetings.some(meeting => meeting.id === storedMeetingId);
      const isMeetingInAllMeetings = allMeetings.some(meeting => meeting.id === storedMeetingId);
      
      // Update the title if needed in all meeting arrays
      if (isFavorite) {
        setFavorites(favorites.map(fav => 
          fav.id === storedMeetingId ? { ...fav, title: storedMeetingTitle } : fav
        ));
      }
      
      if (isRecent) {
        setRecentMeetings(recentMeetings.map(meeting => 
          meeting.id === storedMeetingId ? { ...meeting, title: storedMeetingTitle } : meeting
        ));
      }
      
      if (isMeetingInAllMeetings) {
        setAllMeetings(allMeetings.map(meeting => 
          meeting.id === storedMeetingId ? { ...meeting, title: storedMeetingTitle } : meeting
        ));
      }
    }
  }, [allMeetings, favorites, recentMeetings]); // Add dependencies to update when they change
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
    <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh', display: 'flex' }}>      {/* Left Sidebar - ChatGPT Style - Now always overlays content */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={sidebarOpen}
        onClose={toggleSidebar}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}        PaperProps={{
          sx: {
            width: '280px',
            bgcolor: '#fafafa',
            border: 'none',
            boxShadow: '1px 0 5px rgba(0,0,0,0.05)'
          }
        }}
        sx={(theme) => ({
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: '280px',
            zIndex: theme.zIndex.appBar + 1, // Higher than AppBar
          },
          // Use semi-transparent backdrop on all screen sizes
          '& .MuiBackdrop-root': {
            backgroundColor: '#08040417',
          }
        })}
      >
        <Sidebar>          {/* Sidebar header with hamburger menu only */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            width: '100%', 
            mb: 2 
          }}>
            <IconButton 
              size="small" 
              sx={{ 
                p: 0.5, 
                '&:hover': { 
                  backgroundColor: 'rgba(0, 0, 0, 0.04)' 
                },
                transition: 'all 0.2s ease'
              }}
              onClick={toggleSidebar}
              aria-label="toggle sidebar"
            >
              <MenuIcon fontSize="small" />
            </IconButton>
          </Box>
          
          {/* New Meeting Button */}
          <NewChatButton
            startIcon={<MicIcon />}
            onClick={() => {
              // For a new meeting, set default title and clear previous ID
              localStorage.setItem('currentMeetingTitle', 'New Meeting');
              localStorage.removeItem('currentMeetingId');
              navigate('/transcription');
              if (window.innerWidth < 960) {
                toggleSidebar(); // Close sidebar on mobile after selection
              }
            }}
          >
            New Meeting
          </NewChatButton>

          {/* Container for sidebar sections with flex layout */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: 'calc(100vh - 170px)',  // Account for header, new meeting button, and profile at bottom
            overflow: 'hidden'
          }}>
            {/* FAVORITES section - limited to 3 visible items by default */}
            <Box>              <NavTitle>FAVORITES</NavTitle>
              <NavSection 
                scrollable={favorites.length > 3} 
                sx={{ 
                  maxHeight: favorites.length <= 3 ? 'auto' : '150px',
                  overflowY: favorites.length > 3 ? 'auto' : 'visible'
                }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                    <CircularProgress size={24} sx={{ color: '#ff7300' }} />
                  </Box>
                ) : favorites.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No favorited meetings yet
                    </Typography>
                  </Box>
                ) : (
                  favorites.map(fav => (
                    <Box
                      key={fav.id}
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        width: '100%',
                        mb: 0.5,
                      }}
                    >
                      <NavItem 
                        onClick={() => {
                          // Store meeting info in localStorage before navigating
                          localStorage.setItem('currentMeetingTitle', fav.title);
                          localStorage.setItem('currentMeetingId', fav.id);
                          navigate(`/transcription/${fav.id}`);
                          if (window.innerWidth < 960) {
                            toggleSidebar(); // Close sidebar on mobile after selection
                          }
                        }}
                        sx={{ 
                          flexGrow: 1,
                          mb: 0,
                          pr: 1,
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <StarIcon sx={{ fontSize: 18, mr: 1.5, color: '#ff7300', flexShrink: 0 }} />
                          <Box sx={{ 
                            flexGrow: 1, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            display: 'block'
                          }}>
                            {fav.title}
                          </Box>
                        </Box>
                      </NavItem>
                      <IconButton 
                        size="small" 
                        sx={{ width: 28, height: 28, opacity: 0.6 }}
                        onClick={(e) => handleMenuOpen(e, fav)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))
                )}
              </NavSection>
              {favorites.length > 3 && (
                <Box 
                  sx={{                    position: 'relative', 
                    bottom: '24px', 
                    left: 0, 
                    width: '100%', 
                    height: '24px', 
                    background: 'linear-gradient(to top, rgba(250,250,250,0.9), rgba(250,250,250,0))',
                    pointerEvents: 'none',
                    zIndex: 1,
                    marginBottom: '-24px'
                  }} 
                />
              )}
            </Box>            {/* RECENT MEETINGS - Taking all remaining space */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <NavTitle>RECENT MEETINGS</NavTitle>
              <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                    <CircularProgress size={24} sx={{ color: '#ff7300' }} />
                  </Box>
                ) : recentMeetings.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No saved meetings yet
                    </Typography>
                  </Box>
                ) : (
                  Object.entries(groupedRecentMeetings).map(([date, meetings]) => (
                    <Box key={date}>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: 'block', 
                          pl: 1.5, 
                          mb: 0.5, 
                          mt: 1.5, 
                          color: 'text.secondary',
                          fontSize: '0.7rem'
                        }}
                      >
                        {date}
                      </Typography>
                      
                      {meetings.map(meeting => (
                        <Box
                          key={meeting.id}
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            width: '100%',
                            mb: 0.5,
                          }}
                        >
                          <NavItem 
                            onClick={() => {
                              // Store meeting info in localStorage before navigating
                              localStorage.setItem('currentMeetingTitle', meeting.title);
                              localStorage.setItem('currentMeetingId', meeting.id);
                              navigate(`/transcription/${meeting.id}`);
                              if (window.innerWidth < 960) {
                                toggleSidebar(); // Close sidebar on mobile after selection
                              }
                            }}
                            sx={{ 
                              flexGrow: 1,
                              mb: 0,
                              pr: 1,
                              textAlign: 'left',
                              justifyContent: 'flex-start',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                              <ForumIcon sx={{ fontSize: 18, mr: 1.5, opacity: 0.7, flexShrink: 0 }} />
                              <Box sx={{ 
                                flexGrow: 1, 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                textAlign: 'left',
                                justifyContent: 'flex-start',
                                display: 'block'
                              }}>
                                {meeting.title}
                              </Box>
                            </Box>
                          </NavItem>
                          <IconButton 
                            size="small" 
                            sx={{ width: 28, height: 28, opacity: 0.6 }}
                            onClick={(e) => handleMenuOpen(e, meeting)}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Box>

          {/* User profile at bottom */}
          <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            {currentUser && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName} 
                    sx={{ width: 32, height: 32 }}
                  />
                  <Typography variant="body2" sx={{ ml: 1, fontWeight: 500 }}>
                    {currentUser.displayName || 'User'}
                  </Typography>
                </Box>
                <Tooltip title="Logout">
                  <IconButton size="small" onClick={handleLogout}>
                    <LogoutIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        </Sidebar>
      </Drawer>      {/* Main Content - Always takes full width now */}      
      <Box sx={(theme) => ({ 
        flexGrow: 1,
        transition: theme.transitions.create(['width'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        width: '100%'
      })}>
        {/* Header App Bar */}        <StyledAppBar position="static">          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="toggle sidebar"
              onClick={toggleSidebar}
              sx={{ 
                mr: 2,
                '&:hover': { 
                  backgroundColor: 'rgba(0, 0, 0, 0.04)' 
                },
                transition: 'all 0.2s ease'
              }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <Typography variant="h6" fontWeight="bold">
                My Meetings
              </Typography>
            </Box>              <Box sx={{ display: 'flex', alignItems: 'center' }}>              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #ff7300 30%, #fc9e4f 90%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                TwinMind
              </Typography>
            </Box>          </Toolbar>
          
          {/* Tab Navigation */}<Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="fullWidth" 
            sx={{ 
              '& .MuiTabs-indicator': {
                backgroundColor: '#ff7300',
              },
              '& .MuiTab-root': {
                minWidth: 'auto',
                fontSize: '0.85rem',
                fontWeight: 500,
                textTransform: 'none',
                py: 1.5,
                color: '#71717a',
                '&.Mui-selected': {
                  color: '#0b4f75',
                }
              } 
            }}
          >
            <Tab label="Questions" />
            <Tab label="Calendar" />
          </Tabs>
        </StyledAppBar>        {/* Tab Content Panels */}        <TabPanel hidden={tabValue !== 0} value={tabValue} index={0}>
          <Box sx={{ px: 2, py: 1 }}>
                      {/* Meeting Cards */}              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                mt: 4,
                mb: 6,
                height: '40vh',
                width: '100%',
                px: 2
              }}>                <Typography 
                  variant="h4" 
                  align="center" 
                  sx={{ 
                    mb: 3,
                    fontWeight: 700,
                    fontSize: '1.8rem',
                    background: 'linear-gradient(45deg, #0b4f75 30%, #ff7300 90%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    letterSpacing: '0.2px',
                    maxWidth: '600px',
                    mx: 'auto',
                    display: 'block',
                    width: '100%'
                  }}
                >
                  Ask questions about your past meetings and conversations!
                </Typography>
              </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Paper
                component="form"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  px: 2,
                  py: 0.5,
                  mr: 1,
                  width: '100%',
                  maxWidth: '400px',
                  borderRadius: '20px',
                  border: '1px solid #e4e4e7',
                  backgroundColor: '#fafafa',
                  '&:hover': {
                    borderColor: '#a1a1aa',
                    boxShadow: '0 1px 5px rgba(0,0,0,0.05)'
                  }
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  // Handle search submission here
                }}
              >
                <InputBase
                  sx={{ ml: 1, flex: 1, fontSize: '0.85rem' }}
                  placeholder="Ask a question about your meetings..."
                  inputProps={{ 'aria-label': 'search meetings' }}
                />
                <IconButton type="submit" sx={{ p: '5px', color: '#0b4f75' }} aria-label="search">
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Paper>
                <CaptureButton
                variant="contained"
                color="primary"
                startIcon={<MicIcon fontSize="small" />}
                sx={{ fontSize: '0.8rem', py: 1 }}
                onClick={() => {
                  // For a new meeting, set default title and clear previous ID
                  localStorage.setItem('currentMeetingTitle', 'New Meeting');
                  localStorage.removeItem('currentMeetingId');
                  navigate('/transcription');
                }}
              >
                Capture
              </CaptureButton>
            </Box>
          </Box>
        </TabPanel>
        
        <TabPanel hidden={tabValue !== 1} value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Typography color="text.secondary">Calendar view will be implemented soon</Typography>
          </Box>
        </TabPanel>
      </Box>
      
      {/* Error Alert for general errors */}
      {error && (
        <Alert 
          severity="warning"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            maxWidth: '400px',            zIndex: 2000,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}            {/* Context Menu for Meeting Items */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 2,
          sx: {
            borderRadius: 2,
            minWidth: 180,
            '& .MuiMenuItem-root': {
              justifyContent: 'flex-start',
              textAlign: 'left',
            }
          }
        }}
      >
        {activeItem && (
          <>
            {/* Favorite/Unfavorite option */}
            <MenuItem dense onClick={() => {
              toggleFavorite(activeItem);
              handleMenuClose();
            }}>
              {favorites.some(fav => fav.id === activeItem?.id) ? (
                <>
                  <ListItemIcon>
                    <StarIcon fontSize="small" sx={{ color: '#bbb' }} />
                  </ListItemIcon>
                  <ListItemText>Remove from favorites</ListItemText>
                </>
              ) : (
                <>                  <ListItemIcon>
                    <StarIcon fontSize="small" sx={{ color: '#ff7300' }} />
                  </ListItemIcon>
                  <ListItemText>Add to favorites</ListItemText>
                </>
              )}
            </MenuItem>
            
            {/* Rename option */}
            <MenuItem dense onClick={handleRenameOpen}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Rename</ListItemText>
            </MenuItem>
            
            {/* Delete option */}
            <MenuItem dense onClick={handleDeleteOpen}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" sx={{ color: '#d32f2f' }} />
              </ListItemIcon>
              <ListItemText sx={{ color: '#d32f2f' }}>Delete</ListItemText>
            </MenuItem>
            
            {/* View details option */}
            <MenuItem dense onClick={handleMenuClose}>
              <ListItemIcon>
                <InfoOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>View details</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
      
      {/* Rename Meeting Dialog */}
      <Dialog open={renameDialogOpen} onClose={handleRenameClose} fullWidth maxWidth="xs">
        <DialogTitle>Rename Meeting</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter a new name for this meeting.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Meeting Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newMeetingTitle}
            onChange={(e) => setNewMeetingTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameClose}>Cancel</Button>
          <Button onClick={handleRenameMeeting} variant="contained" color="primary">
            Rename
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteClose}>
        <DialogTitle>Delete Meeting</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this meeting? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteClose}>Cancel</Button>
          <Button onClick={handleDeleteMeeting} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
