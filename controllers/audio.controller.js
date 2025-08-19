const multer = require('multer');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Log OpenAI configuration for debugging
console.log('🔧 OpenAI Configuration:');
console.log('  - API Key Set:', process.env.OPENAI_API_KEY ? '✅ Yes' : '❌ No');
console.log('  - API Key Length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 'N/A');
console.log('  - API Key Prefix:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'N/A');
console.log('  - Environment:', process.env.NODE_ENV || 'development');

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/audio';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

/**
 * Convert audio to text and get AI response
 * POST /api/audio/message
 */
async function audioMessageController(req, res) {
  try {
    // Use multer to handle the audio file upload
    upload.single('audio')(req, res, async function (err) {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          error: 'File upload failed',
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No audio file provided',
          message: 'Please provide an audio file in the request'
        });
      }

      const audioFilePath = req.file.path;
      const conversationId = req.body.conversationId || generateConversationId();

      try {
        // Step 1: Convert audio to text using OpenAI Whisper
        console.log('🎤 Converting audio to text...');
        console.log('  - Audio file path:', audioFilePath);
        console.log('  - File size:', (fs.statSync(audioFilePath).size / 1024 / 1024).toFixed(2) + ' MB');
        console.log('  - Using OpenAI API key:', process.env.OPENAI_API_KEY ? 
          process.env.OPENAI_API_KEY.substring(0, 7) + '...' + process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4) : 
          'NOT SET');
        
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: "whisper-1",
          response_format: "text"
        });

        const transcribedText = transcription;
        console.log('📝 Transcribed text:', transcribedText);

        // Step 2: Send the transcribed text to your existing AI message endpoint
        console.log('🤖 Sending to AI message system...');
        
        // Import the AI services directly instead of trying to mock the request
        const { detectIntent } = require('../services/ai/intentDetection');
        const { executeAction } = require('../services/ai/actionExecution');
        const {
          getConversation,
          addMessage,
          updateContext
        } = require('../services/ai/conversationManager');
        
        // Get user token from the original request
        const userToken = req.headers.authorization;
        
        if (!userToken) {
          return res.status(401).json({
            error: 'Authorization required',
            message: 'Please provide a valid authorization token'
          });
        }

        // Get or create conversation
        const conversation = getConversation(conversationId);
        
        // Add user message to conversation
        addMessage(conversation.id, transcribedText);

        // Get conversation history for better intent detection
        const history = getFormattedHistory(conversation.id);

        // Detect intent from the transcribed text with conversation history
        const intentData = await detectIntent(transcribedText, history);
        console.log('🎯 Detected intent:', intentData);

        // Execute action based on intent
        const aiResult = await executeAction(intentData, transcribedText, userToken, req);
        console.log('🤖 AI response:', aiResult);

        // Add AI response to conversation
        addMessage(conversation.id, aiResult.message || aiResult, 'assistant');

        // Update conversation context if needed
        if (aiResult.context) {
          updateContext(conversation.id, aiResult.context);
        }

        // Clean up the uploaded audio file
        fs.unlinkSync(audioFilePath);

        // Return the response
        return res.json({
          success: true,
          transcribedText: transcribedText,
          aiResponse: aiResult,
          conversationId: conversationId
        });

      } catch (error) {
        // Clean up the uploaded audio file on error
        if (fs.existsSync(audioFilePath)) {
          fs.unlinkSync(audioFilePath);
        }

        // Enhanced error logging for debugging
        console.error('❌ Audio processing error:', {
          error: error.message,
          type: error.type,
          code: error.code,
          status: error.status,
          response: error.response?.data,
          apiKeyUsed: process.env.OPENAI_API_KEY ? 
            process.env.OPENAI_API_KEY.substring(0, 7) + '...' + process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4) : 
            'NOT SET',
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString(),
          audioFile: audioFilePath,
          conversationId: conversationId
        });

        // Provide more specific error messages
        let errorMessage = 'Audio processing failed';
        let statusCode = 500;

        if (error.code === 'invalid_api_key') {
          errorMessage = 'OpenAI API key is invalid or expired';
          statusCode = 401;
        } else if (error.code === 'insufficient_quota') {
          errorMessage = 'OpenAI API quota exceeded';
          statusCode = 429;
        } else if (error.code === 'rate_limit_exceeded') {
          errorMessage = 'OpenAI API rate limit exceeded';
          statusCode = 429;
        } else if (error.message.includes('API key')) {
          errorMessage = 'OpenAI API key configuration error';
          statusCode = 401;
        }

        return res.status(statusCode).json({
          error: 'Audio processing failed',
          message: errorMessage,
          details: {
            originalError: error.message,
            errorCode: error.code,
            suggestion: error.code === 'invalid_api_key' ? 
              'Please check your OPENAI_API_KEY environment variable' : 
              'Please try again later or contact support'
          }
        });
      }
    });

  } catch (error) {
    console.error('Audio controller error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Generate a unique conversation ID
 */
function generateConversationId() {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Validate OpenAI configuration
 */
async function validateOpenAIConfig() {
  try {
    console.log('🔍 Validating OpenAI configuration...');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      return false;
    }

    if (process.env.OPENAI_API_KEY.length < 20) {
      console.error('❌ OPENAI_API_KEY appears to be too short');
      return false;
    }

    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.error('❌ OPENAI_API_KEY does not start with "sk-"');
      return false;
    }

    // Test the API key with a simple request
    try {
      const response = await openai.models.list();
      console.log('✅ OpenAI API key is valid and working');
      console.log('  - Available models:', response.data.length);
      return true;
    } catch (error) {
      console.error('❌ OpenAI API key validation failed:', {
        error: error.message,
        code: error.code,
        status: error.status
      });
      return false;
    }
  } catch (error) {
    console.error('❌ Error validating OpenAI configuration:', error.message);
    return false;
  }
}

// Validate configuration on module load
validateOpenAIConfig();

module.exports = {
  audioMessageController,
  upload,
  validateOpenAIConfig
};
