/**
 * Firebase Configuration
 * This file initializes the Firebase Admin SDK with credentials from environment variables
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create service account credential object from environment variables
const serviceAccountCredentials = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  // Handle the quoted private key string - remove quotes and convert \n to actual newlines
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1'),
  // Handle the quoted client email - remove quotes if present
  client_email: process.env.FIREBASE_CLIENT_EMAIL.replace(/^"(.*)"$/, '$1')
};

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountCredentials)
      });
      console.log('Firebase Admin SDK initialized successfully');
    } else {
      console.log('Firebase Admin SDK already initialized');
    }
    return admin;
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
};

// Initialize Firebase immediately
try {
  initializeFirebase();
} catch (error) {
  console.error('Failed to initialize Firebase on load:', error);
}

module.exports = {
  serviceAccountCredentials,
  initializeFirebase,
  admin
};
