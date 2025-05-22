/**
 * Model Verification Script
 * 
 * This is a simple script to verify that the correct Gemini models are configured
 * in the TwinMind application.
 */

// Configure any environment variables needed
require('dotenv').config();

// Import our verification utility
const { checkModelConfiguration } = require('./utils/modelCheck');

// Run the check
console.log('\nRunning TwinMind model configuration verification...\n');
const success = checkModelConfiguration();

// Exit with appropriate code
process.exit(success ? 0 : 1);
