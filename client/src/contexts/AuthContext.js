import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '../services/firebase';

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState('');

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Get ID token
      const token = await result.user.getIdToken();
      setIdToken(token);
      // Save token to localStorage
      localStorage.setItem('authToken', token);
      return result;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  // Sign out
  const logOut = async () => {
    try {
      await signOut(auth);
      // Clear token from localStorage
      localStorage.removeItem('authToken');
      setIdToken('');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };
  // Refresh token periodically (every 55 minutes - tokens expire after 1 hour)
  const refreshToken = useCallback(async () => {
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken(true);
        setIdToken(token);
        localStorage.setItem('authToken', token);
      } catch (error) {
        console.error('Error refreshing token:', error);
      }
    }
  }, [currentUser]); // Add currentUser as a dependency
  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
      
      if (user) {
        // Get token on initial auth state change
        try {
          const token = await user.getIdToken();
          setIdToken(token);
          localStorage.setItem('authToken', token);
          
          // Set up timer to refresh token
          const refreshInterval = setInterval(refreshToken, 55 * 60 * 1000); // 55 minutes
          return () => clearInterval(refreshInterval);
        } catch (error) {
          console.error('Error getting ID token:', error);
        }
      }
    });

    // Clean up subscription
    return () => unsubscribe();
  }, [refreshToken]); // Added refreshToken as dependency

  const value = {
    currentUser,
    idToken,
    signInWithGoogle,
    logOut,
    refreshToken,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  return useContext(AuthContext);
};
