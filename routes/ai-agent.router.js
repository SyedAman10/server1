const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');

// Initialize Gemini Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash" });

// Protect all AI agent routes
router.use(authenticate);

/**
 * Main entry point for the conversational AI agent
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userToken = req.headers.authorization;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Process the user message with Gemini to detect intent
    const intent = await detectIntent(message, conversationHistory);
    
    // Execute actions based on the detected intent
    const response = await executeAction(intent, message, userToken, req);
    
    res.json({
      response,
      intent
    });
  } catch (error) {
    console.error('AI Agent error:', error);
    res.status(500).json({ 
      error: 'An error occurred processing your request',
      details: error.message
    });
  }
});

/**
 * Detect the user's intent using Google's Gemini Flash API
 */
async function detectIntent(message, conversationHistory) {
  try {
    // Format conversation history for Gemini
    const formattedHistory = conversationHistory.map(entry => ({
      role: entry.isUser ? 'user' : 'model',
      parts: [{ text: entry.message }]
    }));

    // Create a new chat session
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      }
    });

    // Structure prompt to classify the intent
    const prompt = `
      Act as an intent classifier for a classroom management system.
      Classify the following message into one of these intents:
      - LIST_COURSES: User wants to see their courses
      - GET_COURSE: User wants details about a specific course (extract courseId if possible)
      - CREATE_COURSE: User wants to create a new course (extract course details if provided)
      - UPDATE_COURSE: User wants to update a course (extract courseId and details)
      - DELETE_COURSE: User wants to delete a course (extract courseId)
      - ARCHIVE_COURSE: User wants to archive a course (extract courseId)
      - HELP: User needs help or instructions
      - UNKNOWN: None of the above
      
      User message: "${message}"
      
      Respond in JSON format only with the following structure:
      {
        "intent": "INTENT_NAME",
        "confidence": 0.0-1.0,
        "parameters": {
          // Any extracted parameters like courseId, name, description, etc.
        }
      }
    `;

    // Get the response from Gemini
    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();
    
    // Parse the JSON response
    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing Gemini response as JSON:', e);
      console.log('Raw response:', responseText);
      return { intent: 'UNKNOWN', confidence: 0, parameters: {} };
    }
  } catch (error) {
    console.error('Intent detection error:', error);
    return { intent: 'UNKNOWN', confidence: 0, parameters: {} };
  }
}

/**
 * Execute the appropriate action based on the detected intent
 */
async function executeAction(intentData, originalMessage, userToken, req) {
  const { intent, parameters } = intentData;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  try {
    switch (intent) {
      case 'LIST_COURSES':
        return await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken);
        
      case 'GET_COURSE':
        if (!parameters.courseId) {
          return "I need a course ID to get course details. Which course are you interested in?";
        }
        return await makeApiCall(`${baseUrl}/api/classroom/${parameters.courseId}`, 'GET', null, userToken);
        
      case 'CREATE_COURSE':
        if (!parameters.name) {
          return "To create a course, I need at least a course name. Please provide more details.";
        }
        
        const courseData = {
          name: parameters.name,
          section: parameters.section || '',
          descriptionHeading: parameters.descriptionHeading || '',
          description: parameters.description || '',
          room: parameters.room || ''
        };
        
        return await makeApiCall(`${baseUrl}/api/classroom`, 'POST', courseData, userToken);
        
      case 'UPDATE_COURSE':
        if (!parameters.courseId) {
          return "I need a course ID to update a course. Which course would you like to update?";
        }
        
        const updateData = {};
        if (parameters.name) updateData.name = parameters.name;
        if (parameters.section) updateData.section = parameters.section;
        if (parameters.description) updateData.description = parameters.description;
        if (parameters.room) updateData.room = parameters.room;
        if (parameters.descriptionHeading) updateData.descriptionHeading = parameters.descriptionHeading;
        
        return await makeApiCall(`${baseUrl}/api/classroom/${parameters.courseId}`, 'PATCH', updateData, userToken);
        
      case 'DELETE_COURSE':
        if (!parameters.courseId) {
          return "I need a course ID to delete a course. Which course would you like to delete?";
        }
        return await makeApiCall(`${baseUrl}/api/classroom/${parameters.courseId}`, 'DELETE', null, userToken);
        
      case 'ARCHIVE_COURSE':
        if (!parameters.courseId) {
          return "I need a course ID to archive a course. Which course would you like to archive?";
        }
        return await makeApiCall(`${baseUrl}/api/classroom/${parameters.courseId}/archive`, 'PATCH', {}, userToken);
        
      case 'HELP':
        return `
          I can help you manage your Google Classroom courses. Here's what you can ask me to do:
          
          - List all your courses
          - Get details about a specific course
          - Create a new course
          - Update a course's information
          - Delete a course
          - Archive a course
          
          For example, you can say:
          - "Show me all my courses"
          - "Tell me about my Math 101 course"
          - "Create a new History class"
          - "Update the description of my Biology course"
          - "Delete my test course"
          - "Archive my last semester's Physics course"
        `;
        
      case 'UNKNOWN':
      default:
        return "I'm not sure what you're asking. Could you rephrase your request? You can ask me to list, create, update, or manage your classroom courses.";
    }
  } catch (error) {
    console.error('Action execution error:', error);
    if (error.response && error.response.data) {
      return `Error: ${error.response.data.error || 'An error occurred'}`;
    }
    return "Sorry, I couldn't complete that action. Please try again later.";
  }
}

/**
 * Helper function to make API calls to our backend endpoints
 */
async function makeApiCall(url, method, data, userToken) {
  try {
    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Authorization': userToken,
        'Content-Type': 'application/json'
      }
    });

    // Format the response based on the API call
    if (method === 'DELETE') {
      return "Course successfully deleted.";
    }
    
    if (Array.isArray(response.data)) {
      // Format course list
      if (response.data.length === 0) {
        return "You don't have any courses yet.";
      }
      
      return {
        message: "Here are your courses:",
        courses: response.data.map(course => ({
          id: course.id,
          name: course.name,
          section: course.section,
          state: course.courseState
        }))
      };
    } else {
      // Format single course response
      const result = response.data;
      
      if (method === 'POST') {
        return `Successfully created course: ${result.name} (ID: ${result.id})`;
      } else if (method === 'PATCH' && url.includes('/archive')) {
        return `Successfully archived course: ${result.name}`;
      } else if (method === 'PATCH') {
        return `Successfully updated course: ${result.name}`;
      } else {
        // GET single course response
        return {
          message: "Here are the course details:",
          course: {
            id: result.id,
            name: result.name,
            section: result.section || "No section",
            description: result.description || "No description",
            room: result.room || "No room assigned",
            state: result.courseState,
            creationTime: result.creationTime,
            updateTime: result.updateTime,
            enrollmentCode: result.enrollmentCode
          }
        };
      }
    }
  } catch (error) {
    console.error('API call error:', error);
    if (error.response) {
      throw new Error(error.response.data.error || 'API request failed');
    }
    throw new Error('Network error when contacting the API');
  }
}

// Add a route for multi-turn conversations to handle follow-up questions
router.post('/conversation', async (req, res) => {
  try {
    const { message, conversationId = null, context = {} } = req.body;
    const userToken = req.headers.authorization;
    
    // Here you would implement logic to:
    // 1. Retrieve or create a conversation session
    // 2. Process the message considering the conversation context
    // 3. Potentially update the context based on detected entities
    
    // For now, simplified implementation
    const intent = await detectIntent(message, context.history || []);
    const response = await executeAction(intent, message, userToken, req);
    
    // Generate a new conversation ID if one doesn't exist
    const activeConversationId = conversationId || generateConversationId();
    
    res.json({
      conversationId: activeConversationId,
      response,
      intent,
      context: {
        ...context,
        history: [
          ...(context.history || []),
          { isUser: true, message },
          { isUser: false, message: typeof response === 'string' ? response : JSON.stringify(response) }
        ],
        lastIntent: intent
      }
    });
  } catch (error) {
    console.error('Conversation error:', error);
    res.status(500).json({ error: 'An error occurred in the conversation', details: error.message });
  }
});

/**
 * Generate a unique conversation ID
 */
function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

module.exports = router;