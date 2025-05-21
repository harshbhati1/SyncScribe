// AuthContext.js

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onIdTokenChanged, // Using onIdTokenChanged for robust token management
  getAuth // Import getAuth
} from 'firebase/auth';
import { app, auth } from '../services/firebase'; // Import both app and auth from firebase.js

// Firebase Auth is already initialized in firebase.js

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState(localStorage.getItem('authToken') || ''); // Initialize from localStorage

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // The onIdTokenChanged listener will handle setting the currentUser, idToken state,
      // and localStorage with the new token.
      console.log('Signed in with Google successfully. User:', result.user.uid);
      return result;
    } catch (error) {
      console.error('Error signing in with Google:', error.code, error.message);
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
  };

  // Listen for ID token changes (handles login, logout, and token refresh)
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      console.log('Firebase onIdTokenChanged event. User UID:', user ? user.uid : null);
      setCurrentUser(user); // Set the current user object

      if (user) {
        try {
          const token = await user.getIdToken(); // Get the latest token
          console.log('ID Token updated via onIdTokenChanged:', token ? `New token (first 20 chars): ${token.substring(0, 20)}...` : 'Token is null/undefined');
          setIdToken(token);
          localStorage.setItem('authToken', token); // Keep localStorage in sync
        } catch (error) {
          console.error('Error getting ID token in onIdTokenChanged:', error.code, error.message);
          // If token fetch fails, it's crucial to clear the potentially stale token
          localStorage.removeItem('authToken');
          setIdToken('');
          // Optionally, you might want to sign the user out if their token is persistently invalid
          // if (error.code === 'auth/user-token-expired' || error.code === 'auth/user-disabled') {
          //   await signOut(auth);
          // }
        }
      } else {
        // User is signed out or no user
        console.log('User is signed out or no user found (onIdTokenChanged). Clearing token.');
        localStorage.removeItem('authToken');
        setIdToken('');
      }
      setLoading(false); // Update loading state once user and token status is determined
    });

    // Clean up subscription on unmount
    return () => {
      console.log('Unsubscribing from onIdTokenChanged listener.');
      unsubscribe();
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount and cleans up on unmount

  // Optional: Function to explicitly force a token refresh if needed elsewhere in the app
  const forceRefreshToken = useCallback(async () => {
    if (auth.currentUser) {
      try {
        console.log('Attempting to force token refresh manually...');
        const token = await auth.currentUser.getIdToken(true); // true forces refresh from server
        // Note: onIdTokenChanged will automatically pick up this new token and update
        // the idToken state and localStorage. No need to setIdToken or setItem here.
        console.log('Manual token refresh successful. onIdTokenChanged will handle updates.');
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
    }
    console.log('No current user to refresh token for.');
    return null;
  }, []); // auth.currentUser might change, but getAuth() instance is stable. Often [] is fine.

  const value = {
    currentUser,
    idToken,
    signInWithGoogle,
    logOut,
    forceRefreshToken, // Expose the manual refresh function
    loading,
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