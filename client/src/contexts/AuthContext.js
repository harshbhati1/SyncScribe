// AuthContext.js

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onIdTokenChanged,
  getAuth,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth } from '../services/firebase'; // Import auth from firebase.js
import { logTokenInfo } from '../utils/tokenUtils'; // Import token utility

// Firebase Auth is already initialized in firebase.js

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState(localStorage.getItem('authToken') || ''); // Initialize from localStorage
  const [authError, setAuthError] = useState(null);
  
  // Initialize with persistence
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Set persistence to LOCAL (this persists even when the window is closed)
        await setPersistence(auth, browserLocalPersistence);
        console.log('Firebase auth persistence set to LOCAL');
      } catch (error) {
        console.error('Error setting auth persistence:', error);
        setAuthError(error.message);
      }
    };
    
    initializeAuth();
  }, []);
  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google sign-in process...');
      const provider = new GoogleAuthProvider();
      // Add additional scopes if needed
      provider.addScope('profile');
      provider.addScope('email');
      
      // Force re-authentication
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      console.log('Signed in with Google successfully. User:', result.user.uid);
      
      // Get and store the token immediately
      const token = await result.user.getIdToken(true);
      localStorage.setItem('authToken', token);
      setIdToken(token);
      
      // Set timestamps to track session
      const timestamp = Date.now();
      localStorage.setItem('authTimestamp', timestamp.toString());
      sessionStorage.setItem('authState', JSON.stringify({
        loggedIn: true,
        timestamp: timestamp,
        uid: result.user.uid
      }));
      
      // Set cookie for additional redundancy
      document.cookie = `authSession=active; path=/; max-age=86400; SameSite=Strict`;
      
      return result;
    } catch (error) {
      console.error('Error signing in with Google:', error.code, error.message);
      setAuthError(error.message);
      // Provide more specific error messages if possible
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled: The sign-in popup was closed before completing.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Sign-in failed: A network error occurred. Please check your connection.');
      }
      throw error; // Re-throw original error for other cases
    }
  };

  // Sign out
  const logOut = async () => {
    try {
      await signOut(auth);
      // The onIdTokenChanged listener will handle clearing currentUser, idToken state,
      // and localStorage.
      console.log('User signed out successfully.');
    } catch (error) {
      console.error('Error signing out:', error.code, error.message);
      throw error;
    }
  };  // Listen for ID token changes (handles login, logout, and token refresh)
  useEffect(() => {
    console.log('[AuthContext] Setting up auth state listener');
    
    // If there's a stored token but no Firebase auth state yet,
    // the stored token might be from a previous session
    const storedToken = localStorage.getItem('authToken');
    const storedTimestamp = localStorage.getItem('authTimestamp');
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (storedToken) {
      console.log(`[AuthContext] Found stored token (${storedToken.substring(0, 10)}...) and checking validity`);
      
      // Check if token is relatively fresh (less than a day old)
      if (storedTimestamp && (now - parseInt(storedTimestamp)) < oneDay) {
        console.log('[AuthContext] Token is less than 24 hours old');
        document.cookie = `authSession=pending; path=/; max-age=86400; SameSite=Strict`;
      } else {
        console.log('[AuthContext] Token might be stale or timestamp missing');
      }
    }
    
    // Set up auth state listener
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      console.log('[AuthContext] Firebase auth state changed. User:', user ? user.uid : 'null');
      
      // Track whether we had a user before this callback
      const hadUserBefore = !!currentUser;
      
      if (user) {
        try {
          console.log('[AuthContext] User is logged in, updating state and getting fresh token');
          
          // Update user state
          setCurrentUser(user);
          
          // Get a fresh token
          const token = await user.getIdToken(true);
          console.log('[AuthContext] Got fresh token:', token ? `${token.substring(0, 10)}...` : 'null');
          
          // Store token and update state
          localStorage.setItem('authToken', token);
          localStorage.setItem('authTimestamp', Date.now().toString());
          setIdToken(token);
          
          // Set cookie for additional session tracking
          document.cookie = `authSession=active; path=/; max-age=86400; SameSite=Strict`;
          
          // Update session storage
          sessionStorage.setItem('authState', JSON.stringify({
            loggedIn: true,
            timestamp: Date.now(),
            uid: user.uid
          }));
          
          // Clear any auth errors
          setAuthError(null);
        } catch (error) {
          console.error('[AuthContext] Error getting token:', error);
          setAuthError(error.message);
          
          // Don't clear token if there's an error - might be temporary
          if (error.code === 'auth/user-token-expired' || error.code === 'auth/user-disabled') {
            console.warn('[AuthContext] Token expired or user disabled. Signing out.');
            localStorage.removeItem('authToken');
            localStorage.removeItem('authTimestamp');
            setIdToken('');
            document.cookie = `authSession=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            await signOut(auth);
          }
        }
      } else {
        console.log('[AuthContext] No user detected in auth state change');
        
        // Check if we had a user before but not now (potential auth state loss)
        if (hadUserBefore) {
          console.warn('[AuthContext] User was logged in but now is not. Checking for recent session...');
          
          // Check if we have a recent auth session
          const authState = JSON.parse(sessionStorage.getItem('authState') || '{}');
          const timeSinceLogin = Date.now() - (authState.timestamp || 0);
          const fiveMinutes = 5 * 60 * 1000;
          
          if (authState.loggedIn && timeSinceLogin < fiveMinutes) {
            console.warn('[AuthContext] Recent session detected. This might be an unintended logout.');
            console.log('[AuthContext] Not clearing stored tokens in case of auth state recovery.');
            
            // Don't clear tokens or update currentUser yet - wait for potential recovery
            setLoading(false);
            return;
          }
        }
        
        // No user and no recent session, or intentional logout - clear everything
        console.log('[AuthContext] Clearing auth state');
        setCurrentUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authTimestamp');
        sessionStorage.removeItem('authState');
        setIdToken('');
        document.cookie = `authSession=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
      
      // Authentication state is determined
      setLoading(false);
    });

    // Clean up subscription on unmount
    return () => {
      console.log('[AuthContext] Unsubscribing from onIdTokenChanged listener');
      unsubscribe();
    };
  }, [currentUser]); // Add currentUser as dependency to track user state changes
  // Function to explicitly force a token refresh if needed elsewhere in the app
  const forceRefreshToken = useCallback(async () => {
    if (auth.currentUser) {
      try {
        console.log('Attempting to force token refresh manually...');
        const token = await auth.currentUser.getIdToken(true); // true forces refresh from server
        console.log('Manual token refresh successful. New token obtained.');
        
        // Update the token in state and localStorage directly
        setIdToken(token);
        localStorage.setItem('authToken', token);
        
        // Set session cookie to help with persistence
        document.cookie = `authSession=active; path=/; max-age=3600; SameSite=Strict`;
        
        // Update session storage with fresh timestamp
        const authState = JSON.parse(sessionStorage.getItem('authState') || '{}');
        sessionStorage.setItem('authState', JSON.stringify({
          ...authState,
          loggedIn: true,
          timestamp: Date.now(),
          uid: auth.currentUser.uid
        }));
        
        return token;
      } catch (error) {
        console.error('Error forcing token refresh:', error.code, error.message);
        // Handle specific errors that might indicate the user's session is no longer valid
        if (error.code === 'auth/user-token-expired' ||
            error.code === 'auth/user-disabled' ||
            error.code === 'auth/user-not-found' ||
            error.code === 'auth/network-request-failed') {
          console.warn('User session may be invalid or network error during refresh. Logging out.');
          await logOut(); // Attempt to sign out to clear state
        }
        return null; // Indicate refresh failure
      }
    } else {
      // Try to recover from a missing currentUser situation
      const storedToken = localStorage.getItem('authToken');
      const authState = JSON.parse(sessionStorage.getItem('authState') || '{}');
      
      if (storedToken && authState.loggedIn && authState.timestamp) {
        // Check if the session is relatively recent (within 30 minutes)
        const timeSinceLogin = Date.now() - authState.timestamp;
        if (timeSinceLogin < 30 * 60 * 1000) {
          console.log('No current user but recent session detected. Attempting to use stored token.');
          return storedToken;
        }
      }
      
      console.log('No current user to refresh token for and no recent session.');
      return null;
    }
  }, []);
  
  // Set up proactive token refresh - this will refresh the token 10 minutes before it expires
  useEffect(() => {
    if (!currentUser) return; // No user to refresh token for
    
    // Function to decode JWT and get expiration time
    const getTokenExpirationTime = (token) => {
      try {
        // Decode the base64-encoded JWT payload (second part of the token)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const { exp } = JSON.parse(jsonPayload);
        return exp * 1000; // Convert to milliseconds
      } catch (error) {
        console.error('Error decoding token:', error);
        // Default to 55 minutes from now if we can't decode the token
        // (Firebase ID tokens typically expire after 1 hour)
        return Date.now() + 55 * 60 * 1000;
      }
    };
    
    // Schedule token refresh 10 minutes before expiration
    const scheduleTokenRefresh = (token) => {
      if (!token) return null;
      
      const expirationTime = getTokenExpirationTime(token);
      const timeUntilRefresh = expirationTime - Date.now() - (10 * 60 * 1000); // 10 minutes before expiry
      
      console.log(`Token expires in ${Math.round((expirationTime - Date.now()) / 60000)} minutes. Will refresh in ${Math.round(timeUntilRefresh / 60000)} minutes.`);
      
      // Don't schedule if the token is already expired or will expire in less than 5 minutes
      if (timeUntilRefresh < 5 * 60 * 1000) {
        console.log('Token expiring soon, refreshing now instead of scheduling');
        forceRefreshToken();
        return null;
      }
      
      return setTimeout(() => {
        console.log('Scheduled token refresh triggered');
        forceRefreshToken();
      }, timeUntilRefresh);
    };
    
    // Set up the initial refresh timer when idToken changes
    const refreshTimerId = scheduleTokenRefresh(idToken);
    
    // Clear the timer on cleanup
    return () => {
      if (refreshTimerId) clearTimeout(refreshTimerId);
    };
  }, [currentUser, idToken, forceRefreshToken]); // Re-run when user or idToken changes
  const value = {
    currentUser,
    idToken,
    signInWithGoogle,
    logOut,
    forceRefreshToken, // Expose the manual refresh function
    loading,
    // Debug function to check token status
    checkTokenStatus: () => {
      try {
        if (!idToken) {
          console.log('No ID token available');
          return { valid: false, message: 'No token' };
        }
        
        // Decode the token to check expiration
        const base64Url = idToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const { exp, iat } = JSON.parse(jsonPayload);
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = exp - now;
        const tokenAge = now - iat;
        
        console.log(`Token status check:
- Expires in: ${expiresIn} seconds (${Math.round(expiresIn/60)} minutes)
- Token age: ${tokenAge} seconds (${Math.round(tokenAge/60)} minutes)
- Valid: ${expiresIn > 0 ? 'YES' : 'NO - EXPIRED'}`);
        
        return {
          valid: expiresIn > 0,
          expiresIn,
          tokenAge,
          exp,
          iat,
          message: expiresIn > 0 ? `Valid for ${Math.round(expiresIn/60)} more minutes` : 'Token has expired'
        };
      } catch (e) {
        console.error('Error checking token status:', e);
        return { valid: false, error: e.message, message: 'Invalid token format' };
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};