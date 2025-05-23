/**
 * Firebase Configuration (Client-Side)
 * This file initializes the Firebase client SDK for web
 */

import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Import analytics only if you need it
// import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDzQ_fS2nIN1wmHmKX8vknX-VZqKAU6jXA",
  authDomain: "twinmind-1af03.firebaseapp.com",
  projectId: "twinmind-1af03",
  storageBucket: "twinmind-1af03.firebasestorage.app",
  messagingSenderId: "885909154947",
  appId: "1:885909154947:web:7c5daa54042ae5f61dbfb6",
  measurementId: "G-0BD5029T8T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);

// Set persistence to LOCAL (survives browser restarts)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Firebase Auth: Persistence set to LOCAL');
  })
  .catch((error) => {
    console.error('Firebase Auth: Error setting persistence:', error);
  });

const firestore = getFirestore(app);

// Initialize Analytics (optional)
// const analytics = getAnalytics(app);

export { app, auth, firestore };
// export { analytics } if you decide to use it
