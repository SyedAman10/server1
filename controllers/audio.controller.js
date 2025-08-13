const multer = require('multer');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: "whisper-1",
          response_format: "text"
        });

        const transcribedText = transcription;
        console.log('📝 Transcribed text:', transcribedText);

        // Step 2: Send the transcribed text to your existing AI message endpoint
        console.log('🤖 Sending to AI message system...');
        
        // Import your existing AI message handler
        const { handleMessage } = require('./ai-agent.controller');
        
        // Create a mock request object for the AI message handler
        const mockReq = {
          body: {
            message: transcribedText,
            conversationId: conversationId,
            // Add any other required fields
          },
          headers: req.headers,
          protocol: req.protocol,
          get: req.get.bind(req)
        };

        // Call your existing AI message handler
        const aiResponse = await handleMessage(mockReq, res);

        // Clean up the uploaded audio file
        fs.unlinkSync(audioFilePath);

        // Return the response
        return res.json({
          success: true,
          transcribedText: transcribedText,
          aiResponse: aiResponse,
          conversationId: conversationId
        });

      } catch (error) {
        // Clean up the uploaded audio file on error
        if (fs.existsSync(audioFilePath)) {
          fs.unlinkSync(audioFilePath);
        }

        console.error('Audio processing error:', error);
        return res.status(500).json({
          error: 'Audio processing failed',
          message: error.message
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

module.exports = {
  audioMessageController,
  upload
};
