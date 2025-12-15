const { v4: uuidv4 } = require('uuid');
const conversationModel = require('../../models/conversation.model');

// In-memory storage for conversations
const conversations = new Map();

/**
 * Generate a unique conversation ID
 */
function generateConversationId() {
  return uuidv4();
}

/**
 * Get or create a conversation
 */
async function getConversation(conversationId, userId = null) {
  if (!conversationId) {
    conversationId = generateConversationId();
  }
  
  if (!conversations.has(conversationId)) {
    conversations.set(conversationId, {
      id: conversationId,
      userId,
      messages: [],
      context: {
        lastCourse: null,
        lastAction: null,
        lastParameters: null,
        ongoingAction: null, // Track the current ongoing action
        requiredParameters: [], // What parameters are still needed
        collectedParameters: {}, // What parameters have been collected so far
        actionStartTime: null // When the action started
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Create conversation in database if userId is provided
    if (userId) {
      try {
        await conversationModel.createConversation({
          conversationId,
          userId,
          title: 'New Conversation'
        });
        console.log(`💾 Created conversation in database: ${conversationId}`);
      } catch (error) {
        console.error('Error creating conversation in database:', error);
        // Continue even if database save fails (fall back to in-memory only)
      }
    }
  }
  
  return conversations.get(conversationId);
}

/**
 * Add a message to a conversation
 */
async function addMessage(conversationId, message, role = 'user') {
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    console.error('Conversation not found:', conversationId);
    return null;
  }
  
  // If the message is an object (like an API response), store it as is
  const messageContent = typeof message === 'object' ? message : {
    text: message
  };
  
  conversation.messages.push({
    role,
    content: messageContent,
    timestamp: new Date()
  });
  
  conversation.updatedAt = new Date();
  
  // Save message to database
  try {
    const contentString = typeof message === 'object' ? JSON.stringify(message) : message;
    await conversationModel.addMessage({
      conversationId,
      role,
      content: contentString,
      metadata: typeof message === 'object' ? message : null
    });
    
    // Auto-generate title if this is the first user message
    if (role === 'user' && conversation.messages.filter(m => m.role === 'user').length === 1) {
      const title = await conversationModel.generateConversationTitle(conversationId);
      await conversationModel.updateConversationTitle(conversationId, conversation.userId, title);
      console.log(`📝 Auto-generated title for conversation ${conversationId}: "${title}"`);
    }
  } catch (error) {
    console.error('Error saving message to database:', error);
    // Continue even if database save fails
  }
  
  return conversation;
}

/**
 * Start tracking an ongoing action
 */
function startOngoingAction(conversationId, action, requiredParameters, initialParameters = {}) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    console.log(`⚠️ Cannot start action - conversation not found: ${conversationId}`);
    return null;
  }
  
  conversation.context.ongoingAction = action;
  conversation.context.requiredParameters = requiredParameters;
  conversation.context.collectedParameters = { ...initialParameters };
  conversation.context.actionStartTime = new Date();
  
  conversation.updatedAt = new Date();
  
  console.log(`🚀 Started tracking action: ${action} with required params:`, requiredParameters);
  console.log(`📝 Initial parameters:`, initialParameters);
  
  return conversation;
}

/**
 * Update parameters for an ongoing action
 */
function updateOngoingActionParameters(conversationId, newParameters) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    console.log('⚠️ Cannot update parameters - conversation not found');
    return null;
  }
  
  if (!conversation.context.ongoingAction) {
    console.log('⚠️ No ongoing action to update parameters for');
    return conversation;
  }
  
  // Merge new parameters with existing ones
  conversation.context.collectedParameters = {
    ...conversation.context.collectedParameters,
    ...newParameters
  };
  
  conversation.updatedAt = new Date();
  
  console.log(`📝 Updated parameters for ${conversation.context.ongoingAction}:`, newParameters);
  console.log(`📋 All collected parameters:`, conversation.context.collectedParameters);
  
  return conversation;
}

/**
 * Check if an action is complete (all required parameters collected)
 */
function isActionComplete(conversationId) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation || !conversation.context.ongoingAction) {
    return true; // No conversation or no ongoing action
  }
  
  const { requiredParameters, collectedParameters } = conversation.context;
  
  // Check if all required parameters are present
  const isComplete = requiredParameters.every(param => {
    const value = collectedParameters[param];
    return value !== undefined && value !== null && value !== '';
  });
  
  console.log(`🔍 Action completion check for ${conversation.context.ongoingAction}:`, {
    required: requiredParameters,
    collected: Object.keys(collectedParameters),
    isComplete
  });
  
  return isComplete;
}

/**
 * Get the current ongoing action context
 */
function getOngoingActionContext(conversationId) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation || !conversation.context.ongoingAction) {
    return null;
  }
  
  // Check if the action has timed out (15 minutes)
  const actionStartTime = conversation.context.actionStartTime;
  if (actionStartTime) {
    const now = new Date();
    const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
    
    if (now - actionStartTime > fifteenMinutes) {
      console.log(`⏰ Action ${conversation.context.ongoingAction} timed out after 15 minutes. Auto-resetting context.`);
      // Auto-reset the context
      conversation.context.ongoingAction = null;
      conversation.context.requiredParameters = [];
      conversation.context.collectedParameters = {};
      conversation.context.actionStartTime = null;
      conversation.updatedAt = new Date();
      return null;
    }
  }
  
  return {
    action: conversation.context.ongoingAction,
    requiredParameters: conversation.context.requiredParameters,
    collectedParameters: conversation.context.collectedParameters,
    missingParameters: conversation.context.requiredParameters.filter(
      param => !conversation.context.collectedParameters[param] || 
               conversation.context.collectedParameters[param] === ''
    ),
    actionStartTime: conversation.context.actionStartTime
  };
}

/**
 * Complete an ongoing action (clear the tracking)
 */
function completeOngoingAction(conversationId) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    console.log('⚠️ Cannot complete action - conversation not found');
    return null;
  }
  
  if (!conversation.context.ongoingAction) {
    console.log('⚠️ No ongoing action to complete');
    return conversation;
  }
  
  console.log(`✅ Completed action: ${conversation.context.ongoingAction}`);
  
  // Clear the ongoing action context
  conversation.context.ongoingAction = null;
  conversation.context.requiredParameters = [];
  conversation.context.collectedParameters = {};
  conversation.context.actionStartTime = null;
  
  conversation.updatedAt = new Date();
  
  return conversation;
}

/**
 * Check if user is trying to start a new action while one is in progress
 */
function isNewActionAttempt(conversationId, newIntent) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation || !conversation.context.ongoingAction) {
    return false; // No conversation or no ongoing action, so this can't be a new action attempt
  }
  
  // List of intents that start new actions
  const actionStartingIntents = [
    'CREATE_COURSE',
    'CREATE_ASSIGNMENT', 
    'CREATE_ANNOUNCEMENT',
    'CREATE_MEETING',
    'INVITE_STUDENTS',
    'INVITE_TEACHERS',
    'LIST_COURSES',
    'LIST_ASSIGNMENTS',
    'GET_ANNOUNCEMENTS',
    'CHECK_ASSIGNMENT_SUBMISSIONS',
    'GRADE_ASSIGNMENT',
    'UPDATE_MEETING',
    'DELETE_MEETING'
  ];
  
  const isNewAction = actionStartingIntents.includes(newIntent);
  
  console.log(`🔍 New action attempt check:`, {
    ongoingAction: conversation.context.ongoingAction,
    newIntent,
    isNewAction,
    isActionStartingIntent: actionStartingIntents.includes(newIntent)
  });
  
  return isNewAction;
}

/**
 * Get a context-aware message for ongoing actions
 */
function getContextAwareMessage(conversationId) {
  const context = getOngoingActionContext(conversationId);
  
  if (!context) {
    return null;
  }
  
  const { action, missingParameters, collectedParameters } = context;
  
  // Generate context-aware messages based on the action type
  switch (action) {
    case 'CREATE_COURSE':
      if (missingParameters.includes('name')) {
        return `What would you like to call your new course?`;
      }
      break;
      
    case 'CREATE_ASSIGNMENT':
      if (missingParameters.includes('title')) {
        return `What should I call this assignment?`;
      }
      if (missingParameters.includes('courseName')) {
        return `Which course should I create this assignment in?`;
      }
      break;
      
    case 'CREATE_ANNOUNCEMENT':
      if (missingParameters.includes('announcementText')) {
        return `What would you like to announce?`;
      }
      if (missingParameters.includes('courseName')) {
        return `Which course should I post this announcement in?`;
      }
      break;
      
    case 'CREATE_MEETING':
      if (missingParameters.includes('title')) {
        return `What should I call this meeting?`;
      }
      if (missingParameters.includes('attendees')) {
        return `Who should I invite to this meeting?`;
      }
      if (missingParameters.includes('dateExpr')) {
        return `When should I schedule this meeting?`;
      }
      if (missingParameters.includes('timeExpr')) {
        return `What time should I schedule this meeting for?`;
      }
      break;
      
    case 'INVITE_STUDENTS':
      if (missingParameters.includes('courseName')) {
        return `Which course should I invite the students to?`;
      }
      if (missingParameters.includes('studentEmails')) {
        return `Which students should I invite?`;
      }
      break;
  }
  
  // Generic message if no specific case matches
  if (missingParameters.length > 0) {
    return `I'm still working on ${action.toLowerCase().replace(/_/g, ' ')}. I still need: ${missingParameters.join(', ')}.`;
  }
  
  return null;
}

/**
 * Update conversation context
 */
function updateContext(conversationId, context) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    console.log('⚠️ Cannot update context - conversation not found');
    return null;
  }
  
  conversation.context = {
    ...conversation.context,
    ...context,
    lastUpdated: new Date()
  };
  
  conversation.updatedAt = new Date();
  
  return conversation;
}

/**
 * Get conversation history in a format suitable for the AI model
 */
function getFormattedHistory(conversationId) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    return [];
  }
  
  return conversation.messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content
  }));
}

/**
 * Get the last message from a conversation
 */
function getLastMessage(conversationId) {
  const conversation = conversations.get(conversationId);
  if (!conversation || !conversation.messages) {
    return null;
  }
  return conversation.messages[conversation.messages.length - 1];
}

/**
 * Get the last N messages from a conversation
 */
function getLastMessages(conversationId, count = 5) {
  const conversation = conversations.get(conversationId);
  if (!conversation || !conversation.messages) {
    return [];
  }
  return conversation.messages.slice(-count);
}

/**
 * Reset conversation context (clear ongoing actions without deleting history)
 */
function resetConversationContext(conversationId) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    console.log(`⚠️ Cannot reset context - conversation not found: ${conversationId}`);
    return null;
  }
  
  // Clear ongoing action context but keep messages
  conversation.context.ongoingAction = null;
  conversation.context.requiredParameters = [];
  conversation.context.collectedParameters = {};
  conversation.context.actionStartTime = null;
  conversation.context.lastAction = null;
  conversation.context.lastParameters = null;
  
  conversation.updatedAt = new Date();
  
  console.log(`🔄 Reset conversation context for: ${conversationId}`);
  
  return conversation;
}

/**
 * Clear a conversation
 */
function clearConversation(conversationId) {
  if (conversations.has(conversationId)) {
    conversations.delete(conversationId);
  }
}

/**
 * Get all conversations
 */
function getAllConversations() {
  return Array.from(conversations.values());
}

/**
 * Clean up old conversations (older than 24 hours)
 */
function cleanupOldConversations() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  for (const [id, conversation] of conversations.entries()) {
    if (conversation.updatedAt < oneDayAgo) {
      conversations.delete(id);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupOldConversations, 60 * 60 * 1000);

module.exports = {
  generateConversationId,
  getConversation,
  addMessage,
  updateContext,
  getFormattedHistory,
  getLastMessage,
  getLastMessages,
  clearConversation,
  getAllConversations,
  // New functions for action tracking
  startOngoingAction,
  updateOngoingActionParameters,
  isActionComplete,
  getOngoingActionContext,
  completeOngoingAction,
  isNewActionAttempt,
  getContextAwareMessage,
  resetConversationContext
}; 