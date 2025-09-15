const { calculateDateFromExpression, convertTimeExpression } = require('../../utils/dateUtils');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getUserByEmail } = require('../../models/user.model');
const { 
  generateConversationId, 
  startOngoingAction, 
  updateOngoingActionParameters, 
  isActionComplete, 
  getOngoingActionContext, 
  completeOngoingAction, 
  isNewActionAttempt, 
  getContextAwareMessage 
} = require('./conversationManager');
const { createAssignment, listAssignments } = require('../assignmentService');
const { createMeeting, findMeetingByDateTime, updateMeeting, deleteMeeting, listUpcomingMeetings } = require('../meetingService');

/**
 * Check if user is trying to start a new action while one is in progress
 * If so, remind them about the ongoing action and ask if they want to continue
 */
function checkForNewActionAttempt(intent, conversationId) {
  if (!conversationId) return null;
  
  if (isNewActionAttempt(conversationId, intent)) {
    const context = getOngoingActionContext(conversationId);
    const contextMessage = getContextAwareMessage(conversationId);
    
    return {
      shouldBlock: true,
      message: `I'm still working on something else. ${contextMessage} Would you like to continue with that first? If you want to start something new, just say "cancel" or "stop".`,
      ongoingAction: context
    };
  }
  
  return null;
}

/**
 * Use AI to analyze user intent for course naming
 */
async function analyzeUserIntentForCourseNaming(userMessage, conversationId, collectedParameters = {}) {
  try {
    // Create a focused prompt for intent analysis
    const intentAnalysisPrompt = `Analyze the user's message for course naming intent. Consider the conversation context. Respond with JSON only.

User message: "${userMessage}"
Conversation context: ${JSON.stringify(collectedParameters)}

Determine if the user is:
1. Selecting a suggested course name (respond with: {"intent": "direct_name", "name": "selected_name"})
2. Providing a new course name (respond with: {"intent": "direct_name", "name": "provided_name"})
3. Describing a subject/topic for suggestions (respond with: {"intent": "subject_description", "subject": "extracted_subject"})
4. Expressing uncertainty or asking for help (respond with: {"intent": "uncertainty", "needs_help": true})
5. Asking for more suggestions (respond with: {"intent": "more_suggestions", "needs_help": true})

Examples:
- "Math 101" → {"intent": "direct_name", "name": "Math 101"}
- "introduction to finance is ok" → {"intent": "direct_name", "name": "Introduction to Finance"}
- "i'll go with calculus" → {"intent": "direct_name", "name": "Calculus"}
- "calculus sounds good" → {"intent": "direct_name", "name": "Calculus"}
- "i choose statistics" → {"intent": "direct_name", "name": "Statistics"}
- "that one" (when referring to a suggestion) → {"intent": "direct_name", "name": "the suggested name"}
- "its about mathematics" → {"intent": "subject_description", "subject": "mathematics"}
- "i dont know" → {"intent": "uncertainty", "needs_help": true}
- "tell me some options" → {"intent": "more_suggestions", "needs_help": true}
- "a different name" → {"intent": "more_suggestions", "needs_help": true}
- "something else" → {"intent": "more_suggestions", "needs_help": true}

Respond with JSON only:`;

    // Use the existing AI service to analyze intent
    const response = await makeApiCall(
      `${process.env.OPENAI_API_URL || 'https://api.openai.com/v1'}/chat/completions`,
      'POST',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that analyzes user intent for course naming. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: intentAnalysisPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.1
      },
      process.env.OPENAI_API_KEY,
      null
    );

    if (response.choices && response.choices[0] && response.choices[0].message) {
      const content = response.choices[0].message.content.trim();
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Error parsing AI intent analysis:', parseError);
        return { intent: 'uncertainty', needs_help: true };
      }
    }
    
    return { intent: 'uncertainty', needs_help: true };
  } catch (error) {
    console.error('Error in AI intent analysis:', error);
    return { intent: 'uncertainty', needs_help: true };
  }
}

/**
 * Generate course name suggestions based on subject
 */
function generateCourseNameSuggestions(subject) {
  const subjectLower = subject.toLowerCase();
  
  const suggestions = {
    math: ['Math 101', 'Algebra I', 'Calculus', 'Statistics', 'Geometry', 'Pre-Calculus'],
    english: ['English Literature', 'Creative Writing', 'Composition', 'Grammar', 'Literature Survey'],
    science: ['General Science', 'Biology', 'Chemistry', 'Physics', 'Earth Science', 'Environmental Science'],
    history: ['World History', 'US History', 'European History', 'Ancient History', 'Modern History'],
    computer: ['Computer Science', 'Programming Fundamentals', 'Web Development', 'Data Structures', 'Software Engineering'],
    art: ['Art History', 'Drawing', 'Painting', 'Digital Art', 'Art Appreciation'],
    music: ['Music Theory', 'Band', 'Choir', 'Music Appreciation', 'Piano'],
    language: ['Spanish', 'French', 'German', 'Chinese', 'Language Fundamentals'],
    business: ['Business Fundamentals', 'Entrepreneurship', 'Marketing', 'Economics', 'Accounting'],
    psychology: ['Psychology 101', 'Social Psychology', 'Developmental Psychology', 'Abnormal Psychology']
  };
  
  // Find matching subject
  for (const [key, values] of Object.entries(suggestions)) {
    if (subjectLower.includes(key)) {
      return values;
    }
  }
  
  // Default suggestions if no match
  return ['Course 101', 'Introduction to ' + subject, subject + ' Fundamentals', subject + ' Basics'];
}

/**
 * Validate if a course name is appropriate and meaningful
 */
function isValidCourseName(name) {
  if (!name || typeof name !== 'string') return false;
  
  const trimmedName = name.trim();
  
  // Check minimum length
  if (trimmedName.length < 2) return false;
  
  // Check for inappropriate content
  const inappropriatePatterns = [
    /fuck/i,
    /shit/i,
    /damn/i,
    /hell/i,
    /bitch/i,
    /ass/i,
    /i don'?t know/i,
    /whatever/i,
    /anything/i,
    /random/i,
    /your choice/i,
    /you decide/i,
    /surprise me/i,
    /beats me/i,
    /fuck if i know/i,
    /i have no idea/i
  ];
  
  if (inappropriatePatterns.some(pattern => pattern.test(trimmedName))) {
    return false;
  }
  
  // Check if it's just punctuation or numbers
  if (/^[^a-zA-Z]*$/.test(trimmedName)) return false;
  
  // Check if it's too generic
  const tooGeneric = ['test', 'course', 'class', 'new', 'name', 'title'];
  if (tooGeneric.includes(trimmedName.toLowerCase())) return false;
  
  // Check for subject description patterns that shouldn't be treated as course names
  const subjectDescriptionPatterns = [
    /^it'?s about/i,
    /^it'?s for/i,
    /^it'?s related to/i,
    /^it'?s on/i,
    /^it'?s regarding/i,
    /^the subject is/i,
    /^the topic is/i,
    /^we'?ll be studying/i,
    /^we'?ll be learning/i,
    /^we'?ll be covering/i,
    /^about/i,
    /^for/i,
    /^on/i,
    /^regarding/i,
    /^studying/i,
    /^learning/i,
    /^covering/i
  ];
  
  // Check for help request patterns that shouldn't be treated as course names
  const helpRequestPatterns = [
    /^tell me some/i,
    /^give me some/i,
    /^show me some/i,
    /^what are some/i,
    /^what other/i,
    /^any other/i,
    /^more suggestions/i,
    /^more options/i,
    /^different names/i,
    /^different options/i,
    /^other names/i,
    /^other options/i,
    /^suggest some/i,
    /^recommend some/i,
    /^help me/i,
    /^i need help/i,
    /^can you help/i,
    /^what do you suggest/i,
    /^what would you suggest/i,
    /^what should i/i,
    /^i'm not sure/i,
    /^i'm confused/i,
    /^not sure/i,
    /^confused/i
  ];
  
  if (subjectDescriptionPatterns.some(pattern => pattern.test(trimmedName)) ||
      helpRequestPatterns.some(pattern => pattern.test(trimmedName))) {
    return false;
  }
  
  return true;
}

/**
 * Use AI to analyze user intent for announcement creation
 */
async function analyzeUserIntentForAnnouncement(userMessage, conversationId, collectedParameters = {}) {
  try {
    // Create a focused prompt for intent analysis
    const intentAnalysisPrompt = `Analyze the user's message for announcement creation intent. Consider the conversation context. Respond with JSON only.

User message: "${userMessage}"
Conversation context: ${JSON.stringify(collectedParameters)}

Determine if the user is:
1. Providing announcement text (respond with: {"intent": "announcement_text", "text": "extracted_text"})
2. Providing a course name (respond with: {"intent": "course_name", "courseName": "extracted_course"})
3. Expressing uncertainty or asking for help (respond with: {"intent": "uncertainty", "needs_help": true})
4. Asking for more suggestions (respond with: {"intent": "more_suggestions", "needs_help": true})

Examples:
- "Homework is due tomorrow" → {"intent": "announcement_text", "text": "Homework is due tomorrow"}
- "Grade Islamiat class" → {"intent": "course_name", "courseName": "Grade Islamiat class"}
- "my class" → {"intent": "course_name", "courseName": "my class"}
- "i dont know" → {"intent": "uncertainty", "needs_help": true}
- "what should i say" → {"intent": "uncertainty", "needs_help": true}
- "help me" → {"intent": "uncertainty", "needs_help": true}

Respond with JSON only:`;

    // Use the existing AI service to analyze intent
    const response = await makeApiCall(
      `${process.env.OPENAI_API_URL || 'https://api.openai.com/v1'}/chat/completions`,
      'POST',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that analyzes user intent for announcement creation. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: intentAnalysisPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.1
      },
      process.env.OPENAI_API_KEY,
      null
    );

    if (response.choices && response.choices[0] && response.choices[0].message) {
      const content = response.choices[0].message.content.trim();
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Error parsing AI intent analysis:', parseError);
        return { intent: 'uncertainty', needs_help: true };
      }
    }
    
    return { intent: 'uncertainty', needs_help: true };
  } catch (error) {
    console.error('Error in AI intent analysis:', error);
    return { intent: 'uncertainty', needs_help: true };
  }
}

/**
 * Handle parameter collection for ongoing actions
 * This function processes user input to collect missing parameters
 */
async function handleParameterCollection(intent, parameters, conversationId, originalMessage) {
  if (!conversationId) return null;
  
  const context = getOngoingActionContext(conversationId);
  if (!context) return null;
  
  const { action, missingParameters, collectedParameters } = context;
  
  // Check if this message provides any of the missing parameters
  let newParameters = {};
  let parametersFound = false;
  
  switch (action) {
    case 'CREATE_COURSE':
      // Check if user provided a course name
      if (missingParameters.includes('name')) {
        // Use AI to analyze user intent
        const intentAnalysis = await analyzeUserIntentForCourseNaming(originalMessage, conversationId, collectedParameters);
        
        switch (intentAnalysis.intent) {
          case 'direct_name':
            // User provided a direct course name
            if (intentAnalysis.name && isValidCourseName(intentAnalysis.name)) {
              newParameters.name = intentAnalysis.name;
              parametersFound = true;
            } else {
              return {
                action: 'CREATE_COURSE',
                missingParameters: ['name'],
                collectedParameters: collectedParameters,
                nextMessage: `"${intentAnalysis.name || originalMessage}" doesn't seem like a proper course name. Could you provide a more descriptive name? For example: "Math 101", "English Literature", or "Computer Science Fundamentals".`,
                actionComplete: false
              };
            }
            break;
            
          case 'subject_description':
            // User described a subject - provide suggestions
            const subjectToUse = intentAnalysis.subject || originalMessage.trim();
            const suggestions = generateCourseNameSuggestions(subjectToUse);
            const suggestionList = suggestions.slice(0, 3).map(s => `• ${s}`).join('\n');
            
            // Store the subject in collected parameters for future reference
            const updatedParameters = { ...collectedParameters, subject: subjectToUse };
            
            return {
              action: 'CREATE_COURSE',
              missingParameters: ['name'],
              collectedParameters: updatedParameters,
              nextMessage: `I see you mentioned "${subjectToUse}" as the subject. Here are some course name suggestions:\n\n${suggestionList}\n\nWhich one would you like to use, or would you prefer a different name?`,
              actionComplete: false
            };
            
          case 'uncertainty':
          case 'more_suggestions':
          default:
            // User is uncertain or asking for help - provide guidance
            // Check if we already have a subject from previous context
            if (collectedParameters.subject) {
              const suggestions = generateCourseNameSuggestions(collectedParameters.subject);
              const suggestionList = suggestions.slice(0, 5).map(s => `• ${s}`).join('\n');
              
              return {
                action: 'CREATE_COURSE',
                missingParameters: ['name'],
                collectedParameters: collectedParameters,
                nextMessage: `Here are more course name suggestions for ${collectedParameters.subject}:\n\n${suggestionList}\n\nWhich one would you like to use, or would you prefer a different name?`,
                actionComplete: false
              };
            } else {
              return {
                action: 'CREATE_COURSE',
                missingParameters: ['name'],
                collectedParameters: collectedParameters,
                nextMessage: "I understand you're not sure about the name! Let me help you with some suggestions. What subject or topic will this class cover? For example:\n• Math 101\n• English Literature\n• Computer Science\n• History of Art\n\nOr if you'd prefer, I can suggest a name based on the subject you tell me about.",
                actionComplete: false
              };
            }
        }
        
        // Handle confirmation for course name
        if (missingParameters.includes('confirmed')) {
          const message = originalMessage.toLowerCase().trim();
          
          // Check for positive confirmation
          const positivePatterns = [
            /^yes$/i,
            /^y$/i,
            /^yeah$/i,
            /^yep$/i,
            /^sure$/i,
            /^ok$/i,
            /^okay$/i,
            /^correct$/i,
            /^right$/i,
            /^that's right$/i,
            /^that is correct$/i,
            /^go ahead$/i,
            /^proceed$/i,
            /^create it$/i
          ];
          
          // Check for negative confirmation
          const negativePatterns = [
            /^no$/i,
            /^n$/i,
            /^nope$/i,
            /^wrong$/i,
            /^incorrect$/i,
            /^change$/i,
            /^different$/i,
            /^not right$/i,
            /^that's not right$/i,
            /^that is not correct$/i,
            /^cancel$/i,
            /^stop$/i
          ];
          
          if (positivePatterns.some(pattern => pattern.test(message))) {
            newParameters.confirmed = true;
            parametersFound = true;
          } else if (negativePatterns.some(pattern => pattern.test(message))) {
            // User wants to change the name - reset to name collection
            return {
              action: 'CREATE_COURSE',
              missingParameters: ['name'],
              collectedParameters: {},
              nextMessage: "No problem! What would you like to call your new class instead?",
              actionComplete: false
            };
          } else {
            // Unclear response - ask for clarification
            return {
              action: 'CREATE_COURSE',
              missingParameters: ['confirmed'],
              collectedParameters: collectedParameters,
              nextMessage: "I'm not sure if you want to proceed. Please say 'yes' to create the course with this name, or 'no' if you'd like to change it.",
              actionComplete: false
            };
          }
        }
      }
      break;
      
    case 'CREATE_ASSIGNMENT':
      // Check if user provided assignment title
      if (missingParameters.includes('title')) {
        const titleMatch = originalMessage.match(/(?:called|titled|title is|call it)\s+(.+?)(?:\s|$)/i);
        if (titleMatch && titleMatch[1]) {
          newParameters.title = titleMatch[1].trim();
          parametersFound = true;
        }
        // Also check if they just said the title directly
        else if (!originalMessage.toLowerCase().includes('assignment') && 
                 !originalMessage.toLowerCase().includes('create') && 
                 !originalMessage.toLowerCase().includes('make')) {
          newParameters.title = originalMessage.trim();
          parametersFound = true;
        }
      }
      
      // Check if user provided course name
      if (missingParameters.includes('courseName')) {
        const courseMatch = originalMessage.match(/(?:in|for)\s+(.+?)(?:\s|$)/i);
        if (courseMatch && courseMatch[1]) {
          newParameters.courseName = courseMatch[1].trim();
          parametersFound = true;
        }
      }
      
      // Check if user provided due date
      if (missingParameters.includes('dueDateExpr')) {
        const datePatterns = [
          /(?:due|by)\s+(today|tomorrow|next\s+\w+|in\s+\d+\s+weeks?|end\s+of\s+month)/i,
          /(?:due|by)\s+(\w+\s+\d+)/i, // e.g., "December 15"
          /(?:due|by)\s+(\d{1,2}\/\d{1,2})/i // e.g., "12/15"
        ];
        
        for (const pattern of datePatterns) {
          const match = originalMessage.match(pattern);
          if (match && match[1]) {
            newParameters.dueDateExpr = match[1].trim();
            parametersFound = true;
            break;
          }
        }
      }
      
      // Check if user provided due time
      if (missingParameters.includes('dueTimeExpr')) {
        const timePatterns = [
          /(?:at|by)\s+(\d{1,2}:\d{2}\s*(?:am|pm)?)/i, // e.g., "5:30 PM"
          /(?:at|by)\s+(\d{1,2}\s*(?:am|pm))/i, // e.g., "5 PM"
          /(?:at|by)\s+(noon|midnight)/i
        ];
        
        for (const pattern of timePatterns) {
          const match = originalMessage.match(pattern);
          if (match && match[1]) {
            newParameters.dueTimeExpr = match[1].trim();
            parametersFound = true;
            break;
          }
        }
      }
      break;
      
      case 'CREATE_ANNOUNCEMENT':
        // Check if this is a disambiguation request first
        if (collectedParameters.needsDisambiguation) {
          return {
            action: 'CREATE_ANNOUNCEMENT',
            missingParameters: ['courseName'],
            collectedParameters: {},
            nextMessage: `I need to know which specific class you're referring to. Could you please tell me the name of the class? For example: "Grade Islamiat class" or "Math 101".`,
            actionComplete: false
          };
        }
        
        // If we're waiting for a course name, treat the user's response as a course name
        if (missingParameters.includes('courseName')) {
          const courseName = originalMessage.trim();
          
          // Check if it's a generic term that needs clarification
          const genericTerms = [
            'my class', 'my course', 'the class', 'the course', 'class', 'course',
            'it', 'this', 'that', 'one', 'some', 'any', 'a class', 'a course'
          ];
          
          if (genericTerms.includes(courseName.toLowerCase())) {
            return {
              action: 'CREATE_ANNOUNCEMENT',
              missingParameters: ['courseName'],
              collectedParameters: collectedParameters,
              nextMessage: `I need to know which specific class you're referring to. Could you please tell me the name of the class? For example: "Grade Islamiat class" or "Math 101".`,
              actionComplete: false
            };
          }
          
          // Accept the course name if it's not generic
          newParameters.courseName = courseName;
          parametersFound = true;
        }
        // If we're waiting for announcement text, treat the user's response as announcement text
        else if (missingParameters.includes('announcementText')) {
          const announcementText = originalMessage.trim();
          if (announcementText.length > 0) {
            newParameters.announcementText = announcementText;
            parametersFound = true;
          }
        }
        // If we're not sure what we're waiting for, use AI analysis
        else {
          // Use AI to analyze user intent for announcement creation
          const announcementIntent = await analyzeUserIntentForAnnouncement(originalMessage, conversationId, collectedParameters);
          
          switch (announcementIntent.intent) {
            case 'announcement_text':
              // User provided announcement text
              if (announcementIntent.text && announcementIntent.text.trim().length > 0) {
                newParameters.announcementText = announcementIntent.text.trim();
                parametersFound = true;
              }
              break;
              
            case 'course_name':
              // User provided course name
              const courseName = announcementIntent.courseName || originalMessage.trim();
              
              // Check if it's a generic term that needs clarification
              const genericTerms = [
                'my class', 'my course', 'the class', 'the course', 'class', 'course',
                'it', 'this', 'that', 'one', 'some', 'any', 'a class', 'a course'
              ];
              
              if (genericTerms.includes(courseName.toLowerCase())) {
                return {
                  action: 'CREATE_ANNOUNCEMENT',
                  missingParameters: ['courseName'],
                  collectedParameters: collectedParameters,
                  nextMessage: `I need to know which specific class you're referring to. Could you please tell me the name of the class? For example: "Grade Islamiat class" or "Math 101".`,
                  actionComplete: false
                };
              }
              
              // Check if the course name is too short or unclear
              if (courseName.length < 3) {
                return {
                  action: 'CREATE_ANNOUNCEMENT',
                  missingParameters: ['courseName'],
                  collectedParameters: collectedParameters,
                  nextMessage: `"${courseName}" seems too short to be a class name. Could you please provide the full name of the class? For example: "Grade Islamiat class" or "Math 101".`,
                  actionComplete: false
                };
              }
              
              newParameters.courseName = courseName;
              parametersFound = true;
              break;
              
            case 'uncertainty':
            case 'more_suggestions':
            default:
              // User is uncertain or asking for help - provide guidance
              if (missingParameters.includes('announcementText')) {
                return {
                  action: 'CREATE_ANNOUNCEMENT',
                  missingParameters: ['announcementText'],
                  collectedParameters: collectedParameters,
                  nextMessage: "I'd be happy to help you create an announcement! What would you like to announce to your students? For example:\n• Homework reminder\n• Class schedule change\n• Important updates\n• Assignment due dates\n\nJust tell me what you want to say.",
                  actionComplete: false
                };
              } else if (missingParameters.includes('courseName')) {
                return {
                  action: 'CREATE_ANNOUNCEMENT',
                  missingParameters: ['courseName'],
                  collectedParameters: collectedParameters,
                  nextMessage: "Which class would you like to post this announcement to? Please tell me the name of the class, for example: 'Grade Islamiat class' or 'Math 101'.",
                  actionComplete: false
                };
              }
              break;
          }
        }
        break;
      
    case 'CREATE_MEETING':
      // Check if user provided meeting title
      if (missingParameters.includes('title')) {
        if (!originalMessage.toLowerCase().includes('meeting') && 
            !originalMessage.toLowerCase().includes('create') && 
            !originalMessage.toLowerCase().includes('schedule')) {
          newParameters.title = originalMessage.trim();
          parametersFound = true;
        }
      }
      
      // Check if user provided attendees
      if (missingParameters.includes('attendees')) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = originalMessage.match(emailRegex) || [];
        if (emails.length > 0) {
          newParameters.attendees = emails;
          parametersFound = true;
        }
      }
      
      // Check if user provided date
      if (missingParameters.includes('dateExpr')) {
        const datePatterns = [
          /(today|tomorrow|next\s+\w+|in\s+\d+\s+weeks?|end\s+of\s+month)/i,
          /(\w+\s+\d+)/i, // e.g., "December 15"
          /(\d{1,2}\/\d{1,2})/i // e.g., "12/15"
        ];
        
        for (const pattern of datePatterns) {
          const match = originalMessage.match(pattern);
          if (match && match[1]) {
            newParameters.dateExpr = match[1].trim();
            parametersFound = true;
            break;
          }
        }
      }
      
      // Check if user provided time
      if (missingParameters.includes('timeExpr')) {
        const timePatterns = [
          /(\d{1,2}:\d{2}\s*(?:am|pm)?)/i, // e.g., "5:30 PM"
          /(\d{1,2}\s*(?:am|pm))/i, // e.g., "5 PM"
          /(noon|midnight)/i
        ];
        
        for (const pattern of timePatterns) {
          const match = originalMessage.match(pattern);
          if (match && match[1]) {
            newParameters.timeExpr = match[1].trim();
            parametersFound = true;
            break;
          }
        }
      }
      break;
      
    case 'INVITE_STUDENTS':
      // Check if user provided course name
      if (missingParameters.includes('courseName')) {
        const courseMatch = originalMessage.match(/(?:to|in)\s+(.+?)(?:\s|$)/i);
        if (courseMatch && courseMatch[1]) {
          newParameters.courseName = courseMatch[1].trim();
          parametersFound = true;
        }
        
        // Also check for "add student to class" pattern
        const addToClassMatch = originalMessage.match(/add\s+student\s+to\s+(.+)/i);
        if (addToClassMatch && addToClassMatch[1]) {
          newParameters.courseName = addToClassMatch[1].trim();
          parametersFound = true;
        }
      }
      
      // Check if user provided student emails
      if (missingParameters.includes('studentEmails')) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = originalMessage.match(emailRegex) || [];
        if (emails.length > 0) {
          newParameters.studentEmails = emails;
          parametersFound = true;
        }
      }
      break;
  }
  
  if (parametersFound) {
    // Update the ongoing action with new parameters
    updateOngoingActionParameters(conversationId, newParameters);
    
    // Check if the action is now complete
    if (isActionComplete(conversationId)) {
      return {
        actionComplete: true,
        action: action,
        allParameters: { ...collectedParameters, ...newParameters }
      };
    } else {
      // Still missing some parameters
      const updatedContext = getOngoingActionContext(conversationId);
      const nextMessage = getContextAwareMessage(conversationId);
      
      return {
        actionComplete: false,
        action: action,
        collectedParameters: { ...collectedParameters, ...newParameters },
        missingParameters: updatedContext.missingParameters,
        nextMessage: nextMessage
      };
    }
  }
  
  return null;
}

/**
 * Reusable function to find and match courses by name
 * Uses the same advanced matching logic for all intents
 */
async function findMatchingCourse(courseName, userToken, req, baseUrl) {
  try {
    // Get all courses to find the matching one
    let coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
    
    if (!coursesResponse || !coursesResponse.courses || !Array.isArray(coursesResponse.courses)) {
      // Handle cases where coursesResponse might be directly an array
      if (Array.isArray(coursesResponse)) {
        console.log('DEBUG: coursesResponse is directly an array, using it');
        coursesResponse = { courses: coursesResponse };
      } else if (coursesResponse && typeof coursesResponse === 'object') {
        // Look for array properties in the response
        const arrayProps = Object.keys(coursesResponse).filter(key => Array.isArray(coursesResponse[key]));
        if (arrayProps.length > 0) {
          const firstArrayProp = arrayProps[0];
          console.log(`DEBUG: Using array property: ${firstArrayProp}`);
          coursesResponse = { courses: coursesResponse[firstArrayProp] };
        } else {
          console.log('DEBUG: Still no valid courses found after fallback');
          return { success: false, message: "I couldn't find your courses. Please try again." };
        }
      } else {
        console.log('DEBUG: No courses found or invalid response format');
        console.log('DEBUG: coursesResponse type:', typeof coursesResponse);
        console.log('DEBUG: coursesResponse keys:', coursesResponse ? Object.keys(coursesResponse) : 'null');
        console.log('DEBUG: courses property:', coursesResponse?.courses);
        console.log('DEBUG: isArray:', Array.isArray(coursesResponse?.courses));
        return { success: false, message: "I couldn't find your courses. Please try again." };
      }
    }
    
    console.log('DEBUG: Total courses found:', coursesResponse.courses.length);
    console.log('DEBUG: Course names:', coursesResponse.courses.map(c => c.name));
    
    const searchTerm = (courseName || '').toLowerCase();
    console.log('DEBUG: Search term:', searchTerm);
    
    // Check for generic terms that should prompt for clarification
    const genericTerms = [
      'my class', 'my course', 'the class', 'the course', 'class', 'course',
      'it', 'this', 'that', 'one', 'some', 'any', 'a class', 'a course'
    ];
    
    if (genericTerms.includes(searchTerm)) {
      console.log('DEBUG: Generic term detected, asking for clarification');
      return { 
        success: false, 
        message: `I need to know which specific class you're referring to. Could you please tell me the name of the class? For example: "Grade Islamiat class" or "Math 101".` 
      };
    }
    
    // Split search term into words for better matching
    const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
    
    // More flexible course matching
    const matchingCourses = coursesResponse.courses.filter(course => {
      if (!course.name) return false;
      
      const courseName = course.name.toLowerCase();
      
      // Check if all search words are found in the course name
      const allWordsMatch = searchWords.every(word => courseName.includes(word));
      
      // Also check if course name contains the full search term
      const fullTermMatch = courseName.includes(searchTerm);
      
      // Check if search term contains the course name (for partial matches)
      const reverseMatch = searchTerm.includes(courseName);
      
      // Check for exact match (highest priority)
      const exactMatch = courseName === searchTerm;
      
      const isMatch = exactMatch || allWordsMatch || fullTermMatch || reverseMatch;
      
      console.log(`DEBUG: Course "${course.name}" (${courseName}) vs search "${searchTerm}":`);
      console.log(`  - Exact match: ${exactMatch}`);
      console.log(`  - All words match: ${allWordsMatch} (words: ${searchWords.join(', ')})`);
      console.log(`  - Full term match: ${fullTermMatch}`);
      console.log(`  - Reverse match: ${reverseMatch}`);
      console.log(`  - Final result: ${isMatch}`);
      
      return isMatch;
    });
    
    // Check if we have an exact match - if so, use it immediately
    const exactMatch = matchingCourses.find(course => 
      course.name.toLowerCase() === searchTerm
    );
    
    if (exactMatch) {
      console.log('DEBUG: Exact match found, using:', exactMatch.name);
      return { success: true, course: exactMatch, isExactMatch: true };
    } else {
      // Only sort and select if no exact match found
      console.log('DEBUG: No exact match, sorting by similarity...');
      
      // Sort courses by match quality (exact matches first, then by similarity)
      matchingCourses.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        // Then prioritize by how many words match exactly
        const aWordMatches = searchWords.filter(word => aName.includes(word)).length;
        const bWordMatches = searchWords.filter(word => bName.includes(word)).length;
        
        if (aWordMatches !== bWordMatches) {
          return bWordMatches - aWordMatches; // Higher word matches first
        }
        
        // If same word matches, prioritize shorter names (more specific)
        return aName.length - bName.length;
      });
      
      console.log('DEBUG: Matching courses found:', matchingCourses.length);
      console.log('DEBUG: Matching course names:', matchingCourses.map(c => c.name));
      console.log('DEBUG: Sorted by priority (best match first):', 
        matchingCourses.map(c => ({
          name: c.name,
          priority: c.name.toLowerCase() === searchTerm ? 'EXACT' : 'PARTIAL'
        }))
      );
      
      // Select the best match
      if (matchingCourses.length > 0) {
        const selectedCourse = matchingCourses[0];
        console.log('DEBUG: Selected course (best match):', selectedCourse.name);
        return { success: true, course: selectedCourse, isExactMatch: false, allMatches: matchingCourses };
      }
    }
    
    return { success: false, message: `I couldn't find any courses matching "${courseName}".` };
  } catch (error) {
    console.error('Error in findMatchingCourse:', error);
    return { success: false, message: "Sorry, I encountered an error while searching for courses. Please try again.", error: error.message };
  }
}

/**
 * Helper function to make API calls to our backend endpoints
 */
async function makeApiCall(url, method, data, userToken, req) {
  console.log('DEBUG: makeApiCall called with:', {
    url,
    method,
    data: data ? 'data present' : 'no data',
    userToken: userToken ? 'token present' : 'no token'
  });
  
  try {
    // Check if this is an internal call to our own API
    if (url.includes('/api/classroom') && (url.includes('class.xytek.ai') || url.includes('localhost'))) {
      console.log('DEBUG: Making internal API call instead of external HTTP request');
      
      // For internal calls, we need the full request object to access user context
      if (!req || !req.user) {
        console.log('DEBUG: No user context available, falling back to external call');
        // Fall through to external call
      } else {
        // Extract the endpoint path
        const endpoint = url.split('/api/classroom')[1] || '/';
        console.log('DEBUG: Internal endpoint:', endpoint);
        
        try {
          if (method === 'GET' && endpoint === '/') {
            // For listCourses, we need to get the user from the database
            const user = await getUserByEmail(req.user.email);
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }
            
            const { getClassroomClient } = require('../../integrations/google.classroom');
            const classroom = getClassroomClient({
              access_token: user.access_token,
              refresh_token: user.refresh_token
            });
            
            const result = await classroom.courses.list({
              pageSize: 30,
              teacherId: 'me'
            });
            
            console.log('DEBUG: Internal listCourses call successful');
            return result.data.courses;
            
          } else if (method === 'GET' && endpoint.startsWith('/') && !endpoint.includes('/')) {
            // For getCourse, extract courseId and get course details
            const courseId = endpoint.substring(1); // Remove leading slash
            console.log('DEBUG: Getting course details for courseId:', courseId);
            
            const user = await getUserByEmail(req.user.email);
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }
            
            const { getClassroomClient } = require('../../integrations/google.classroom');
            const classroom = getClassroomClient({
              access_token: user.access_token,
              refresh_token: user.refresh_token
            });
            
            const result = await classroom.courses.get({
              id: courseId
            });
            
            console.log('DEBUG: Course details retrieved successfully');
            console.log('DEBUG: Internal getCourse call successful');
            return result.data;
            
          } else if (method === 'POST' && endpoint === '/') {
            // For createCourse, we need to get the user from the database
            const user = await getUserByEmail(req.user.email);
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }
            
            const { getClassroomClient } = require('../../integrations/google.classroom');
            const classroom = getClassroomClient({
              access_token: user.access_token,
              refresh_token: user.refresh_token
            });
            
            // Validate required fields
            if (!data.name) {
              throw new Error('Course name is required');
            }
            
            const courseData = {
              name: data.name,
              section: data.section || '',
              descriptionHeading: data.descriptionHeading || '',
              description: data.description || '',
              room: data.room || '',
              ownerId: 'me',
              courseState: 'PROVISIONED'
            };
            
            console.log('DEBUG: Creating course with data:', courseData);
            const result = await classroom.courses.create({
              requestBody: courseData
            });
            
            console.log('DEBUG: Course created successfully:', result.data);
            
            // If successful, update to ACTIVE state
            if (result.data.id) {
              await classroom.courses.patch({
                id: result.data.id,
                updateMask: 'courseState',
                requestBody: {
                  courseState: 'ACTIVE'
                }
              });
              console.log('DEBUG: Course state updated to ACTIVE');
            }
            
            console.log('DEBUG: Internal createCourse call successful');
            return result.data;
            
          } else if (method === 'POST' && endpoint.includes('/announcements')) {
            // For createAnnouncement, extract courseId and create announcement
            const courseId = endpoint.split('/')[1]; // Extract courseId from /{courseId}/announcements
            console.log('DEBUG: Creating announcement for courseId:', courseId);
            
            const user = await getUserByEmail(req.user.email);
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }
            
            const { getClassroomClient } = require('../../integrations/google.classroom');
            const classroom = getClassroomClient({
              access_token: user.access_token,
              refresh_token: user.refresh_token
            });
            
            // Validate required fields
            if (!data.text) {
              throw new Error('Announcement text is required');
            }
            
            const announcementData = {
              text: data.text,
              materials: data.materials || [],
              state: data.state || 'PUBLISHED'
            };
            
            console.log('DEBUG: Creating announcement with data:', announcementData);
            const result = await classroom.courses.announcements.create({
              courseId: courseId,
              requestBody: announcementData
            });
            
            console.log('DEBUG: Announcement created successfully:', result.data);
            console.log('DEBUG: Internal createAnnouncement call successful');
            return result.data;
            
          } else if (method === 'GET' && endpoint.includes('/announcements')) {
            // For getAnnouncements, extract courseId and get announcements
            const courseId = endpoint.split('/')[1]; // Extract courseId from /{courseId}/announcements
            console.log('DEBUG: Getting announcements for courseId:', courseId);
            
            const user = await getUserByEmail(req.user.email);
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }
            
            const { getClassroomClient } = require('../../integrations/google.classroom');
            const classroom = getClassroomClient({
              access_token: user.access_token,
              refresh_token: user.refresh_token
            });
            
            const result = await classroom.courses.announcements.list({
              courseId: courseId,
              pageSize: 20
            });
            
            console.log('DEBUG: Announcements retrieved successfully');
            console.log('DEBUG: Internal getAnnouncements call successful');
            return result.data.announcements || [];
            
          } else if (method === 'GET' && endpoint.includes('/students')) {
            // For getEnrolledStudents, extract courseId and get students
            const courseId = endpoint.split('/')[1]; // Extract courseId from /{courseId}/students
            console.log('DEBUG: Getting students for courseId:', courseId);
            
            const user = await getUserByEmail(req.user.email);
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }
            
            const { getClassroomClient } = require('../../integrations/google.classroom');
            const classroom = getClassroomClient({
              access_token: user.access_token,
              refresh_token: user.refresh_token
            });
            
            const result = await classroom.courses.students.list({
              courseId: courseId,
              pageSize: 30
            });
            
            console.log('DEBUG: Students retrieved successfully');
            console.log('DEBUG: Internal getEnrolledStudents call successful');
            return result.data.students || [];
            
    } else {
            console.log('DEBUG: Unsupported internal endpoint, falling back to external call');
            // Fall through to external call
          }
          
        } catch (controllerError) {
          console.error('DEBUG: Internal call error:', controllerError);
          console.log('DEBUG: Falling back to external call due to internal error');
          // Fall through to external call
        }
      }
    }
    
    // Fallback to external HTTP call for other endpoints or when internal call fails
    console.log('DEBUG: Making external HTTP API call');
    
    // Clean the token - remove any existing Bearer prefix
    const cleanToken = userToken.replace(/^Bearer\s+/i, '');
    
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    console.log('DEBUG: Making API call with config:', {
      method,
      url,
      hasData: !!config.data,
      headers: config.headers
    });
    
    // Log the actual request being sent
    console.log('DEBUG: Full axios config:', JSON.stringify(config, null, 2));
    
    // Add a unique header to track this request
    config.headers['X-Request-ID'] = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const response = await axios(config);
    console.log('DEBUG: API call successful, response status:', response.status);
    console.log('DEBUG: API response data:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('DEBUG: API call failed:', error.message);
    if (error.response) {
      console.error('DEBUG: Error response status:', error.response.status);
      console.error('DEBUG: Error response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Execute the appropriate action based on the detected intent
 */
async function executeAction(intentData, originalMessage, userToken, req) {
  console.log('🔍 DEBUG: executeAction called with intentData:', JSON.stringify(intentData, null, 2));
  let { intent, parameters } = intentData;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  let userRole = null;
  const conversationId = req.body.conversationId;
  
  try {
    // Decode JWT to get user role
    if (userToken) {
      try {
        const cleanToken = userToken.replace(/^Bearer\s+/i, '');
        const decoded = jwt.decode(cleanToken);
        userRole = decoded && decoded.role ? decoded.role : null;
      } catch (jwtErr) {
        // If decoding fails, userRole remains null
        userRole = null;
      }
    }

    // 🔍 CONTEXT CHECK: Check if user is trying to start a new action while one is in progress
    const newActionCheck = checkForNewActionAttempt(intent, conversationId);
    if (newActionCheck && newActionCheck.shouldBlock) {
      return {
        message: newActionCheck.message,
        conversationId: conversationId,
        ongoingAction: newActionCheck.ongoingAction
      };
    }

    // 🔍 CONTEXT CHECK: Check if this message provides parameters for an ongoing action
    const parameterCollection = await handleParameterCollection(intent, parameters, conversationId, originalMessage);
    console.log('🔍 Parameter collection result:', parameterCollection);
    
    if (parameterCollection) {
      if (parameterCollection.actionComplete) {
        // Action is now complete, execute it with all collected parameters
        console.log(`🎯 Action ${parameterCollection.action} is now complete with parameters:`, parameterCollection.allParameters);
        
        // Update the intent data with the complete parameters
        intentData.intent = parameterCollection.action;  // Change the intent!
        intentData.parameters = parameterCollection.allParameters;
        intent = parameterCollection.action;  // Update the local intent variable
        parameters = parameterCollection.allParameters;
        
        console.log(`🔄 Updated intent to ${parameterCollection.action}`);
        
        // Continue with normal execution below
      } else {
        // Still missing parameters, ask for the next one
        console.log('🔍 Still missing parameters:', parameterCollection.missingParameters);
        return {
          message: parameterCollection.nextMessage,
          conversationId: conversationId,
          ongoingAction: {
            action: parameterCollection.action,
            collectedParameters: parameterCollection.collectedParameters,
            missingParameters: parameterCollection.missingParameters
          }
        };
      }
    }

    // 🔍 ADDITIONAL CHECK: Handle confirmation responses for ongoing actions
    const context = getOngoingActionContext(conversationId);
    if (context && context.missingParameters && context.missingParameters.includes('confirmed')) {
      const message = originalMessage.toLowerCase().trim();
      
      // Check for positive confirmation
      const positivePatterns = [
        /^yes$/i,
        /^y$/i,
        /^yeah$/i,
        /^yep$/i,
        /^sure$/i,
        /^ok$/i,
        /^okay$/i,
        /^correct$/i,
        /^right$/i,
        /^that's right$/i,
        /^that is correct$/i,
        /^go ahead$/i,
        /^proceed$/i,
        /^create it$/i
      ];
      
      // Check for negative confirmation
      const negativePatterns = [
        /^no$/i,
        /^n$/i,
        /^nope$/i,
        /^wrong$/i,
        /^incorrect$/i,
        /^change$/i,
        /^different$/i,
        /^not right$/i,
        /^that's not right$/i,
        /^that is not correct$/i,
        /^cancel$/i,
        /^stop$/i
      ];
      
      if (positivePatterns.some(pattern => pattern.test(message))) {
        // User confirmed - complete the action
        const confirmedParameters = { ...context.collectedParameters, confirmed: true };
        intentData.intent = context.action;
        intentData.parameters = confirmedParameters;
        intent = context.action;
        parameters = confirmedParameters;
        
        console.log(`✅ User confirmed ${context.action} with parameters:`, confirmedParameters);
      } else if (negativePatterns.some(pattern => pattern.test(message))) {
        // User wants to change - reset to name collection
        startOngoingAction(conversationId, 'CREATE_COURSE', ['name'], {});
        return {
          message: "No problem! What would you like to call your new class instead?",
          conversationId: conversationId,
          ongoingAction: {
            action: 'CREATE_COURSE',
            missingParameters: ['name'],
            collectedParameters: {}
          }
        };
      } else {
        // Unclear response - ask for clarification
        return {
          message: "I'm not sure if you want to proceed. Please say 'yes' to create the course with this name, or 'no' if you'd like to change it.",
          conversationId: conversationId,
          ongoingAction: {
            action: context.action,
            collectedParameters: context.collectedParameters,
            missingParameters: context.missingParameters
          }
        };
      }
    }

    // --- OVERRIDE: If intent is INVITE_STUDENTS but message says 'teacher', treat as INVITE_TEACHERS ---
    if (
      intent === 'INVITE_STUDENTS' &&
      originalMessage.toLowerCase().includes('teacher') &&
      parameters.studentEmails && parameters.studentEmails.length > 0
    ) {
      intent = 'INVITE_TEACHERS';
      parameters.emails = parameters.studentEmails;
      delete parameters.studentEmails;
    }

    switch (intent) {
      case 'CANCEL_ACTION': {
        // Handle user wanting to cancel or stop an ongoing action
        if (conversationId) {
          const context = getOngoingActionContext(conversationId);
          if (context) {
            completeOngoingAction(conversationId);
            return {
              message: `Got it! I've stopped working on ${context.action.toLowerCase().replace(/_/g, ' ')}. What would you like to do instead?`,
              conversationId: conversationId
            };
          } else {
            return {
              message: "There's nothing to cancel - I'm not working on any tasks right now. What would you like to do?",
              conversationId: conversationId
            };
          }
        }
        
        return {
          message: "There's nothing to cancel - I'm not working on any tasks right now. What would you like to do?"
        };
      }
      
      case 'GREETING': {
        // Handle casual conversation - just respond naturally without executing any actions
        const greetings = [
          "Hello! 👋 How can I help you today?",
          "Hi there! 😊 What would you like to do?",
          "Hey! 👋 I'm here to help with your classroom tasks. What do you need?",
          "Good to see you! 🌟 How can I assist you today?",
          "Hello! ✨ I'm ready to help with courses, assignments, meetings, or anything else you need.",
          "Hi! 🎓 I'm your classroom assistant. What can I help you with?",
          "Hey there! 📚 Ready to help with your educational tasks. What do you need?",
          "Good to see you! 🚀 I'm here to make your classroom management easier. What would you like to do?",
          "Hello! 🌟 How's your day going? I'm here to help with any classroom tasks you have.",
          "Hi! ✨ What would you like to work on today? I can help with courses, assignments, meetings, and more!"
        ];
        
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        
        return {
          message: randomGreeting,
          conversationId: conversationId
        };
      }
      
      case 'LIST_COURSES':
        // All users can view courses, but with different messaging
        if (userRole === 'student') {
          // Students can view courses they're enrolled in
          const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
          return formatCoursesResponse(coursesResponse, 'student', conversationId);
        } else if (userRole === 'teacher' || userRole === 'super_admin') {
          // Teachers and admins can view all courses
          const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
          return formatCoursesResponse(coursesResponse, 'teacher', conversationId);
        } else {
          return {
            message: 'You are not authorized to view courses. Please contact your administrator.',
            conversationId: conversationId
          };
        }
        
      case 'CREATE_COURSE': {
        // Only allow teachers and super_admin to create courses
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to create courses. Only teachers and super admins can create courses.',
            conversationId: conversationId
          };
        }

        if (!parameters.name) {
          // 🚀 START TRACKING: Start tracking this action for parameter collection
          startOngoingAction(conversationId, 'CREATE_COURSE', ['name'], {});
          
          return {
            message: "What would you like to call your new class?",
            conversationId: conversationId,
            ongoingAction: {
              action: 'CREATE_COURSE',
              missingParameters: ['name'],
              collectedParameters: {}
            }
          };
        }

        // Check if we need confirmation for the course name
        if (parameters.name && !parameters.confirmed) {
          // 🚀 UPDATE TRACKING: Add confirmation step
          startOngoingAction(conversationId, 'CREATE_COURSE', ['confirmed'], { name: parameters.name });
          
          return {
            message: `I'll create a course called "${parameters.name}". Is this correct? Please confirm with "yes" or "no", or let me know if you'd like to change the name.`,
            conversationId: conversationId,
            ongoingAction: {
              action: 'CREATE_COURSE',
              missingParameters: ['confirmed'],
              collectedParameters: { name: parameters.name }
            }
          };
        }

        const courseData = {
          name: parameters.name,
          section: parameters.section || '',
          descriptionHeading: parameters.descriptionHeading || '',
          description: parameters.description || '',
          room: parameters.room || ''
        };

        console.log('DEBUG: CREATE_COURSE - baseUrl:', baseUrl);
        console.log('DEBUG: CREATE_COURSE - Full URL being called:', `${baseUrl}/api/classroom`);
        console.log('DEBUG: CREATE_COURSE - courseData:', courseData);
        console.log('DEBUG: CREATE_COURSE - req.protocol:', req.protocol);
        console.log('DEBUG: CREATE_COURSE - req.get("host"):', req.get('host'));

        try {
          const response = await makeApiCall(
            `${baseUrl}/api/classroom`,
            'POST',
            courseData,
            userToken,
            req
          );

          console.log('DEBUG: CREATE_COURSE - makeApiCall response:', response);

          // ✅ COMPLETE ACTION: Mark the ongoing action as completed
          if (conversationId) {
            completeOngoingAction(conversationId);
          }

          return {
            message: `Great! I've successfully created your course "${parameters.name}". Your course is now live in Google Classroom and ready for students to join. You can start posting announcements, creating assignments, and adding course materials right away.`,
            course: response.course,
            conversationId: conversationId
          };
        } catch (error) {
          console.error('Error in CREATE_COURSE:', error);
          
          // ✅ COMPLETE ACTION: Mark the ongoing action as completed even on error
          if (conversationId) {
            completeOngoingAction(conversationId);
          }
          
          return {
            message: "I'm sorry, but I couldn't create the course right now. Please try again in a moment.",
            error: error.message,
            conversationId: conversationId
          };
        }
      }
        
      case 'LIST_ASSIGNMENTS': {
        // Students can view assignments but with different messaging
        if (userRole === 'student') {
          if (!parameters.courseName && !parameters.courseIdentifier) {
            return {
              message: "I need to know which course you want to see assignments for. Please provide a course name.",
              conversationId: req.body.conversationId || generateConversationId()
            };
          }
        } else if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to view assignments. Please contact your administrator.',
            conversationId: req.body.conversationId || generateConversationId()
          };
        }

        if (!parameters.courseName && !parameters.courseIdentifier) {
          return {
            message: "I need to know which course you want to see assignments for. Please provide a course name.",
            conversationId: req.body.conversationId || generateConversationId()
          };
        }

        try {
          // Use the reusable course matching function
          const courseMatch = await findMatchingCourse(
            parameters.courseName || parameters.courseIdentifier, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            return {
              message: courseMatch.message,
              conversationId: req.body.conversationId || generateConversationId()
            };
          }
          
          const selectedCourse = courseMatch.course;
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName || parameters.courseIdentifier}". Which one would you like to see assignments for?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              conversationId: req.body.conversationId || generateConversationId()
            };
          }
          
          // Exact match - list assignments using internal service
          const courseId = selectedCourse.id;
          
          try {
            // Extract user from JWT token
            const token = userToken.split(' ')[1]; // Remove 'Bearer ' prefix
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await getUserByEmail(decoded.email);
            
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }
            
            // Use internal service function instead of external API call
            const assignments = await listAssignments(
              {
                access_token: user.access_token,
                refresh_token: user.refresh_token
              },
              courseId
            );

            if (!assignments || assignments.length === 0) {
              return {
                message: `📚 **No assignments found in ${selectedCourse.name}**\n\nThis course doesn't have any assignments yet. You can create your first assignment by saying something like:\n\n• "Create assignment Math Quiz in ${selectedCourse.name}"\n• "Add homework Problem Set 1 to ${selectedCourse.name}"`,
                assignments: [],
                conversationId: req.body.conversationId || generateConversationId()
              };
            }

            // Format assignments for display
            const formattedAssignments = assignments.map(assignment => {
              const dueDate = assignment.dueDate ? 
                `${assignment.dueDate.year}-${assignment.dueDate.month.toString().padStart(2, '0')}-${assignment.dueDate.day.toString().padStart(2, '0')}` : 
                'No due date';
              
              const dueTime = assignment.dueTime ? 
                `${assignment.dueTime.hours}:${assignment.dueTime.minutes.toString().padStart(2, '0')}` : 
                '';
              
              return {
                title: assignment.title,
                dueDate: dueDate,
                dueTime: dueTime,
                maxPoints: assignment.maxPoints || 'No points',
                state: assignment.state || 'Unknown',
                id: assignment.id
              };
            });

            const assignmentList = formattedAssignments.map((assignment, index) => {
              return `${index + 1}. **${assignment.title}**\n   📅 Due: ${assignment.dueDate}${assignment.dueTime ? ` at ${assignment.dueTime}` : ''}\n   🎯 Points: ${assignment.maxPoints}\n   📊 Status: ${assignment.state}`;
            }).join('\n\n');

            return {
              message: `📚 **Assignments in ${selectedCourse.name}**\n\n${assignmentList}\n\n📊 **Total: ${assignments.length} assignment${assignments.length === 1 ? '' : 's'}**\n\n💡 **Next steps:**\n• Create a new assignment\n• View student submissions\n• Grade completed assignments`,
              assignments: formattedAssignments,
              course: selectedCourse,
              conversationId: req.body.conversationId || generateConversationId()
            };
          } catch (error) {
            if (error.message.includes('Missing required OAuth2 tokens')) {
              return {
                message: "I couldn't retrieve the assignments because your Google account isn't properly connected. Please reconnect your Google account.",
                error: error.message,
                conversationId: req.body.conversationId || generateConversationId()
              };
            }
            throw error; // Re-throw other errors
          }
        } catch (error) {
          console.error('Error in LIST_ASSIGNMENTS:', error);
          return {
            message: "Sorry, I encountered an error while trying to retrieve the assignments. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId || generateConversationId()
          };
        }
      }
        
      case 'CREATE_ANNOUNCEMENT': {
        console.log('🔍 DEBUG: CREATE_ANNOUNCEMENT case - parameters:', parameters);
        console.log('🔍 DEBUG: needsDisambiguation flag:', parameters.needsDisambiguation);
        
        // Only allow teachers and super_admin to create announcements
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to create announcements. Only teachers and super admins can create announcements.',
            conversationId: req.body.conversationId
          };
        }

        // Check if we need disambiguation for generic course names - THIS MUST BE FIRST
        if (parameters.needsDisambiguation) {
          console.log('🔍 DEBUG: Disambiguation needed for generic course name');
          return {
            message: `I need to know which specific class you're referring to. Could you please tell me the name of the class? For example: "Grade Islamiat class" or "Math 101".`,
            conversationId: conversationId,
            ongoingAction: {
              action: 'CREATE_ANNOUNCEMENT',
              missingParameters: ['courseName'],
              collectedParameters: {}
            }
          };
        }

        // Check what parameters are missing and start tracking if needed
        const missingParams = [];
        if (!parameters.courseName && !parameters.courseIdentifier) {
          missingParams.push('courseName');
        }
        if (!parameters.announcementText) {
          missingParams.push('announcementText');
        }

        if (missingParams.length > 0) {
          // 🚀 START TRACKING: Start tracking this action for parameter collection
          startOngoingAction(conversationId, 'CREATE_ANNOUNCEMENT', missingParams, parameters);
          
          // Generate appropriate message based on what's missing
          let message;
          if (missingParams.includes('courseName') && missingParams.includes('announcementText')) {
            message = "What would you like to announce and which course should I post it in?";
          } else if (missingParams.includes('courseName')) {
            message = "Which course should I post this announcement in?";
          } else if (missingParams.includes('announcementText')) {
            message = "What would you like to announce?";
          }
          
          return {
            message: message,
            conversationId: conversationId,
            ongoingAction: {
              action: 'CREATE_ANNOUNCEMENT',
              missingParameters: missingParams,
              collectedParameters: parameters
            }
          };
        }

        try {
          // Use the reusable course matching function
          const courseMatch = await findMatchingCourse(
            parameters.courseName || parameters.courseIdentifier, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            return {
              message: courseMatch.message,
              conversationId: req.body.conversationId
            };
          }
          
          const selectedCourse = courseMatch.course;
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName || parameters.courseIdentifier}". Which one would you like to create an announcement for?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              conversationId: req.body.conversationId
            };
          }
          
          // Exact match - create the announcement
          const courseId = selectedCourse.id;
          const announcementData = {
            text: parameters.announcementText,
            materials: []
          };
          
          // Use internal call to Google Classroom API
          const response = await makeApiCall(
            `${baseUrl}/api/classroom/${courseId}/announcements`,
            'POST',
            announcementData,
            userToken,
            req
          );
          
          if (!response || response.error) {
            return {
              message: `Sorry, I couldn't create the announcement. ${response?.error || 'Please try again.'}`,
              conversationId: req.body.conversationId
            };
          }
          
          // ✅ COMPLETE ACTION: Mark the ongoing action as completed
          if (conversationId) {
            completeOngoingAction(conversationId);
          }

          return {
            message: `Great! I've posted your announcement "${parameters.announcementText}" in ${selectedCourse.name}. Your students will now see this announcement in their Google Classroom.`,
            announcement: response.announcement,
            conversationId: conversationId
          };
        } catch (error) {
          console.error('Error in CREATE_ANNOUNCEMENT:', error);
          
          // ✅ COMPLETE ACTION: Mark the ongoing action as completed even on error
          if (conversationId) {
            completeOngoingAction(conversationId);
          }
          
          return {
            message: "I'm sorry, but I couldn't create the announcement right now. Please try again in a moment.",
            error: error.message,
            conversationId: conversationId
          };
        }
      }
        
      case 'GET_ANNOUNCEMENTS': {
        // All users can view announcements, but with different messaging
        if (userRole === 'student') {
          // Students can view announcements in courses they're enrolled in
          if (!parameters.courseName && !parameters.courseIdentifier) {
            return {
              message: "I need to know which course you want to view announcements for. Please provide a course name.",
              conversationId: req.body.conversationId
            };
          }
        } else if (userRole === 'teacher' || userRole === 'super_admin') {
          // Teachers and admins can view announcements in any course
          if (!parameters.courseName && !parameters.courseIdentifier) {
            return {
              message: "I need to know which course you want to view announcements for. Please provide a course name.",
              conversationId: req.body.conversationId
            };
          }
        } else {
          return {
            message: 'You are not authorized to view announcements. Please contact your administrator.',
            conversationId: req.body.conversationId
          };
        }

        try {
          // Use the reusable course matching function
          const courseMatch = await findMatchingCourse(
            parameters.courseName || parameters.courseIdentifier, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            return {
              message: courseMatch.message,
              conversationId: req.body.conversationId
            };
          }
          
          const selectedCourse = courseMatch.course;
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName || parameters.courseIdentifier}". Which one would you like to view announcements for?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              conversationId: req.body.conversationId
            };
          }
          
          // Exact match - get the announcements
          const courseId = selectedCourse.id;
          const announcements = await makeApiCall(
            `${baseUrl}/api/classroom/${courseId}/announcements`,
            'GET',
            null,
            userToken,
            req
          );
          
          if (!announcements || announcements.length === 0) {
            return {
              message: `📢 **${selectedCourse.name}**\n\nNo announcements found yet. This course is ready for your first announcement!`,
              conversationId: req.body.conversationId
            };
          }
          
          const announcementList = announcements.map((announcement, index) => {
            const date = new Date(announcement.updateTime || announcement.creationTime).toLocaleDateString();
            return `${index + 1}. **${announcement.text}**\n   📅 ${date}`;
          }).join('\n\n');
          
          return {
            message: `📢 **${selectedCourse.name} - Announcements**\n\n${announcementList}\n\nTotal: ${announcements.length} announcement${announcements.length !== 1 ? 's' : ''}`,
            announcements: announcements,
            conversationId: req.body.conversationId
          };
        } catch (error) {
          console.error('Error in GET_ANNOUNCEMENTS:', error);
          return {
            message: "Sorry, I encountered an error while trying to get the announcements. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }
        
      case 'GET_COURSE': {
        // All users can view course details, but with different messaging
        if (userRole === 'student') {
          // Students can view details of courses they're enrolled in
        } else if (userRole === 'teacher' || userRole === 'super_admin') {
          // Teachers and admins can view details of any course
        } else {
          return {
            message: 'You are not authorized to view course details. Please contact your administrator.',
            conversationId: req.body.conversationId
          };
        }

        // Handle course retrieval by ID or by name
        if (parameters.courseId) {
          const courseResponse = await makeApiCall(`${baseUrl}/api/classroom/${parameters.courseId}`, 'GET', null, userToken, req);
          return formatCourseDetailsResponse(courseResponse, userRole, req.body.conversationId);
        } else if (parameters.courseName || parameters.courseIdentifier) {
          // Use the reusable course matching function
          const courseMatch = await findMatchingCourse(
            parameters.courseName || parameters.courseIdentifier, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            return {
              message: courseMatch.message,
              conversationId: req.body.conversationId
            };
          }
          
          const selectedCourse = courseMatch.course;
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName || parameters.courseIdentifier}". Which one did you mean?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              conversationId: req.body.conversationId
            };
          }
          
          // Exact match - get the details
          const courseResponse = await makeApiCall(`${baseUrl}/api/classroom/${selectedCourse.id}`, 'GET', null, userToken, req);
          return formatCourseDetailsResponse(courseResponse, userRole, req.body.conversationId);
        } else {
          return {
            message: "I need more information about which course you're interested in. Could you provide a course name or ID?",
            conversationId: req.body.conversationId
          };
        }
      }
        
      case 'CREATE_ASSIGNMENT': {
        // Only allow teachers and super_admin to create assignments
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to create assignments. Only teachers and super admins can create assignments.',
            conversationId: req.body.conversationId || generateConversationId()
          };
        }

        if (!parameters.courseName && !parameters.courseIdentifier) {
          return {
            message: "I need to know which course you want to create an assignment for. Please provide a course name.",
            conversationId: req.body.conversationId || generateConversationId()
          };
        }

        if (!parameters.title) {
          return {
            message: "Please provide a title for your assignment.",
            conversationId: req.body.conversationId || generateConversationId()
          };
        }

        // Calculate due date from expression if provided
        if (parameters.dueDateExpr) {
          const calculatedDate = calculateDateFromExpression(parameters.dueDateExpr);
          if (calculatedDate) {
            parameters.dueDate = calculatedDate;
          }
        }

        // Convert time expression if provided
        if (parameters.dueTimeExpr) {
          const calculatedTime = convertTimeExpression(parameters.dueTimeExpr);
          if (calculatedTime) {
            parameters.dueTime = calculatedTime;
          }
        }

        try {
          // Use the reusable course matching function
          const courseMatch = await findMatchingCourse(
            parameters.courseName || parameters.courseIdentifier, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            return {
              message: courseMatch.message,
              conversationId: req.body.conversationId || generateConversationId()
            };
          }
          
          const selectedCourse = courseMatch.course;
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName || parameters.courseIdentifier}". Which one would you like to create an assignment for?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              title: parameters.title,
              description: parameters.description,
              dueDate: parameters.dueDate,
              dueTime: parameters.dueTime,
              maxPoints: parameters.maxPoints,
              materials: parameters.materials,
              conversationId: req.body.conversationId || generateConversationId()
            };
          }
          
          // Exact match - create the assignment immediately using internal service
          const courseId = selectedCourse.id;
          
          try {
            // Extract user from JWT token
            const token = userToken.split(' ')[1]; // Remove 'Bearer ' prefix
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await getUserByEmail(decoded.email);
            
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }
            
            // Prepare assignment data for internal service
            const assignmentData = {
              title: parameters.title,
              description: parameters.description || '',
              materials: parameters.materials || [],
              state: 'PUBLISHED',
              maxPoints: parameters.maxPoints || 100,
              dueDate: parameters.dueDate,
              dueTime: parameters.dueTime
            };
            
            // Use internal service function instead of external API call
            const response = await createAssignment(
              {
                access_token: user.access_token,
                refresh_token: user.refresh_token
              },
              courseId,
              assignmentData
            );

            return {
              message: `🎉 **Assignment "${parameters.title}" created successfully in ${selectedCourse.name}!**\n\n📝 **Assignment Details:**\n• Title: ${parameters.title}${parameters.description ? `\n• Description: ${parameters.description}` : ''}${parameters.dueDate ? `\n• Due Date: ${parameters.dueDate.year}-${parameters.dueDate.month}-${parameters.dueDate.day}` : ''}${parameters.dueTime ? `\n• Due Time: ${parameters.dueTime.hours}:${parameters.dueTime.minutes.toString().padStart(2, '0')}` : ''}${parameters.maxPoints ? `\n• Max Points: ${parameters.maxPoints}` : ''}\n\n✅ Your assignment is now live in Google Classroom and students can start working on it.\n\n💡 **Next steps:**\n• Review student submissions\n• Grade completed assignments\n• Provide feedback to students`,
              assignment: response,
              conversationId: req.body.conversationId || generateConversationId()
            };
          } catch (error) {
            // Handle specific error cases
            if (error.message.includes('Due date must be in the future')) {
              return {
                message: "I couldn't create the assignment because the due date must be in the future. Please provide a future date.",
                error: error.message,
                conversationId: req.body.conversationId || generateConversationId()
              };
            } else if (error.message.includes('Invalid time format')) {
              return {
                message: "I couldn't create the assignment because the time format is invalid. Please use 24-hour format (HH:MM).",
                error: error.message,
                conversationId: req.body.conversationId || generateConversationId()
              };
            } else if (error.message.includes('Missing required OAuth2 tokens')) {
              return {
                message: "I couldn't create the assignment because your Google account isn't properly connected. Please reconnect your Google account.",
                error: error.message,
                conversationId: req.body.conversationId || generateConversationId()
              };
            }
            throw error; // Re-throw other errors
          }
        } catch (error) {
          console.error('Error in CREATE_ASSIGNMENT:', error);
          return {
            message: "Sorry, I encountered an error while trying to create the assignment. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId || generateConversationId()
          };
        }
      }
        
      case 'INVITE_STUDENTS':
        // Only allow teachers and super_admin to invite students
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to invite students. Only teachers and super admins can invite students.',
            conversationId: req.body.conversationId
          };
        }
        
        if (!parameters.courseName) {
          return {
            message: 'I need to know which course you want to invite students to. Please provide a course name.',
            conversationId: req.body.conversationId
          };
        }
        
        const studentEmails = parameters.studentEmails || parameters.emails;
        if (!studentEmails || studentEmails.length === 0) {
          return {
            message: 'I need to know which students to invite. Please provide their email addresses.',
            conversationId: req.body.conversationId
          };
        }
        
        try {
          // Use the reusable course matching function
          const courseMatch = await findMatchingCourse(
            parameters.courseName, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            return {
              message: courseMatch.message,
              conversationId: req.body.conversationId
            };
          }
          
          const selectedCourse = courseMatch.course;
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName}". Which one would you like to invite the students to?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              studentEmails: studentEmails,
              conversationId: req.body.conversationId
            };
          }
          
          // Exact match - invite the students using internal service
          const courseId = selectedCourse.id;
          
          try {
            // Extract user from JWT token
            const token = userToken.split(' ')[1]; // Remove 'Bearer ' prefix
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await getUserByEmail(decoded.email);
            
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }
            
            // First, verify the user has teacher/owner permissions on this specific course
            const { getCourse } = require('../classroomService');
            const courseDetails = await getCourse(
              {
                access_token: user.access_token,
                refresh_token: user.refresh_token
              },
              courseId
            );
            
            // Check if user is teacher or owner of the course
            // The user must be either the owner or have teacher permissions
            const userEmail = decoded.email;
            console.log('DEBUG: Checking course permissions for user:', userEmail);
            console.log('DEBUG: Course details:', JSON.stringify(courseDetails, null, 2));
            
            // Check if user is the owner - compare user IDs since email is not available
            let isOwner = false;
            let ownerEmail = null;
            try {
              // Get the owner's profile to get their ID
              const { getOwnerProfile } = require('../classroomService');
              console.log('DEBUG: Attempting to get owner profile for ID:', courseDetails.ownerId);
              const ownerProfile = await getOwnerProfile(
                {
                  access_token: user.access_token,
                  refresh_token: user.refresh_token
                },
                courseDetails.ownerId
              );
              console.log('DEBUG: Owner profile response:', JSON.stringify(ownerProfile, null, 2));
              
              // Get current user's Google ID from JWT token
              const currentUserGoogleId = decoded.sub; // This is the Google user ID from JWT
              console.log('DEBUG: Current user Google ID:', currentUserGoogleId);
              console.log('DEBUG: Owner Google ID:', ownerProfile.id);
              
              // Compare Google user IDs instead of emails
              isOwner = ownerProfile.id === currentUserGoogleId;
              ownerEmail = ownerProfile.emailAddress || 'Email not available';
              console.log('DEBUG: Is owner?', isOwner, 'Owner ID:', courseDetails.ownerId, 'Current user ID:', currentUserGoogleId);
            } catch (ownerError) {
              console.log('DEBUG: Could not get owner profile:', ownerError.message);
              console.log('DEBUG: Owner error details:', JSON.stringify(ownerError, null, 2));
              // Fallback: check if ownerId matches user's Google ID from JWT
              const currentUserGoogleId = decoded.sub;
              isOwner = courseDetails.ownerId === currentUserGoogleId;
            }
            console.log('DEBUG: Is owner?', isOwner, 'Owner ID:', courseDetails.ownerId, 'Owner email:', ownerEmail);
            
            // Check if user is a teacher (teacherGroupEmail might contain the user's email)
            const isTeacher = courseDetails.teacherGroupEmail && 
                            (courseDetails.teacherGroupEmail === userEmail || 
                             courseDetails.teacherGroupEmail.includes(userEmail));
            console.log('DEBUG: Is teacher?', isTeacher, 'Teacher group email:', courseDetails.teacherGroupEmail);
            
            // Also check if the user has the teacher role in our system
            const hasTeacherRole = userRole === 'teacher' || userRole === 'super_admin';
            console.log('DEBUG: Has teacher role in system?', hasTeacherRole, 'User role:', userRole);
            
            // Check if user is actually a teacher of this specific course by checking the teachers list
            let isCourseTeacher = false;
            try {
              const { listTeachers } = require('../classroomService');
              console.log('DEBUG: Attempting to get teachers list for course:', courseId);
              const teachers = await listTeachers(
                {
                  access_token: user.access_token,
                  refresh_token: user.refresh_token
                },
                courseId
              );
              console.log('DEBUG: Teachers response:', JSON.stringify(teachers, null, 2));
              
              // Get current user's Google ID from JWT token
              const currentUserGoogleId = decoded.sub;
              console.log('DEBUG: Current user Google ID for teacher check:', currentUserGoogleId);
              
              // Compare Google user IDs instead of emails
              isCourseTeacher = teachers.some(teacher => teacher.profile.id === currentUserGoogleId);
              console.log('DEBUG: Is course teacher?', isCourseTeacher, 'Teachers IDs:', teachers.map(t => t.profile.id));
            } catch (teacherError) {
              console.log('DEBUG: Could not check teachers list:', teacherError.message);
              console.log('DEBUG: Teacher error details:', JSON.stringify(teacherError, null, 2));
            }
            
            // Only allow if user is owner, teacher of the course, or has super_admin role
            if (!isOwner && !isTeacher && !isCourseTeacher && userRole !== 'super_admin') {
              return {
                message: `❌ **Permission Denied**\n\nYou don't have permission to invite students to the course "${selectedCourse.name}".\n\n**To invite students, you must be:**\n• The owner of the course, OR\n• A teacher of this specific course\n\n**Current status:**\n• Course owner: ${ownerEmail || courseDetails.ownerId}\n• Your email: ${userEmail}\n• Course teacher: ${isCourseTeacher ? 'Yes' : 'No'}\n\n**To fix this:**\n1. Ask the course owner to add you as a teacher, OR\n2. Create your own course and invite students there\n\n**Alternative - Share Enrollment Code:**\nStudents can join using code: **${selectedCourse.enrollmentCode}**\n**Course Link:** ${selectedCourse.alternateLink}`,
                conversationId: req.body.conversationId,
                enrollmentCode: selectedCourse.enrollmentCode,
                courseLink: selectedCourse.alternateLink
              };
            }
            
            // Use internal service function instead of external API call
            const { inviteStudent } = require('../classroomService');
            
            // Check if student emails are valid before attempting invitation
            console.log('DEBUG: About to invite students:', studentEmails);
            console.log('DEBUG: Course ID:', courseId);
            console.log('DEBUG: User tokens present:', {
              access_token: !!user.access_token,
              refresh_token: !!user.refresh_token
            });
            
            const invitationPromises = studentEmails.map(async (email) => {
              try {
                console.log(`DEBUG: Inviting student: ${email}`);
                const result = await inviteStudent(
                  {
                    access_token: user.access_token,
                    refresh_token: user.refresh_token
                  },
                  courseId,
                  email
                );
                console.log(`DEBUG: Successfully invited ${email}:`, result);
                return result;
              } catch (error) {
                console.log(`DEBUG: Failed to invite ${email}:`, error.message);
                
                // Check if it's a permission issue and provide helpful message
                if (error.message.includes('The caller does not have permission') || 
                    error.message.includes('PERMISSION_DENIED')) {
                  throw new Error(`PERMISSION_DENIED: ${email}`);
                }
                throw error;
              }
            });

            try {
              await Promise.all(invitationPromises);
            } catch (error) {
              // Handle permission denied errors with helpful message
              if (error.message.includes('PERMISSION_DENIED')) {
                return {
                  message: `❌ **Unable to Invite Students**\n\nI couldn't invite the students due to Google Classroom restrictions. This is likely because:\n\n**🔒 Domain Restrictions:**\n• Google Classroom may have domain restrictions enabled\n• Cross-domain invitations might be blocked\n• The student's email domain may not be allowed\n\n**📧 Student Email:** ${studentEmails.join(', ')}\n**🏫 Course:** ${selectedCourse.name}\n\n**💡 Solutions:**\n1. **Share the enrollment code:** ${selectedCourse.enrollmentCode}\n2. **Ask students to join manually:** They can use the code above\n3. **Check domain policies:** Contact your Google Workspace admin\n4. **Try with same-domain emails:** Use emails from your organization\n\n**🔗 Course Link:** ${selectedCourse.alternateLink}`,
                  conversationId: req.body.conversationId,
                  enrollmentCode: selectedCourse.enrollmentCode,
                  courseLink: selectedCourse.alternateLink
                };
              }
              throw error; // Re-throw other errors
            }
            
            return {
              message: `🎉 **Successfully invited ${studentEmails.length} student${studentEmails.length === 1 ? '' : 's'} to ${selectedCourse.name}!**\n\n📧 **Invited Students:**\n${studentEmails.map(email => `• ${email}`).join('\n')}\n\n✅ Invitation emails have been sent. Students can join using the enrollment code or by accepting the invitation.\n\n💡 **Next steps:**\n• Create your first announcement\n• Add course materials\n• Create your first assignment`,
              course: selectedCourse,
              invitedEmails: studentEmails,
              conversationId: req.body.conversationId
            };
          } catch (error) {
            if (error.message.includes('Missing required OAuth2 tokens')) {
              return {
                message: "I couldn't invite the students because your Google account isn't properly connected. Please reconnect your Google account.",
                error: error.message,
                conversationId: req.body.conversationId
              };
            }
            throw error; // Re-throw other errors
          }
        } catch (error) {
          console.error('Error in INVITE_STUDENTS:', error);
          
          // Check if it's a domain restriction issue
          if (error.message.includes('The caller does not have permission') || 
              error.message.includes('PERMISSION_DENIED')) {
            return {
              message: `❌ **Unable to Invite Students**\n\nI couldn't invite the students due to Google Classroom restrictions. This is likely because:\n\n**🔒 Domain Restrictions:**\n• Google Classroom may have domain restrictions enabled\n• Cross-domain invitations might be blocked\n• The student's email domain may not be allowed\n\n**📧 Student Email:** ${studentEmails.join(', ')}\n**🏫 Course:** ${selectedCourse.name}\n\n**💡 Solutions:**\n1. **Share the enrollment code:** ${selectedCourse.enrollmentCode}\n2. **Ask students to join manually:** They can use the code above\n3. **Check domain policies:** Contact your Google Workspace admin\n4. **Try with same-domain emails:** Use emails from your organization\n\n**🔗 Course Link:** ${selectedCourse.alternateLink}`,
              conversationId: req.body.conversationId,
              enrollmentCode: selectedCourse.enrollmentCode,
              courseLink: selectedCourse.alternateLink
            };
          }
          
          return {
            message: "Sorry, I encountered an error while inviting students. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }

      case 'STUDENT_JOIN_SUGGESTION':
        // Extract potential course names and emails from the message
        const originalMessage = req.body.message || '';
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = originalMessage.match(emailRegex) || [];
        
        // Try to extract course names from common patterns
        const coursePatterns = [
          /(?:class|course)\s+([a-zA-Z0-9\s-]+)/i,
          /(?:to|in)\s+([a-zA-Z0-9\s-]+?)(?:\s|$)/i,
          /([a-zA-Z0-9\s-]+?)\s+(?:class|course)/i,
          /add\s+student\s+to\s+(.+)/i
        ];
        
        let extractedCourse = '';
        for (const pattern of coursePatterns) {
          const match = originalMessage.match(pattern);
          if (match && match[1]) {
            extractedCourse = match[1].trim();
            break;
          }
        }
        
        // Check if this should be treated as a direct invitation
        if (emails.length > 0 && extractedCourse) {
          // Redirect to INVITE_STUDENTS with the extracted parameters
          return await executeAction({
            ...req,
            body: {
              ...req.body,
              message: `invite student ${emails[0]} to class ${extractedCourse}`
            }
          }, userRole, userToken, baseUrl);
        }
        
        // Build dynamic suggestions based on what we found
        let suggestions = [];
        let specificHelp = '';
        
        if (emails.length > 0) {
          // We found email but no course
          suggestions.push(`invite student ${emails[0]} to class [course name]`);
          specificHelp = `\n**📧 I found a student email: ${emails[0]}**\nJust tell me which class to invite them to!`;
        } else if (extractedCourse) {
          // We found course but no email
          suggestions.push(`invite student [email] to class ${extractedCourse}`);
          specificHelp = `\n**🏫 I found a course: ${extractedCourse}**\nJust tell me which student to invite!`;
        }
        
        // Add general suggestions
        suggestions.push(
          "invite student [email] to class [course name]",
          "show students in [course name]",
          "list courses"
        );
        
        return {
          message: `🎓 **Student Joining & Invitation Help**${specificHelp}\n\nI can help you with student invitations and joining! Here are your options:\n\n**📧 To Invite Students:**\n• Say: "invite student [email] to class [course name]"\n• Example: "invite student aman@erptechnicals.com to class ai"\n\n**🔗 For Students to Join:**\n• Share the enrollment code with students\n• Students can join using the course link\n• Or they can search for the course code in Google Classroom\n\n**💡 Quick Actions:**\n• "invite student [email] to class [name]" - Send invitation\n• "show students in [class]" - See enrolled students\n• "list courses" - See all your courses\n\n**Need help with a specific course?** Just tell me the course name and I'll help you invite students!`,
          conversationId: req.body.conversationId,
          suggestions: suggestions,
          extractedData: {
            emails: emails,
            courseName: extractedCourse
          }
        };

      case 'INVITE_TEACHERS':
        // Only allow super_admin to invite teachers
        if (userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to invite teachers. Only super admins can invite teachers.',
            conversationId: req.body.conversationId
          };
        }
        // Get all courses to find the matching one
        const teacherCoursesResponse = await makeApiCall(
          `${baseUrl}/api/classroom`,
          'GET',
          null,
          userToken,
          req
        );

        if (!teacherCoursesResponse || !teacherCoursesResponse.courses || !Array.isArray(teacherCoursesResponse.courses)) {
          return {
            message: 'Failed to retrieve courses. Please try again.',
            conversationId: req.body.conversationId
          };
        }

        // Find courses matching the name
        const teacherMatchingCourses = teacherCoursesResponse.courses.filter(course =>
          course.name.toLowerCase().includes(parameters.courseName.toLowerCase())
        );

        if (teacherMatchingCourses.length === 0) {
          return {
            message: `I couldn't find any courses matching "${parameters.courseName}".`,
            conversationId: req.body.conversationId
          };
        } else if (teacherMatchingCourses.length === 1) {
          // Exact match - invite the teachers
          const courseId = teacherMatchingCourses[0].id;
          const response = await makeApiCall(
            `${baseUrl}/api/classroom/${courseId}/invite-teachers`,
            'POST',
            { emails: parameters.emails },
            userToken,
            req
          );

          return {
            message: `Successfully invited ${parameters.emails.length} teachers to ${teacherMatchingCourses[0].name}.`,
            conversationId: req.body.conversationId
          };
        } else {
          // Multiple matches - ask for clarification
          return {
            type: 'COURSE_DISAMBIGUATION_NEEDED',
            message: `I found multiple courses matching "${parameters.courseName}". Which one would you like to invite the teachers to?`,
            options: teacherMatchingCourses.map(course => ({
              id: course.id,
              name: course.name,
              section: course.section || "No section"
            })),
            teacherEmails: parameters.emails,
            conversationId: req.body.conversationId
          };
        }

      case 'PROVIDE_MATERIALS': {
        // Get the stored assignment data from the last message
        const lastMessage = req.body.conversationId ? getLastMessage(req.body.conversationId) : null;
        if (!lastMessage || !lastMessage.content || !lastMessage.content.assignmentData) {
          return {
            message: "I couldn't find the assignment details. Please try creating the assignment again.",
            conversationId: req.body.conversationId
          };
        }

        const { assignmentData } = lastMessage.content;

        // If user said no to materials, create the assignment without them
        if (parameters.needsMaterials === false) {
          try {
            const response = await makeApiCall(
              `${baseUrl}/api/courses/${assignmentData.courseId}/assignments`,
              'POST',
              {
                ...assignmentData,
                materials: []
              },
              userToken,
              req
            );

            return {
              message: `Successfully created the assignment "${assignmentData.title}" without any materials.`,
              assignment: response,
              conversationId: req.body.conversationId
            };
          } catch (error) {
            return {
              message: `Failed to create assignment: ${error.message}`,
              conversationId: req.body.conversationId
            };
          }
        }

        // If user provided materials directly
        if (parameters.materials) {
          // First, check if the material is a URL or a document name
          const material = parameters.materials[0];
          let driveFile = null;

          if (material.title.startsWith('http')) {
            // It's a URL, we can use it directly
            driveFile = {
              title: material.title,
              type: 'LINK',
              url: material.title
            };
          } else {
            // It's a document name, we need to search for it in Drive
            try {
              const driveResponse = await makeApiCall(
                `${baseUrl}/api/drive/search`,
                'POST',
                { query: material.title },
                userToken,
                req
              );

              if (driveResponse && driveResponse.files && driveResponse.files.length > 0) {
                // Use the first matching file
                driveFile = {
                  title: driveResponse.files[0].name,
                  type: 'DRIVE_FILE',
                  driveFile: {
                    id: driveResponse.files[0].id,
                    title: driveResponse.files[0].name,
                    alternateLink: driveResponse.files[0].webViewLink
                  }
                };
              } else {
                return {
                  type: 'ASK_FOR_MATERIALS',
                  message: `I couldn't find a document named "${material.title}" in your Google Drive. Would you like to:\n1. Upload a new document\n2. Provide a different document name\n3. Skip adding materials`,
                  assignmentData,
                  conversationId: req.body.conversationId
                };
              }
            } catch (error) {
              return {
                type: 'ASK_FOR_MATERIALS',
                message: `I encountered an error while searching for the document: ${error.message}. Would you like to:\n1. Upload a new document\n2. Provide a different document name\n3. Skip adding materials`,
                assignmentData,
                conversationId: req.body.conversationId
              };
            }
          }

          // Create the assignment with the material
          try {
            const response = await makeApiCall(
              `${baseUrl}/api/courses/${assignmentData.courseId}/assignments`,
              'POST',
              {
                ...assignmentData,
                materials: [driveFile]
              },
              userToken,
              req
            );

            return {
              message: `Successfully created the assignment "${assignmentData.title}" with the attached material.`,
              assignment: response,
              conversationId: req.body.conversationId
            };
          } catch (error) {
            return {
              message: `Failed to create assignment: ${error.message}`,
              conversationId: req.body.conversationId
            };
          }
        }

        // If user said yes but didn't provide materials yet
        return {
          type: 'ASK_FOR_MATERIALS',
          message: "Please provide either:\n1. A document name from your Google Drive\n2. A URL to attach\n3. Or say 'upload' if you want to upload a new document",
          assignmentData,
          conversationId: req.body.conversationId
        };
      }

      case 'HELP':
        let helpMessage = '';
        
        if (userRole === 'student') {
          helpMessage = `👨‍🎓 **Student Help - Here's what you can do:**

1. **View Your Courses:**
   • "list my courses" - See all courses you're enrolled in

2. **View Course Details:**
   • "show details for physics 352" - Get information about a specific course

3. **View Assignments:**
   • "show all assignments in physics 352" - See all assignments in a course
   • "list assignments for chemistry 101" - View assignments with due dates

4. **View Announcements:**
   • "show announcements in math 201" - See course announcements

5. **Meetings:**
   • "create meeting Study Group with john@email.com tomorrow at 3pm" - Schedule meetings
   • "schedule call Project Discussion today at 7pm for 1 hour" - Set up calls
   • "reschedule my today's meeting which is on today at 5pm make it to 6pm tomorrow" - Update meetings
   • "change my meeting tomorrow at 9am to 10am" - Modify meeting times
   • "cancel my meeting tomorrow at 5pm" - Cancel meetings
   • "delete my meeting today at 3pm" - Remove meetings

6. **Get Help:**
   • "help" - Show this help message

**Example commands:**
• "list my courses"
• "show all assignments in physics 352"
• "show announcements in chemistry 101"
• "create meeting Study Group with john@email.com tomorrow at 3pm"
• "reschedule my today's meeting which is on today at 5pm make it to 6pm tomorrow"
• "cancel my meeting tomorrow at 5pm"`;
        } else if (userRole === 'teacher') {
          helpMessage = `👨‍🏫 **Teacher Help - Here's what you can do:**

1. **Course Management:**
   • "list my courses" - See all your courses
   • "create a new course called Advanced Physics" - Create a new course
   • "get course details for chemistry 101" - View course information

2. **Announcements:**
   • "create announcement Welcome to the new semester in physics 352" - Post announcements
   • "show announcements in math 201" - View existing announcements

3. **Assignments:**
   • "create assignment Math Quiz in physics 352 due next Friday at 5 PM" - Create assignments
   • "show all assignments in chemistry 101" - View all assignments
   • "check assignment submissions for test 1 in physics 352" - Check who submitted

4. **Student Management:**
   • "invite students john@email.com, jane@email.com to physics 352" - Invite students
   • "show enrolled students in chemistry 101" - View student list

5. **Grading:**
   • "grade assignment test 1 for student john@email.com to 95 in physics 352" - Grade assignments

6. **Meetings:**
   • "create meeting Project Review with saadkhan@erptechnicals.com today at 5pm" - Schedule meetings
   • "schedule call Team Sync tomorrow at 9am for 30 minutes" - Set up calls
   • "reschedule my today's meeting which is on today at 5pm make it to 6pm tomorrow" - Update meetings
   • "change my meeting tomorrow at 9am to 10am" - Modify meeting times
   • "cancel my meeting tomorrow at 5pm" - Cancel meetings
   • "delete my meeting today at 3pm" - Remove meetings

**Example commands:**
• "create a new course called Advanced Physics"
• "create assignment Math Quiz in physics 352 due next Friday at 5 PM"
• "invite students john@email.com, jane@email.com to physics 352"
• "create meeting Project Review with saadkhan@erptechnicals.com today at 5pm"
• "reschedule my today's meeting which is on today at 5pm make it to 6pm tomorrow"
• "cancel my meeting tomorrow at 5pm"`;
        } else if (userRole === 'super_admin') {
          helpMessage = `👑 **Super Admin Help - Here's what you can do:**

1. **Course Management:**
   • "list all courses" - See all courses in the system
   • "create a new course called Advanced Physics" - Create new courses
   • "get course details for chemistry 101" - View any course

2. **Announcements:**
   • "create announcement Welcome to the new semester in physics 352" - Post announcements
   • "show announcements in math 201" - View announcements

3. **Assignments:**
   • "create assignment Math Quiz in physics 352 due next Friday at 5 PM" - Create assignments
   • "show all assignments in chemistry 101" - View all assignments
   • "check assignment submissions for test 1 in physics 352" - Check submissions

4. **User Management:**
   • "invite students john@email.com, jane@email.com to physics 352" - Invite students
   • "invite teachers prof@email.com, dr@email.com to physics 352" - Invite teachers
   • "show enrolled students in chemistry 101" - View student lists

5. **Grading:**
   • "grade assignment test 1 for student john@email.com to 95 in physics 352" - Grade assignments

6. **Meetings:**
   • "create meeting Project Review with saadkhan@erptechnicals.com today at 5pm" - Schedule meetings
   • "schedule call Team Sync tomorrow at 9am for 30 minutes" - Set up calls
   • "reschedule my today's meeting which is on today at 5pm make it to 6pm tomorrow" - Update meetings
   • "change my meeting tomorrow at 9am to 10am" - Modify meeting times
   • "cancel my meeting tomorrow at 5pm" - Cancel meetings
   • "delete my meeting today at 3pm" - Remove meetings

**Example commands:**
• "create a new course called Advanced Physics"
• "invite teachers prof@email.com, dr@email.com to physics 352"
• "create assignment Math Quiz in physics 352 due next Friday at 5 PM"
• "create meeting Project Review with saadkhan@erptechnicals.com today at 5pm"
• "reschedule my today's meeting which is on today at 5pm make it to 6pm tomorrow"
• "cancel my meeting tomorrow at 5pm"`;
        } else {
          helpMessage = `❓ **General Help - Here's what you can do:**

1. **Course Management:**
   • List and view courses
   • Get course details

2. **View Content:**
   • View assignments and announcements
   • Check course materials

3. **Meetings:**
   • Schedule meetings and calls
   • Send calendar invitations
   • Update and reschedule existing meetings
   • Cancel and delete meetings

4. **Get Help:**
   • "help" - Show this help message

**Note:** Some features require specific permissions. Please contact your administrator if you need access to create or manage content.`;
        }

        return {
          message: helpMessage,
          conversationId: conversationId
        };

      case 'UNKNOWN':
        // Handle unknown intents gracefully
        return {
          message: `I didn't understand that. Could you please rephrase it? I can help you with creating courses, assignments, announcements, scheduling meetings, and managing your classroom. Say "help" to see all available commands.`,
          conversationId: conversationId
        };

      case 'CHECK_ASSIGNMENT_SUBMISSIONS': {
        // Only allow teachers and super_admin to check assignment submissions
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to check assignment submissions. Only teachers and super admins can view submission status.',
            conversationId: req.body.conversationId
          };
        }

        // 1. Find the course by name
        if (!parameters.courseName) {
          return {
            message: "Please specify the course name to check assignment submissions.",
            conversationId: req.body.conversationId
          };
        }
        if (!parameters.assignmentTitle) {
          return {
            message: "Please specify the assignment title to check submissions.",
            conversationId: req.body.conversationId
          };
        }
        
        try {
          // Use the reusable course matching function
          const courseMatch = await findMatchingCourse(
            parameters.courseName, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            return {
              message: courseMatch.message,
              conversationId: req.body.conversationId
            };
          }
          
          const selectedCourse = courseMatch.course;
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName}". Which one do you mean?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              assignmentTitle: parameters.assignmentTitle,
              conversationId: req.body.conversationId
            };
          }
          
          // Exact match - proceed with assignment search
          const courseId = selectedCourse.id;
          // 2. Find the assignment by title
          const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${courseId}/assignments`, 'GET', null, userToken, req);
          console.log('DEBUG assignmentsResponse:', assignmentsResponse);
          const assignments = Array.isArray(assignmentsResponse)
            ? assignmentsResponse
            : Array.isArray(assignmentsResponse.courses)
              ? assignmentsResponse.courses
              : [];
          console.log('DEBUG assignments:', assignments);
          if (!Array.isArray(assignments) || assignments.length === 0) {
            return {
              message: "I couldn't retrieve assignments for that course.",
              conversationId: req.body.conversationId
            };
          }
          const assignmentTitleTerm = parameters.assignmentTitle.toLowerCase();
          const matchingAssignments = assignments.filter(a => a.title && a.title.toLowerCase().includes(assignmentTitleTerm));
          if (matchingAssignments.length === 0) {
            return {
              message: `I couldn't find any assignments matching "${parameters.assignmentTitle}" in ${selectedCourse.name}.`,
              conversationId: req.body.conversationId
            };
          } else if (matchingAssignments.length > 1) {
            return {
              message: `I found multiple assignments matching "${parameters.assignmentTitle}". Which one do you mean?`,
              options: matchingAssignments.map(a => ({ id: a.id, title: a.title })),
              conversationId: req.body.conversationId
            };
          }
          const assignmentId = matchingAssignments[0].id;
          // 3. Get submissions
          const submissions = await makeApiCall(`${baseUrl}/api/courses/${courseId}/assignments/${assignmentId}/submissions`, 'GET', null, userToken, req);
          console.log('DEBUG submissions:', submissions);
          const submissionList = Array.isArray(submissions)
            ? submissions
            : Array.isArray(submissions.courses)
              ? submissions.courses
              : [];
          if (!Array.isArray(submissionList) || submissionList.length === 0) {
            return {
              message: "I couldn't retrieve submissions for that assignment.",
              conversationId: req.body.conversationId
            };
          }
          // 4. Format summary with user names
          const turnedIn = submissionList.filter(s => s.state === 'TURNED_IN' || s.state === 'RETURNED');
          const notTurnedIn = submissionList.filter(s => s.state !== 'TURNED_IN' && s.state !== 'RETURNED');
          
          // 5. Get user profiles for submitted students
          const submittedUserIds = turnedIn.map(s => s.userId).filter(Boolean);
          const userProfiles = {};
          
          console.log('🔍 DEBUG: Submitted user IDs:', submittedUserIds);
          
          if (submittedUserIds.length > 0) {
            try {
              // Get enrolled students to map userIds to names
              const studentsResponse = await makeApiCall(`${baseUrl}/api/classroom/${courseId}/students`, 'GET', null, userToken, req);
              const students = Array.isArray(studentsResponse)
                ? studentsResponse
                : Array.isArray(studentsResponse.students)
                  ? studentsResponse.students
                  : Array.isArray(studentsResponse.courses)
                    ? studentsResponse.courses
                    : [];
              
              console.log('🔍 DEBUG: Fetched students:', students.length);
              
              // Create a map of userId to student profile
              students.forEach(student => {
                if (student.userId && student.profile) {
                  userProfiles[student.userId] = student.profile;
                  console.log('🔍 DEBUG: Mapped user:', student.userId, '->', student.profile.name?.fullName || student.profile.emailAddress);
                }
              });
              
              console.log('🔍 DEBUG: User profiles map:', Object.keys(userProfiles).length, 'profiles loaded');
            } catch (error) {
              console.log('Could not fetch student profiles, will use userIds instead:', error.message);
            }
          }
          
          let message = `Submissions for "${matchingAssignments[0].title}" in ${selectedCourse.name}:\n`;
          message += `\nSubmitted (${turnedIn.length}):\n`;
          
          if (turnedIn.length > 0) {
            message += turnedIn.map(s => {
              const userId = s.userId || s.id;
              const userProfile = userProfiles[userId];
              if (userProfile && userProfile.name && userProfile.name.fullName) {
                return `• ${userProfile.name.fullName} (${userProfile.emailAddress}) - ${s.state}`;
              } else if (userProfile && userProfile.emailAddress) {
                return `• ${userProfile.emailAddress} (${s.state})`;
              } else {
                return `• ${userId} (${s.state})`;
              }
            }).join('\n');
          } else {
            message += 'None';
          }
          
          message += `\n\nNot Submitted (${notTurnedIn.length}):\n`;
          
          if (notTurnedIn.length > 0) {
            message += notTurnedIn.map(s => {
              const userId = s.userId || s.id;
              const userProfile = userProfiles[userId];
              if (userProfile && userProfile.name && userProfile.name.fullName) {
                return `• ${userProfile.name.fullName} (${userProfile.emailAddress}) - ${s.state}`;
              } else if (userProfile && userProfile.emailAddress) {
                return `• ${userProfile.emailAddress} (${s.state})`;
              } else {
                return `• ${userId} (${s.state})`;
              }
            }).join('\n');
          } else {
            message += 'None';
          }
          
          return {
            message,
            submissions: submissionList,
            conversationId: req.body.conversationId
          };
        } catch (error) {
          console.error('Error in CHECK_ASSIGNMENT_SUBMISSIONS:', error);
          return {
            message: "Sorry, I encountered an error while trying to get the submissions. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }
      
      case 'GRADE_ASSIGNMENT': {
        // Only allow teachers and super_admin to grade assignments
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to grade assignments. Only teachers and super admins can grade student work.',
            conversationId: req.body.conversationId
          };
        }

        // 1. Validate parameters
        const { courseName, assignmentTitle, studentEmail, assignedGrade, draftGrade } = parameters;
        if (!courseName || !assignmentTitle || !studentEmail || (assignedGrade === undefined && draftGrade === undefined)) {
          return { message: "Please provide course, assignment, student, and grade information.", conversationId: req.body.conversationId };
        }

        // 2. Find the course using the same logic as CHECK_ASSIGNMENT_SUBMISSIONS
        const courseMatch = await findMatchingCourse(
          courseName, 
          userToken, 
          req, 
          baseUrl
        );
        
        if (!courseMatch.success) {
          return {
            message: courseMatch.message,
            conversationId: req.body.conversationId
          };
        }
        
        const course = courseMatch.course;

        // 3. Find the assignment using the same logic as CHECK_ASSIGNMENT_SUBMISSIONS
        const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments`, 'GET', null, userToken, req);
        const assignments = Array.isArray(assignmentsResponse)
          ? assignmentsResponse
          : Array.isArray(assignmentsResponse.courses)
            ? assignmentsResponse.courses
            : [];
        
        if (!Array.isArray(assignments) || assignments.length === 0) {
          return {
            message: "I couldn't retrieve assignments for that course.",
            conversationId: req.body.conversationId
          };
        }
        
        const assignmentTitleTerm = assignmentTitle.toLowerCase();
        const matchingAssignments = assignments.filter(a => a.title && a.title.toLowerCase().includes(assignmentTitleTerm));
        if (matchingAssignments.length === 0) {
          return {
            message: `I couldn't find any assignments matching "${assignmentTitle}" in ${course.name}.`,
            conversationId: req.body.conversationId
          };
        } else if (matchingAssignments.length > 1) {
          return {
            message: `I found multiple assignments matching "${assignmentTitle}". Which one do you mean?`,
            options: matchingAssignments.map(a => ({ id: a.id, title: a.title })),
            conversationId: req.body.conversationId
          };
        }
        
        const assignment = matchingAssignments[0];

        // 4. Find the student submission
        const submissionsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments/${assignment.id}/submissions`, 'GET', null, userToken, req);
        const submissions = Array.isArray(submissionsResponse)
          ? submissionsResponse
          : Array.isArray(submissionsResponse.courses)
            ? submissionsResponse.courses
            : [];
        console.log('DEBUG GRADE_ASSIGNMENT submissions:', submissions);
        
        // 5. Find the student by name or email
        let matchUserId = null;
        try {
          const studentsList = await makeApiCall(`${baseUrl}/api/classroom/${course.id}/students`, 'GET', null, userToken, req);
          const students = Array.isArray(studentsList)
            ? studentsList
            : Array.isArray(studentsList.students)
              ? studentsList.students
              : Array.isArray(studentsList.courses)
                ? studentsList.courses
                : [];
          console.log('DEBUG GRADE_ASSIGNMENT students:', students);
          console.log('DEBUG GRADE_ASSIGNMENT searching for student:', studentEmail);
          
          // Try to find student by name or email
          const foundStudent = students.find(s => {
            if (!s.profile) return false;
            
            // Check by email
            if (s.profile.emailAddress && s.profile.emailAddress.toLowerCase() === studentEmail.toLowerCase()) {
              return true;
            }
            
            // Check by full name
            if (s.profile.name && s.profile.name.fullName && 
                s.profile.name.fullName.toLowerCase().includes(studentEmail.toLowerCase())) {
              return true;
            }
            
            // Check by first name or last name
            if (s.profile.name) {
              const firstName = s.profile.name.givenName || '';
              const lastName = s.profile.name.familyName || '';
              const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
              if (fullName.includes(studentEmail.toLowerCase()) || 
                  firstName.toLowerCase().includes(studentEmail.toLowerCase()) ||
                  lastName.toLowerCase().includes(studentEmail.toLowerCase())) {
                return true;
              }
            }
            
            return false;
          });
          
          if (foundStudent && foundStudent.userId) {
            matchUserId = foundStudent.userId;
            console.log('DEBUG GRADE_ASSIGNMENT found student:', foundStudent.userId, foundStudent.profile.name?.fullName);
          } else {
            return { message: `No student found in course with name/email "${studentEmail}". Available students: ${students.map(s => s.profile?.name?.fullName || s.profile?.emailAddress || 'Unknown').join(', ')}`, conversationId: req.body.conversationId };
          }
        } catch (err) {
          return { message: `Failed to look up student: ${err.message}`, conversationId: req.body.conversationId };
        }
        
        // 6. Find the submission by userId
        let submission = submissions.find(s => s.userId && s.userId === matchUserId);
        if (!submission) {
          return { message: `Submission for student "${studentEmail}" not found.`, conversationId: req.body.conversationId };
        }

        // 7. Update the grade
        const gradeData = {};
        if (assignedGrade !== undefined) gradeData.assignedGrade = assignedGrade;
        if (draftGrade !== undefined) gradeData.draftGrade = draftGrade;

        try {
          await makeApiCall(
            `${baseUrl}/api/courses/${course.id}/assignments/${assignment.id}/submissions/${submission.id}`,
            'PATCH',
            gradeData,
            userToken,
            req
          );
        } catch (error) {
          return { message: `Failed to update grade: ${error.message}`, conversationId: req.body.conversationId };
        }

        // 8. Optionally, return the submission (change state to RETURNED)
        try {
          await makeApiCall(
            `${baseUrl}/api/courses/${course.id}/assignments/${assignment.id}/submissions/${submission.id}/return`,
            'POST',
            {},
            userToken,
            req
          );
        } catch (error) {
          // Not fatal, just log
          console.error('Failed to return submission:', error.message);
        }

        return { message: `Grade updated for ${studentEmail} on "${assignmentTitle}".`, conversationId: conversationId };
      }

      case 'LIST_MEETINGS': {
        console.log('🎯 DEBUG: LIST_MEETINGS case executed!');
        
        try {
          // Extract user from JWT token
          const token = userToken.split(' ')[1]; // Remove 'Bearer ' prefix
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await getUserByEmail(decoded.email);
          
          if (!user.access_token || !user.refresh_token) {
            throw new Error('Missing required OAuth2 tokens');
          }
          
          // List upcoming meetings from primary calendar
          const meetings = await listUpcomingMeetings(
            {
              access_token: user.access_token,
              refresh_token: user.refresh_token
            },
            'primary', // Use primary calendar
            null, // timeMin
            null, // timeMax
            20 // Show up to 20 meetings
          );

          if (!meetings || meetings.length === 0) {
            return {
              message: "📅 **No upcoming meetings found.**\n\nYou don't have any scheduled meetings in your calendar.",
              conversationId: req.body.conversationId
            };
          }

          // Format the response message
          let message = `📅 **Your Upcoming Meetings:**\n\n`;
          
          meetings.forEach((meeting, index) => {
            const startTime = meeting.start.dateTime ? 
              new Date(meeting.start.dateTime).toLocaleString() : 
              new Date(meeting.start.date).toLocaleDateString();
            
            const endTime = meeting.end.dateTime ? 
              new Date(meeting.end.dateTime).toLocaleString() : 
              new Date(meeting.end.date).toLocaleDateString();
            
            message += `${index + 1}. **${meeting.summary || 'Untitled Meeting'}**\n`;
            message += `   📅 **Start:** ${startTime}\n`;
            message += `   📅 **End:** ${endTime}\n`;
            
            if (meeting.attendees && meeting.attendees.length > 0) {
              const attendeeEmails = meeting.attendees.map(a => a.email).join(', ');
              message += `   👥 **Attendees:** ${attendeeEmails}\n`;
            }
            
            if (meeting.description) {
              message += `   📝 **Description:** ${meeting.description.substring(0, 100)}${meeting.description.length > 100 ? '...' : ''}\n`;
            }
            
            message += `   🔗 **Calendar Link:** ${meeting.htmlLink}\n\n`;
          });
          
          message += `💡 **Total:** ${meetings.length} upcoming meeting(s)\n`;
          message += `• You can create new meetings by saying "create meeting [title] with [email] at [time] on [date]"\n`;
          message += `• Reschedule meetings by saying "reschedule my meeting at [time] to [new time]"\n`;
          message += `• Cancel meetings by saying "cancel my meeting at [time]"`;
          
          return {
            message: message,
            meetings: meetings,
            conversationId: req.body.conversationId
          };
          
        } catch (error) {
          console.error('Error in LIST_MEETINGS:', error);
          return {
            message: `❌ **Error listing meetings:** ${error.message}`,
            conversationId: req.body.conversationId
          };
        }
      }

      case 'CREATE_MEETING': {
        console.log('🎯 DEBUG: CREATE_MEETING case executed!');
        console.log('🔍 DEBUG: parameters:', JSON.stringify(parameters, null, 2));
        
        // All users can create meetings
        if (!parameters.title && !parameters.attendees) {
          console.log('❌ DEBUG: Missing title or attendees');
          return {
            message: "I need more information to create a meeting. Please provide a title and at least one attendee email.",
            conversationId: req.body.conversationId
          };
        }

        try {
          // Extract user from JWT token
          const token = userToken.split(' ')[1]; // Remove 'Bearer ' prefix
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await getUserByEmail(decoded.email);
          
          if (!user.access_token || !user.refresh_token) {
            throw new Error('Missing required OAuth2 tokens');
          }
          
          // Prepare meeting data
          const meetingData = {
            title: parameters.title || 'Meeting',
            attendees: parameters.attendees || [],
            dateExpr: parameters.dateExpr,
            timeExpr: parameters.timeExpr,
            duration: parameters.duration || 60,
            description: parameters.description || '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone // User's local timezone
          };
          
          // Use internal service function to create meeting
          const response = await createMeeting(
            {
              access_token: user.access_token,
              refresh_token: user.refresh_token
            },
            meetingData
          );

          if (!response.success) {
            throw new Error(response.message || 'Failed to create meeting');
          }

          // Format the response message
          let message = `🎉 **Meeting "${meetingData.title}" created successfully!**\n\n`;
          
          if (meetingData.dateExpr) {
            message += `📅 **Date:** ${meetingData.dateExpr}\n`;
          }
          
          if (meetingData.timeExpr) {
            message += `🕐 **Time:** ${meetingData.timeExpr}\n`;
          }
          
          if (meetingData.duration) {
            const hours = Math.floor(meetingData.duration / 60);
            const minutes = meetingData.duration % 60;
            const durationText = hours > 0 ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}` : `${minutes}m`;
            message += `⏱️ **Duration:** ${durationText}\n`;
          }
          
          if (meetingData.attendees && meetingData.attendees.length > 0) {
            message += `👥 **Attendees:** ${meetingData.attendees.join(', ')}\n`;
          }
          
          if (meetingData.description) {
            message += `📝 **Description:** ${meetingData.description}\n`;
          }
          
          message += `\n✅ **Meeting Details:**\n`;
          message += `• **Event ID:** ${response.meeting.id}\n`;
          message += `• **Calendar Link:** ${response.meeting.htmlLink}\n`;
          message += `• **Status:** ${response.meeting.status}\n`;
          
          message += `\n💡 **Next steps:**\n`;
          message += `• Check your Google Calendar\n`;
          message += `• Attendees will receive email invitations\n`;
          message += `• You can modify the meeting anytime`;
          
          return {
            message: message,
            meeting: response.meeting,
            conversationId: req.body.conversationId
          };
          
        } catch (error) {
          console.error('Error in CREATE_MEETING:', error);
          
          if (error.message.includes('Missing required OAuth2 tokens')) {
            return {
              message: "I couldn't create the meeting because your Google account isn't properly connected. Please reconnect your Google account.",
              error: error.message,
              conversationId: req.body.conversationId
            };
          } else if (error.message.includes('Could not parse date expression')) {
            return {
              message: `I couldn't understand the date you provided: "${parameters.dateExpr}". Please use expressions like "today", "tomorrow", "next Friday", or specific dates like "December 15".`,
              error: error.message,
              conversationId: req.body.conversationId
            };
          } else if (error.message.includes('Could not parse time expression')) {
            return {
              message: `I couldn't understand the time you provided: "${parameters.timeExpr}". Please use expressions like "5 PM", "9:30 AM", or "noon".`,
              error: error.message,
              conversationId: req.body.conversationId
            };
          }
          
          return {
            message: "Sorry, I encountered an error while trying to create the meeting. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }

      case 'UPDATE_MEETING': {
        console.log('🎯 DEBUG: UPDATE_MEETING case executed!');
        console.log('🔍 DEBUG: parameters:', JSON.stringify(parameters, null, 2));
        
        // All users can update meetings
        if (!parameters.currentDateExpr || !parameters.currentTimeExpr) {
          return {
            message: "I need to know which meeting you want to update. Please specify the current date and time of the meeting.",
            conversationId: req.body.conversationId
          };
        }

        if (!parameters.newDateExpr && !parameters.newTimeExpr && !parameters.newDuration) {
          return {
            message: "I need to know what changes you want to make. Please specify the new date, time, or duration.",
            conversationId: req.body.conversationId
          };
        }

        try {
          // Extract user from JWT token
          const token = userToken.split(' ')[1]; // Remove 'Bearer ' prefix
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await getUserByEmail(decoded.email);
          
          if (!user.access_token || !user.refresh_token) {
            throw new Error('Missing required OAuth2 tokens');
          }
          
          // Find the meeting by current date and time
          const foundMeeting = await findMeetingByDateTime(
            {
              access_token: user.access_token,
              refresh_token: user.refresh_token
            },
            parameters.currentDateExpr,
            parameters.currentTimeExpr
          );

          if (!foundMeeting) {
            return {
              message: `I couldn't find a meeting on ${parameters.currentDateExpr} at ${parameters.currentTimeExpr}. Please check the date and time, or try listing your upcoming meetings first.`,
              conversationId: req.body.conversationId
            };
          }

          // Prepare update data
          const updateData = {
            ...(parameters.newDateExpr ? { dateExpr: parameters.newDateExpr } : {}),
            ...(parameters.newTimeExpr ? { timeExpr: parameters.newTimeExpr } : {}),
            ...(parameters.newDuration ? { duration: parameters.newDuration } : {})
          };

          // Update the meeting
          const response = await updateMeeting(
            {
              access_token: user.access_token,
              refresh_token: user.refresh_token
            },
            foundMeeting.id,
            updateData
          );

          if (!response.success) {
            throw new Error(response.message || 'Failed to update meeting');
          }

          // Format the response message
          let message = `🎉 **Meeting "${foundMeeting.summary}" updated successfully!**\n\n`;
          
          if (parameters.newDateExpr) {
            message += `📅 **New Date:** ${parameters.newDateExpr}\n`;
          }
          
          if (parameters.newTimeExpr) {
            message += `🕐 **New Time:** ${parameters.newTimeExpr}\n`;
          }
          
          if (parameters.newDuration) {
            const hours = Math.floor(parameters.newDuration / 60);
            const minutes = parameters.newDuration % 60;
            const durationText = hours > 0 ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}` : `${minutes}m`;
            message += `⏱️ **New Duration:** ${durationText}\n`;
          }
          
          message += `\n✅ **Updated Meeting Details:**\n`;
          message += `• **Event ID:** ${response.meeting.id}\n`;
          message += `• **Calendar Link:** ${response.meeting.htmlLink}\n`;
          message += `• **Status:** ${response.meeting.status}\n`;
          
          message += `\n💡 **Next steps:**\n`;
          message += `• Check your updated Google Calendar\n`;
          message += `• Attendees will receive updated invitations\n`;
          message += `• You can make more changes anytime`;
          
          return {
            message: message,
            meeting: response.meeting,
            conversationId: req.body.conversationId
          };
          
        } catch (error) {
          console.error('Error in UPDATE_MEETING:', error);
          
          if (error.message.includes('Missing required OAuth2 tokens')) {
            return {
              message: "I couldn't update the meeting because your Google account isn't properly connected. Please reconnect your Google account.",
              error: error.message,
              conversationId: req.body.conversationId
            };
          } else if (error.message.includes('Could not parse date expression')) {
            return {
              message: `I couldn't understand the date you provided: "${parameters.newDateExpr || parameters.currentDateExpr}". Please use expressions like "today", "tomorrow", "next Friday", or specific dates like "December 15".`,
              error: error.message,
              conversationId: req.body.conversationId
            };
          } else if (error.message.includes('Could not parse time expression')) {
            return {
              message: `I couldn't understand the time you provided: "${parameters.newTimeExpr || parameters.currentTimeExpr}". Please use expressions like "5 PM", "9:30 AM", or "noon".`,
              error: error.message,
              conversationId: req.body.conversationId
            };
          } else if (error.message.includes('Meeting not found')) {
            return {
              message: `I couldn't find the meeting you specified. Please check the date and time, or try listing your upcoming meetings first.`,
              error: error.message,
              conversationId: req.body.conversationId
            };
          }
          
          return {
            message: "Sorry, I encountered an error while trying to update the meeting. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }

      case 'DELETE_MEETING': {
        console.log('🎯 DEBUG: DELETE_MEETING case executed!');
        console.log('🔍 DEBUG: parameters:', JSON.stringify(parameters, null, 2));
        
        // All users can delete meetings
        if (!parameters.dateExpr || !parameters.timeExpr) {
          return {
            message: "I need to know which meeting you want to cancel. Please specify the date and time of the meeting.",
            conversationId: req.body.conversationId
          };
        }

        try {
          // Extract user from JWT token
          const token = userToken.split(' ')[1]; // Remove 'Bearer ' prefix
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await getUserByEmail(decoded.email);
          
          if (!user.access_token || !user.refresh_token) {
            throw new Error('Missing required OAuth2 tokens');
          }
          
          // Find the meeting by date and time
          const foundMeeting = await findMeetingByDateTime(
            {
              access_token: user.access_token,
              refresh_token: user.refresh_token
            },
            parameters.dateExpr,
            parameters.timeExpr
          );

          if (!foundMeeting) {
            return {
              message: `I couldn't find a meeting on ${parameters.dateExpr} at ${parameters.timeExpr}. Please check the date and time, or try listing your upcoming meetings first.`,
              conversationId: req.body.conversationId
            };
          }

          // Delete the meeting
          const response = await deleteMeeting(
            {
              access_token: user.access_token,
              refresh_token: user.refresh_token
            },
            foundMeeting.id
          );

          if (!response.success) {
            throw new Error(response.message || 'Failed to delete meeting');
          }

          // Format the response message
          let message = `🗑️ **Meeting Cancelled Successfully!**\n\n`;
          message += `✅ **Cancelled:** "${foundMeeting.summary}"\n`;
          message += `📅 **Date:** ${parameters.dateExpr}\n`;
          message += `🕐 **Time:** ${parameters.timeExpr}\n`;
          
          if (foundMeeting.attendees && foundMeeting.attendees.length > 0) {
            message += `👥 **Attendees notified:** ${foundMeeting.attendees.length} people\n`;
          }
          
          message += `\n💡 **Next steps:**\n`;
          message += `• Check your updated Google Calendar\n`;
          message += `• Attendees will receive cancellation emails\n`;
          message += `• You can create new meetings anytime`;
          
          return {
            message: message,
            deletedMeeting: response.deletedEvent,
            conversationId: req.body.conversationId
          };
          
        } catch (error) {
          console.error('Error in DELETE_MEETING:', error);
          
          if (error.message.includes('Missing required OAuth2 tokens')) {
            return {
              message: "I couldn't cancel the meeting because your Google account isn't properly connected. Please reconnect your Google account.",
              error: error.message,
              conversationId: req.body.conversationId
            };
          } else if (error.message.includes('Could not parse date expression')) {
            return {
              message: `I couldn't understand the date you provided: "${parameters.dateExpr}". Please use expressions like "today", "tomorrow", "next Friday", or specific dates like "December 15".`,
              error: error.message,
              conversationId: req.body.conversationId
            };
          } else if (error.message.includes('Could not parse time expression')) {
            return {
              message: `I couldn't understand the time you provided: "${parameters.timeExpr}". Please use expressions like "5 PM", "9:30 AM", or "noon".`,
              error: error.message,
              conversationId: req.body.conversationId
            };
          } else if (error.message.includes('Meeting not found')) {
            return {
              message: `I couldn't find the meeting you specified. Please check the date and time, or try listing your upcoming meetings first.`,
              error: error.message,
              conversationId: req.body.conversationId
            };
          }
          
          return {
            message: "Sorry, I encountered an error while trying to cancel the meeting. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }

      case 'SHOW_ENROLLED_STUDENTS': {
        // Only allow teachers and super_admin to view enrolled students
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to view enrolled students. Only teachers and super admins can view student lists.',
            conversationId: req.body.conversationId
          };
        }

        if (!parameters.courseName) {
          return {
            message: "Please specify the course name to list enrolled students.",
            conversationId: req.body.conversationId
          };
        }
        
        try {
          // Use the reusable course matching function
          const courseMatch = await findMatchingCourse(
            parameters.courseName, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            return {
              message: courseMatch.message,
              conversationId: req.body.conversationId
            };
          }
          
          const selectedCourse = courseMatch.course;
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName}". Which one do you mean?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              conversationId: req.body.conversationId
            };
          }
          
          // Exact match - get the students
          const courseId = selectedCourse.id;
          const studentsList = await makeApiCall(`${baseUrl}/api/classroom/${courseId}/students`, 'GET', null, userToken, req);
          const students = Array.isArray(studentsList)
            ? studentsList
            : Array.isArray(studentsList.students)
              ? studentsList.students
              : Array.isArray(studentsList.courses)
                ? studentsList.courses
                : [];
          console.log('DEBUG studentsList:', studentsList);
          console.log('DEBUG students:', students);
          if (!Array.isArray(students) || students.length === 0) {
            return {
              message: `No students are currently enrolled in ${selectedCourse.name}.`,
              conversationId: req.body.conversationId
            };
          }
          const studentLines = students.map(s => `• ${s.profile && s.profile.name && s.profile.name.fullName ? s.profile.name.fullName : s.userId} (${s.profile && s.profile.emailAddress ? s.profile.emailAddress : 'No email'})`).join('\n');
          return {
            message: `Enrolled students in ${selectedCourse.name}:\n${studentLines}`,
            students,
            conversationId: req.body.conversationId
          };
        } catch (error) {
          console.error('Error in SHOW_ENROLLED_STUDENTS:', error);
          return {
            message: "Sorry, I encountered an error while getting enrolled students. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }
      
      case 'READ_EMAIL': {
        // Only allow authenticated users to read emails
        if (!userToken) {
          return {
            message: 'You need to be authenticated to read emails.',
            conversationId: req.body.conversationId
          };
        }
        
        if (!parameters.senderEmail) {
          return {
            message: 'I need to know which email address to read emails from. Please provide a sender email.',
            conversationId: req.body.conversationId
          };
        }
        
        try {
          // Extract user from JWT token
          const token = userToken.split(' ')[1]; // Remove 'Bearer ' prefix
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await getUserByEmail(decoded.email);
          
          if (!user.access_token || !user.refresh_token) {
            throw new Error('Missing required OAuth2 tokens');
          }
          
          // Use internal service function to read emails
          const { readEmails } = require('../emailService');
          
          const emails = await readEmails(
            {
              access_token: user.access_token,
              refresh_token: user.refresh_token
            },
            parameters.senderEmail,
            parameters.limit || 10,
            parameters.subject
          );
          
          if (!emails || emails.length === 0) {
            return {
              message: `No emails found from ${parameters.senderEmail}.`,
              emails: [],
              conversationId: req.body.conversationId
            };
          }
          
          // Format the email list
          let message = `📧 **Emails from ${parameters.senderEmail} (${emails.length}):**\n\n`;
          
          emails.forEach((email, index) => {
            const emailNumber = index + 1;
            const date = email.date ? new Date(email.date).toLocaleString() : 'Unknown date';
            const snippet = email.snippet ? email.snippet.substring(0, 100) + '...' : 'No preview available';
            
            message += `${emailNumber}. **${email.subject || 'No Subject'}**\n`;
            message += `   📅 Date: ${date}\n`;
            message += `   📝 Preview: ${snippet}\n`;
            if (email.hasAttachments) {
              message += `   📎 Has attachments\n`;
            }
            message += '\n';
          });
          
          return {
            message: message,
            emails: emails,
            conversationId: req.body.conversationId
          };
        } catch (error) {
          console.error('Error in READ_EMAIL:', error);
          return {
            message: "Sorry, I encountered an error while reading emails. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }
      
      case 'SEND_EMAIL': {
        // Only allow authenticated users to send emails
        if (!userToken) {
          return {
            message: 'You need to be authenticated to send emails.',
            conversationId: req.body.conversationId
          };
        }
        
        if (!parameters.recipientEmail) {
          return {
            message: 'I need to know who to send the email to. Please provide a recipient email address.',
            conversationId: req.body.conversationId
          };
        }
        
        if (!parameters.message) {
          return {
            message: 'I need to know what message to send. Please provide the email content.',
            conversationId: req.body.conversationId
          };
        }
        
        try {
          // Extract user from JWT token
          const token = userToken.split(' ')[1]; // Remove 'Bearer ' prefix
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await getUserByEmail(decoded.email);
          
          if (!user.access_token || !user.refresh_token) {
            throw new Error('Missing required OAuth2 tokens');
          }
          
          // Use internal service function to send email
          const { sendEmail } = require('../emailService');
          
          const result = await sendEmail(
            {
              access_token: user.access_token,
              refresh_token: user.refresh_token
            },
            parameters.recipientEmail,
            parameters.subject || 'Message from AI Assistant',
            parameters.message,
            parameters.attachments || []
          );
          
          return {
            message: `📧 **Email sent successfully to ${parameters.recipientEmail}!**\n\n📝 **Subject:** ${parameters.subject || 'Message from AI Assistant'}\n\n✅ Your email has been sent and is now in the recipient's inbox.`,
            emailResult: result,
            conversationId: req.body.conversationId
          };
        } catch (error) {
          console.error('Error in SEND_EMAIL:', error);
          return {
            message: "Sorry, I encountered an error while sending the email. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }
      
      default:
        console.log('❌ DEBUG: No matching case found for intent:', intent);
        console.log('🔍 DEBUG: Available cases: LIST_COURSES, CREATE_COURSE, LIST_ASSIGNMENTS, CREATE_ANNOUNCEMENT, GET_ANNOUNCEMENTS, GET_COURSE, CREATE_ASSIGNMENT, INVITE_STUDENTS, INVITE_TEACHERS, PROVIDE_MATERIALS, HELP, CHECK_ASSIGNMENT_SUBMISSIONS, GRADE_ASSIGNMENT, CREATE_MEETING, SHOW_ENROLLED_STUDENTS, READ_EMAIL, SEND_EMAIL');
        return {
          message: "I'm not sure how to handle that request. Please try again or ask for help.",
          conversationId: conversationId
        };
    }
  } catch (error) {
    console.error('Action execution error:', error);
    if (error.response && error.response.data) {
      return {
        message: `Error: ${error.response.data.error || 'An error occurred'}`,
        conversationId: conversationId
      };
    }
    return {
      message: "Sorry, I couldn't complete that action. Please try again later.",
      conversationId: conversationId
    };
  }
}

// Helper function to format courses response with proper message
function formatCoursesResponse(coursesResponse, userRole, conversationId) {
  try {
    // Extract courses from the response
    let courses = [];
    if (Array.isArray(coursesResponse)) {
      courses = coursesResponse;
    } else if (coursesResponse && Array.isArray(coursesResponse.courses)) {
      courses = coursesResponse.courses;
    } else if (coursesResponse && typeof coursesResponse === 'object') {
      // Handle case where response is an object with numeric keys
      courses = Object.values(coursesResponse).filter(item => 
        item && typeof item === 'object' && item.id && item.name
      );
    }

    if (!Array.isArray(courses) || courses.length === 0) {
      return {
        message: 'No courses found.',
        courses: [],
        conversationId: conversationId
      };
    }

    // Format the message based on user role
    let message = '';
    if (userRole === 'student') {
      message = `📚 **Your Enrolled Courses (${courses.length}):**\n\n`;
    } else {
      message = `📚 **Available Courses (${courses.length}):**\n\n`;
    }

    // Add each course to the message
    courses.forEach((course, index) => {
      const courseNumber = index + 1;
      const section = course.section ? ` (${course.section})` : '';
      const enrollmentCode = course.enrollmentCode ? `\n   📝 Enrollment Code: ${course.enrollmentCode}` : '';
      const state = course.courseState ? `\n   📊 Status: ${course.courseState}` : '';
      
      message += `${courseNumber}. **${course.name}**${section}${enrollmentCode}${state}\n`;
      
      if (course.alternateLink) {
        message += `   🔗 [View in Google Classroom](${course.alternateLink})\n`;
      }
      message += '\n';
    });

    // Add footer based on user role
    if (userRole === 'student') {
      message += '💡 **Student Actions:**\n• View assignments and materials\n• Submit work\n• Check grades';
    } else {
      message += '💡 **Teacher Actions:**\n• Create assignments\n• Invite students\n• Post announcements\n• Manage course materials';
    }

    return {
      message: message,
      courses: courses,
      conversationId: conversationId
    };
  } catch (error) {
    console.error('Error formatting courses response:', error);
    return {
      message: 'Sorry, I encountered an error while formatting the courses list. Please try again.',
      error: error.message,
      courses: [],
      conversationId: conversationId
    };
  }
}

// Helper function to format course details response with proper message
function formatCourseDetailsResponse(courseResponse, userRole, conversationId) {
  try {
    // Extract course from the response
    let course = null;
    if (courseResponse && typeof courseResponse === 'object') {
      if (courseResponse.id && courseResponse.name) {
        course = courseResponse;
      } else if (courseResponse.course && courseResponse.course.id) {
        course = courseResponse.course;
      }
    }

    if (!course) {
      return {
        message: 'Course details not found or invalid response format.',
        course: null,
        conversationId: conversationId
      };
    }

    // Format the message based on user role
    let message = '';
    if (userRole === 'student') {
      message = `📚 **Course Details - ${course.name}**\n\n`;
    } else {
      message = `📚 **Course Details - ${course.name}**\n\n`;
    }

    // Add course information
    message += `**📖 Basic Information:**\n`;
    message += `• **Name:** ${course.name}\n`;
    if (course.section) message += `• **Section:** ${course.section}\n`;
    if (course.descriptionHeading) message += `• **Description Heading:** ${course.descriptionHeading}\n`;
    if (course.description) message += `• **Description:** ${course.description}\n`;
    if (course.room) message += `• **Room:** ${course.room}\n`;
    message += `• **Status:** ${course.courseState || 'Unknown'}\n`;
    message += `• **Created:** ${course.creationTime ? new Date(course.creationTime).toLocaleDateString() : 'Unknown'}\n`;
    message += `• **Last Updated:** ${course.updateTime ? new Date(course.updateTime).toLocaleDateString() : 'Unknown'}\n\n`;

    // Add enrollment information
    if (course.enrollmentCode) {
      message += `**🎫 Enrollment Information:**\n`;
      message += `• **Enrollment Code:** ${course.enrollmentCode}\n`;
      if (course.alternateLink) {
        message += `• **Classroom Link:** [Open in Google Classroom](${course.alternateLink})\n`;
      }
      message += '\n';
    }

    // Add Google Drive folder information
    if (course.teacherFolder && course.teacherFolder.id) {
      message += `**📁 Course Materials:**\n`;
      message += `• **Teacher Folder:** [${course.teacherFolder.title}](${course.teacherFolder.alternateLink})\n`;
      message += '\n';
    }

    // Add calendar information
    if (course.calendarId) {
      message += `**📅 Calendar:**\n`;
      message += `• **Course Calendar ID:** ${course.calendarId}\n`;
      message += '\n';
    }

    // Add gradebook settings
    if (course.gradebookSettings) {
      message += `**📊 Gradebook Settings:**\n`;
      message += `• **Calculation Type:** ${course.gradebookSettings.calculationType || 'Not set'}\n`;
      message += `• **Display Setting:** ${course.gradebookSettings.displaySetting || 'Not set'}\n`;
      message += '\n';
    }

    // Add footer based on user role
    if (userRole === 'student') {
      message += '💡 **Student Actions:**\n• View assignments and materials\n• Submit work\n• Check grades\n• Access course resources';
    } else {
      message += '💡 **Teacher Actions:**\n• Create assignments\n• Invite students\n• Post announcements\n• Manage course materials\n• View student submissions';
    }

    return {
      message: message,
      course: course,
      conversationId: conversationId
    };
  } catch (error) {
    console.error('Error formatting course details response:', error);
    return {
      message: 'Sorry, I encountered an error while formatting the course details. Please try again.',
      error: error.message,
      course: null,
      conversationId: conversationId
    };
  }
}

module.exports = {
  executeAction,
  makeApiCall
}; 