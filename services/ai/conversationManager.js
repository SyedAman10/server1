const { v4: uuidv4 } = require('uuid');

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
function getConversation(conversationId) {
  if (!conversationId) {
    conversationId = generateConversationId();
  }
  
  if (!conversations.has(conversationId)) {
    conversations.set(conversationId, {
      id: conversationId,
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
  }
  
  return conversations.get(conversationId);
}

/**
 * Add a message to a conversation
 */
function addMessage(conversationId, message, role = 'user') {
  const conversation = getConversation(conversationId);
  
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
  
  return conversation;
}

/**
 * Start tracking an ongoing action
 */
function startOngoingAction(conversationId, action, requiredParameters, initialParameters = {}) {
  const conversation = getConversation(conversationId);
  
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
  const conversation = getConversation(conversationId);
  
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
  const conversation = getConversation(conversationId);
  
  if (!conversation.context.ongoingAction) {
    return true; // No ongoing action
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
  const conversation = getConversation(conversationId);
  
  if (!conversation.context.ongoingAction) {
    return null;
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
  const conversation = getConversation(conversationId);
  
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
  const conversation = getConversation(conversationId);
  
  if (!conversation.context.ongoingAction) {
    return false; // No ongoing action, so this can't be a new action attempt
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
        return `I'm still waiting for the course name to create your course. What would you like to call it?`;
      }
      break;
      
    case 'CREATE_ASSIGNMENT':
      if (missingParameters.includes('title')) {
        return `I'm still waiting for the assignment title. What would you like to call this assignment?`;
      }
      if (missingParameters.includes('courseName')) {
        return `I'm still waiting for the course name. Which course should I create the assignment "${collectedParameters.title || 'this assignment'}" in?`;
      }
      break;
      
    case 'CREATE_ANNOUNCEMENT':
      if (missingParameters.includes('announcementText')) {
        return `I'm still waiting for the announcement text. What would you like to announce?`;
      }
      if (missingParameters.includes('courseName')) {
        return `I'm still waiting for the course name. Which course should I post the announcement in?`;
      }
      break;
      
    case 'CREATE_MEETING':
      if (missingParameters.includes('title')) {
        return `I'm still waiting for the meeting title. What should I call this meeting?`;
      }
      if (missingParameters.includes('attendees')) {
        return `I'm still waiting for the attendee emails. Who should I invite to the meeting "${collectedParameters.title || 'this meeting'}"?`;
      }
      if (missingParameters.includes('dateExpr')) {
        return `I'm still waiting for the meeting date. When should I schedule the meeting "${collectedParameters.title || 'this meeting'}"?`;
      }
      if (missingParameters.includes('timeExpr')) {
        return `I'm still waiting for the meeting time. What time should I schedule the meeting "${collectedParameters.title || 'this meeting'}" for?`;
      }
      break;
      
    case 'INVITE_STUDENTS':
      if (missingParameters.includes('courseName')) {
        return `I'm still waiting for the course name. Which course should I invite the students to?`;
      }
      if (missingParameters.includes('studentEmails')) {
        return `I'm still waiting for the student emails. Which students should I invite to the course?`;
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
  const conversation = getConversation(conversationId);
  
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
  const conversation = getConversation(conversationId);
  
  return conversation.messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content
  }));
}

/**
 * Get the last message from a conversation
 */
function getLastMessage(conversationId) {
  const conversation = getConversation(conversationId);
  return conversation.messages[conversation.messages.length - 1];
}

/**
 * Get the last N messages from a conversation
 */
function getLastMessages(conversationId, count = 5) {
  const conversation = getConversation(conversationId);
  return conversation.messages.slice(-count);
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
  getContextAwareMessage
}; 