/**
 * Model Verification Utility
 * 
 * This script helps verify that the correct Gemini model is being used in the application
 * and can be run as a diagnostic tool to check model configuration.
 */

const { initializeGemini } = require('../config/gemini.config');

/**
 * Check and verify the models configured in the application
 */
function checkModelConfiguration() {
  console.log('\n=== TwinMind Gemini Model Verification ===\n');
  
  try {
    // Initialize Gemini configuration 
    const geminiConfig = initializeGemini();
    
    console.log('Simulation mode:', geminiConfig.isSimulationMode ? 'ENABLED' : 'DISABLED');
    
    if (geminiConfig.isSimulationMode) {
      console.log('⚠️ Running in simulation mode. No real API calls will be made.');
      return false;
    }
    
    // Check geminiChat (new property name)
    if (geminiConfig.geminiChat) {
      const chatModelName = geminiConfig.geminiChat._generativeModelOptions?.model || 'unknown';
      console.log(`Chat model (geminiChat): ${chatModelName}`);
      
      if (chatModelName === 'gemini-2.0-flash') {
        console.log('✅ Correct chat model (geminiChat) configured: gemini-2.0-flash');
      } else {
        console.log(`❌ INCORRECT chat model (geminiChat). Expected: gemini-2.0-flash, Found: ${chatModelName}`);
      }
    } else {
      console.log('⚠️ No geminiChat model configured.');
    }
    
    // Check legacy geminiPro property 
    if (geminiConfig.geminiPro) {
      const proModelName = geminiConfig.geminiPro._generativeModelOptions?.model || 'unknown';
      console.log(`Chat model (geminiPro - legacy): ${proModelName}`);
      
      if (proModelName === 'gemini-2.0-flash') {
        console.log('✅ Correct chat model (geminiPro) configured: gemini-2.0-flash');
      } else {
        console.log(`❌ INCORRECT chat model (geminiPro). Expected: gemini-2.0-flash, Found: ${proModelName}`);
      }
    } else {
      console.log('⚠️ No geminiPro model configured.');
    }
    
    // Check to see if the properties point to the same model instance
    if (geminiConfig.geminiChat && geminiConfig.geminiPro) {
      console.log('Instance check: geminiChat and geminiPro properties ',
                 (geminiConfig.geminiChat === geminiConfig.geminiPro ? 
                  'point to the same instance ✅' : 
                  'point to DIFFERENT instances ⚠️'));
    }

    console.log('\n=== Model Verification Complete ===\n');
    return true;
  } catch (error) {
    console.error('❌ Error during model verification:', error);
    return false;
  }
}

// When run directly as a script
if (require.main === module) {
  checkModelConfiguration();
}

module.exports = {
  checkModelConfiguration
};
