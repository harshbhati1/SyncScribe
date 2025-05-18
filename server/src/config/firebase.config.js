/**
 * Firebase Configuration
 * This file initializes the Firebase Admin SDK with credentials from environment variables
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length === 0) {      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          // Handle the quoted private key string - remove quotes and convert \n to actual newlines
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1'),
          // Handle the quoted client email - remove quotes if present
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL.replace(/^"(.*)"$/, '$1'),
        }),
      });
      console.log('Firebase Admin SDK initialized successfully');
    }
    return admin;
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
};

module.exports = {
  admin,
  initializeFirebase,
};
