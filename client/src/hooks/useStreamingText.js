// Custom hook for text streaming with a ChatGPT-like effect
import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * A custom hook that creates a streaming text effect similar to ChatGPT
 * 
 * @param {number} streamingSpeed - The base speed for the streaming effect in milliseconds
 * @returns {object} - Contains the displayText, isComplete status, and startStreaming function
 */
export const useStreamingText = (streamingSpeed = 30) => {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(true);
  const intervalRef = useRef(null);
  const textToStreamRef = useRef('');
  
  // Function to start streaming new text
  const startStreaming = useCallback((newText) => {
    // Clear any existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Set the text to stream and initial state
    textToStreamRef.current = newText || '';
    setIsComplete(false);
    setDisplayText(''); // Reset display text
    
    if (!newText || newText.length === 0) {
      setIsComplete(true);
      return;
    }
    
    let charIndex = 0;
    
    // Function to handle the streaming with variable speed
    const streamNextChars = () => {
      if (charIndex >= textToStreamRef.current.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsComplete(true);
        return;
      }
      
      // Variable speed: add 1-3 characters at a time for more natural typing feel
      const charsToAdd = Math.floor(Math.random() * 3) + 1;
      const nextIndex = Math.min(charIndex + charsToAdd, textToStreamRef.current.length);
      setDisplayText(textToStreamRef.current.substring(0, nextIndex));
      charIndex = nextIndex;
      
      // Add pauses for punctuation to simulate natural reading
      const lastChar = textToStreamRef.current[charIndex - 1];
      if (charIndex > 0 && (lastChar === '.' || lastChar === '!' || lastChar === '?' || lastChar === ',')) {
        clearInterval(intervalRef.current);
        
        // Different pause lengths based on punctuation type
        const pauseDuration = lastChar === ',' 
          ? streamingSpeed * 2  // Shorter pause for commas
          : streamingSpeed * 5; // Longer pause for end of sentences
          
        // Schedule next interval after the pause
        intervalRef.current = setTimeout(() => {
          intervalRef.current = setInterval(streamNextChars, streamingSpeed);
        }, pauseDuration);
      }
    };
    
    // Start the streaming after a small initial delay
    setTimeout(() => {
      intervalRef.current = setInterval(streamNextChars, streamingSpeed);
    }, 100);
    
    // Return cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [streamingSpeed]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);
  
  return { displayText, isComplete, startStreaming };
};

export default useStreamingText;
