const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { detectIntent } = require('../services/ai/intentDetection');
const { executeAction } = require('../services/ai/actionExecution');
const {
  generateConversationId,
  getConversation,
  addMessage,
  updateContext,
  getFormattedHistory
} = require('../services/ai/conversationManager');

// Initialize Gemini Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// In-memory store for conversation contexts (replace with a database in production)
const conversationStore = new Map();

/**
 * Process a single message from the user
 */
const processMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const userToken = req.headers.authorization;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Process the user message with Gemini to detect intent
    const intent = await detectIntent(message, []);
    
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
};

/**
 * Handle a conversation message with context
 */
const handleConversation = async (req, res) => {
  try {
    const { message, conversationId = null, context = {} } = req.body;
    const userToken = req.headers.authorization;
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required',
        conversationId: conversationId || generateConversationId()
      });
    }

    // Retrieve existing conversation or create new one
    let currentContext = context;
    if (conversationId && conversationStore.has(conversationId)) {
      currentContext = conversationStore.get(conversationId);
    }

    // Check if we're in the middle of a disambiguation process
    if (currentContext.pendingAction) {
      try {
        // Handle the response to the pending action
        if (currentContext.pendingAction.type === 'COURSE_DISAMBIGUATION_NEEDED') {
          // Try to find the selected course from the user's response
          const selectedCourse = currentContext.pendingAction.options.find(option => 
            message.toLowerCase().includes(option.name.toLowerCase()) || 
            message.includes(option.id)
          );

          if (selectedCourse) {
            // Clear the pending action and proceed with the original request
            const studentEmails = currentContext.pendingAction.studentEmails;
            currentContext.pendingAction = null;
            
            try {
              // Process the invitation with the selected course
              const invitationPromises = studentEmails.map(email => 
                makeApiCall(`${req.protocol}://${req.get('host')}/api/classroom/${selectedCourse.id}/invite`, 'POST', { email }, userToken)
              );
              
              await Promise.all(invitationPromises);
              
              // Update context with the result
              const updatedContext = {
                ...currentContext,
                history: [
                  ...(currentContext.history || []),
                  { isUser: true, message },
                  { isUser: false, message: `Successfully invited ${studentEmails.length} students to ${selectedCourse.name}.` }
                ]
              };
              
              conversationStore.set(conversationId, updatedContext);
              
              return res.json({
                conversationId,
                response: `Successfully invited ${studentEmails.length} students to ${selectedCourse.name}.`,
                context: updatedContext
              });
            } catch (inviteError) {
              console.error('Error sending invitations:', inviteError);
              return res.json({
                conversationId,
                response: "I encountered an error while sending the invitations. Please try again.",
                error: inviteError.message,
                context: currentContext
              });
            }
          }
        }
      } catch (pendingActionError) {
        console.error('Error processing pending action:', pendingActionError);
        // Clear the pending action if there was an error
        currentContext.pendingAction = null;
      }
    }

    try {
      // Process the user message with Gemini to detect intent
      const intent = await detectIntent(message, currentContext.history || []);
      const response = await executeAction(intent, message, userToken, req);
      
      // Generate a new conversation ID if one doesn't exist
      const activeConversationId = conversationId || generateConversationId();
      
      // If the response indicates we need disambiguation, store it in the context
      if (response && response.type === 'COURSE_DISAMBIGUATION_NEEDED') {
        currentContext.pendingAction = {
          type: 'COURSE_DISAMBIGUATION_NEEDED',
          options: response.options,
          studentEmails: response.studentEmails
        };
      } else {
        // Clear any pending action if we're not in a disambiguation flow
        currentContext.pendingAction = null;
      }
      
      // Update context with new message and response
      const updatedContext = {
        ...currentContext,
        history: [
          ...(currentContext.history || []),
          { isUser: true, message },
          { isUser: false, message: typeof response === 'string' ? response : JSON.stringify(response) }
        ],
        lastIntent: intent
      };
      
      // Save the updated context
      conversationStore.set(activeConversationId, updatedContext);
      
      res.json({
        conversationId: activeConversationId,
        response,
        intent,
        context: updatedContext
      });
    } catch (processingError) {
      console.error('Error processing message:', processingError);
      res.json({
        conversationId: conversationId || generateConversationId(),
        response: "I encountered an error while processing your message. Please try again.",
        error: processingError.message,
        context: currentContext
      });
    }
  } catch (error) {
    console.error('Conversation error:', error);
    res.status(500).json({ 
      error: 'An error occurred in the conversation', 
      details: error.message,
      conversationId: req.body.conversationId || generateConversationId()
    });
  }
};

/**
 * Save conversation context
 */
const saveContext = async (req, res) => {
  try {
    const { conversationId, context } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    conversationStore.set(conversationId, context);
    res.json({ success: true });
  } catch (error) {
    console.error('Save context error:', error);
    res.status(500).json({ error: 'Failed to save context' });
  }
};

/**
 * Get conversation context
 */
const getContext = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    const context = conversationStore.has(conversationId) 
      ? conversationStore.get(conversationId)
      : null;
      
    res.json({ conversationId, context });
  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({ error: 'Failed to retrieve context' });
  }
};

/**
 * Calculate a date from a natural language expression
 * @param {string} dateExpr - Natural language date expression (e.g., "next Friday", "tomorrow")
 * @returns {string} Date in YYYY-MM-DD format
 */
function calculateDateFromExpression(dateExpr) {
  const today = new Date();
  const expr = dateExpr.toLowerCase().trim();
  
  // Handle "next [day]" expressions
  if (expr.startsWith('next ')) {
    const day = expr.split(' ')[1];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(day);
    
    if (targetDay !== -1) {
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // If the day has passed this week, get next week's date
      
      const result = new Date(today);
      result.setDate(today.getDate() + daysToAdd);
      return result.toISOString().split('T')[0];
    }
  }
  
  // Handle "tomorrow"
  if (expr === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Handle "next week"
  if (expr === 'next week') {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  }
  
  // Handle "in X weeks"
  const weeksMatch = expr.match(/in (\d+) weeks?/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1]);
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + (weeks * 7));
    return futureDate.toISOString().split('T')[0];
  }
  
  // Handle "end of month"
  if (expr === 'end of month') {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  }
  
  // If we can't parse the expression, return null
  return null;
}

/**
 * Convert time expression to HH:MM format
 * @param {string} timeExpr - Natural language time expression (e.g., "5 PM", "9 AM")
 * @returns {string} Time in HH:MM format
 */
function convertTimeExpression(timeExpr) {
  const expr = timeExpr.toLowerCase().trim();
  
  // Handle "noon"
  if (expr === 'noon') return '12:00';
  
  // Handle "midnight"
  if (expr === 'midnight') return '00:00';
  
  // Handle "X AM/PM" format
  const timeMatch = expr.match(/(\d+)\s*(am|pm)/);
  if (timeMatch) {
    let [_, hours, meridiem] = timeMatch;
    hours = parseInt(hours);
    
    // Convert to 24-hour format
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:00`;
  }
  
  // If we can't parse the expression, return null
  return null;
}

/**
 * Helper function to make API calls to our backend endpoints
 */
async function makeApiCall(url, method, data, userToken) {
  try {
    // Remove any existing Bearer prefix and add our own
    const cleanToken = userToken.replace(/^Bearer\s+/i, '');
    
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json'
      }
    };

    // Only add data for non-GET requests
    if (method !== 'GET' && data !== null) {
      config.data = data;
    }

    const response = await axios(config);

    // Format the response based on the API call
    if (method === 'DELETE') {
      return "Course successfully deleted.";
    }
    
    // Handle array responses (like list of courses)
    if (Array.isArray(response.data)) {
      if (response.data.length === 0) {
        return {
          message: "You don't have any courses yet.",
          courses: []
        };
      }
      
      return {
        message: "Here are your courses:",
        courses: response.data.map(course => ({
          id: course.id,
          name: course.name,
          section: course.section || "No section",
          state: course.courseState || "ACTIVE"
        }))
      };
    }

    // Handle single object responses
    const result = response.data;
    
    if (method === 'POST') {
      if (url.includes('/announcements')) {
        return {
          message: "Announcement created successfully",
          announcement: result
        };
      }
      return {
        message: `Successfully created course: ${result.name}`,
        courseId: result.id,
        course: result
      };
    } else if (method === 'PATCH' && url.includes('/archive')) {
      return {
        message: `Successfully archived course: ${result.name}`,
        course: result
      };
    } else if (method === 'PATCH') {
      return {
        message: `Successfully updated course: ${result.name}`,
        course: result
      };
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
          state: result.courseState || "ACTIVE",
          creationTime: result.creationTime,
          updateTime: result.updateTime,
          enrollmentCode: result.enrollmentCode
        }
      };
    }
  } catch (error) {
    console.error('API call error:', {
      url,
      method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      error: error.response?.data,
      headers: error.config?.headers
    });
    
    // Handle specific error cases
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const errorData = error.response.data;
      let errorMessage = 'API request failed';
      
      if (typeof errorData === 'object' && errorData.error) {
        errorMessage = errorData.error.message || errorData.error;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      }
      
      throw new Error(errorMessage);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response received from the server');
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(error.message || 'Network error when contacting the API');
    }
  }
}

/**
 * Handle incoming messages from the AI agent
 */
async function handleMessage(req, res) {
  try {
    const { message, conversationId } = req.body;
    const userToken = req.headers.authorization;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!userToken) {
      return res.status(401).json({ error: 'Authorization token is required' });
    }

    // Get or create conversation
    const conversation = getConversation(conversationId);
    
    // Add user message to conversation
    addMessage(conversation.id, message);

    // Get conversation history
    const history = getFormattedHistory(conversation.id);

    // Check if there's an ongoing action first
    const { getOngoingActionContext } = require('../services/ai/conversationManager');
    const ongoingAction = getOngoingActionContext(conversation.id);
    
    let intentData;
    if (ongoingAction) {
      // Check if the message is a new intent that should override the ongoing action
      const newIntentData = await detectIntent(message, history);
      
      // Allow certain intents to override ongoing actions
      const overrideIntents = ['CHECK_UNSUBMITTED_ASSIGNMENTS', 'CHECK_ASSIGNMENT_SUBMISSIONS', 'HIGHLIGHT_MISSING_WORK_STUDENTS', 'INVITE_STUDENTS', 'CREATE_ANNOUNCEMENT', 'CREATE_ASSIGNMENT', 'EDUCATIONAL_QUESTION', 'LIST_PENDING_ASSIGNMENTS', 'SHOW_COURSE_GRADES', 'ASSIGNMENT_SUBMISSION_HELP', 'JOIN_CLASS_HELP'];
      
      if (overrideIntents.includes(newIntentData.intent) && newIntentData.confidence > 0.8) {
        console.log('🔍 DEBUG: New intent detected, overriding ongoing action:', newIntentData.intent);
        intentData = newIntentData;
      } else {
        // If there's an ongoing action, create a dummy intent for parameter collection
        console.log('🔍 DEBUG: Ongoing action detected, skipping intent detection');
        intentData = {
          intent: 'PARAMETER_COLLECTION',
          confidence: 1.0,
          parameters: {}
        };
      }
    } else {
      // Detect intent only if no ongoing action
      intentData = await detectIntent(message, history);
    }

    // Execute action based on intent
    const result = await executeAction(intentData, message, userToken, req);

    // Add AI response to conversation
    addMessage(conversation.id, result.message || result, 'assistant');

    // Update conversation context if needed
    if (result.context) {
      updateContext(conversation.id, result.context);
    }

    // Return response
    res.json({
      conversationId: conversation.id,
      ...result
    });
  } catch (error) {
    console.error('Error in handleMessage:', error);
    res.status(500).json({
      error: 'An error occurred while processing your message',
      details: error.message
    });
  }
}

/**
 * Get conversation history
 */
function getConversationHistory(req, res) {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    const conversation = getConversation(conversationId);
    
    res.json({
      conversationId: conversation.id,
      messages: conversation.messages,
      context: conversation.context,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    });
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    res.status(500).json({
      error: 'An error occurred while retrieving conversation history',
      details: error.message
    });
  }
}

/**
 * Clear conversation history
 */
function clearConversationHistory(req, res) {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    clearConversation(conversationId);
    
    res.json({
      message: 'Conversation history cleared successfully',
      conversationId
    });
  } catch (error) {
    console.error('Error in clearConversationHistory:', error);
    res.status(500).json({
      error: 'An error occurred while clearing conversation history',
      details: error.message
    });
  }
}

// Add error handlers for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

module.exports = {
  processMessage,
  handleConversation,
  saveContext,
  getContext,
  handleMessage,
  getConversationHistory,
  clearConversationHistory
};