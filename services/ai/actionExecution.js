const { calculateDateFromExpression, convertTimeExpression } = require('../../utils/dateUtils');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getUserByEmail } = require('../../models/user.model');
const OpenAI = require('openai');
const { 
  generateConversationId, 
  startOngoingAction, 
  updateOngoingActionParameters, 
  isActionComplete, 
  getOngoingActionContext, 
  completeOngoingAction, 
  isNewActionAttempt, 
  getContextAwareMessage,
  getConversation
} = require('./conversationManager');
// Assignment service is now loaded dynamically when needed (database-based)
const { createMeeting, findMeetingByDateTime, updateMeeting, deleteMeeting, listUpcomingMeetings } = require('../meetingService');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * AI-powered error analysis and response generation
 */
async function generateIntelligentErrorResponse(error, context) {
  try {
    const errorLog = {
      message: error.message,
      status: error.status,
      code: error.code,
      errors: error.errors || [],
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      },
      response: {
        status: error.response?.status,
        statusText: error.response?.statusText
      }
    };

    const contextInfo = {
      action: context.action || 'UNKNOWN',
      studentEmails: context.studentEmails || [],
      courseName: context.courseName || 'Unknown',
      courseId: context.courseId || 'Unknown'
    };

    const prompt = `
You are an AI assistant that analyzes error logs and generates helpful, user-friendly error messages for a classroom management system.

ERROR LOG:
${JSON.stringify(errorLog, null, 2)}

CONTEXT:
${JSON.stringify(contextInfo, null, 2)}

Based on this error information, generate a helpful error message that:
1. Explains what went wrong in simple terms
2. Identifies the specific issue (email format, permissions, network, etc.)
3. Provides actionable solutions
4. Is empathetic and professional
5. Keep it SHORT and CLEAN - no markdown formatting, no asterisks, no excessive emojis
6. Use simple bullet points and clear language

Common error patterns to look for:
- "Requested entity was not found" + invalid email format (comma instead of period)
- "PERMISSION_DENIED" + domain restrictions
- "Missing required OAuth2 tokens" + authentication issues
- Network timeouts or connection issues
- Invalid course IDs or non-existent courses

Generate a concise response that helps the user understand and fix the issue.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing technical errors and explaining them to users in a helpful, friendly way. Always provide actionable solutions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    return response.choices[0].message.content.trim();
  } catch (aiError) {
    console.error('Error generating AI error response:', aiError);
    // Fallback to basic error message
    return `Error Analysis Failed\n\nI encountered an error while analyzing the problem: ${error.message}\n\nPlease try again or contact support if the issue persists.`;
  }
}

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
- "industrial chemistry" → {"intent": "direct_name", "name": "Industrial Chemistry"}
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

IMPORTANT: If the user provides a subject name like "industrial chemistry", "computer science", "mathematics", "physics", etc., treat it as a direct course name and capitalize it properly.

Respond with JSON only:`;

    // Use the internal AI service instead of external API
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    
    const result = await model.generateContent(intentAnalysisPrompt);
    const response = result.response.text();
    
    try {
      // Try to parse the response as JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, try to extract intent from the response
      const lowerResponse = response.toLowerCase();
      if (lowerResponse.includes('direct_name') || lowerResponse.includes('provided_name') || lowerResponse.includes('selected_name')) {
        // Extract the name from the response
        const nameMatch = response.match(/"name":\s*"([^"]+)"/);
        if (nameMatch) {
          return { intent: 'direct_name', name: nameMatch[1] };
      }
    }
    
    return { intent: 'uncertainty', needs_help: true };
    } catch (parseError) {
      console.error('Error parsing AI intent analysis:', parseError);
      return { intent: 'uncertainty', needs_help: true };
    }
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
  
  // Check if it's too generic (but allow academic subjects)
  const tooGeneric = ['test', 'course', 'class', 'new', 'name', 'title'];
  const academicSubjects = ['chemistry', 'physics', 'mathematics', 'biology', 'history', 'english', 'literature', 'computer science', 'engineering', 'medicine', 'psychology', 'sociology', 'economics', 'business', 'art', 'music', 'geography', 'philosophy', 'political science', 'industrial chemistry', 'organic chemistry', 'inorganic chemistry', 'analytical chemistry', 'physical chemistry', 'biochemistry'];
  
  if (tooGeneric.includes(trimmedName.toLowerCase()) && !academicSubjects.includes(trimmedName.toLowerCase())) {
    return false;
  }
  
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
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    
    const result = await model.generateContent(intentAnalysisPrompt);
    const response = result.response.text();

    try {
      // Try to parse the response as JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, try to extract intent from the response
      const lowerResponse = response.toLowerCase();
      if (lowerResponse.includes('announcement_text') || lowerResponse.includes('course_name')) {
        // Extract the relevant data from the response
        const textMatch = response.match(/"text":\s*"([^"]+)"/);
        const courseMatch = response.match(/"courseName":\s*"([^"]+)"/);
        if (textMatch) {
          return { intent: 'announcement_text', text: textMatch[1] };
        } else if (courseMatch) {
          return { intent: 'course_name', courseName: courseMatch[1] };
      }
    }
    
    return { intent: 'uncertainty', needs_help: true };
    } catch (parseError) {
      console.error('Error parsing AI intent analysis:', parseError);
      return { intent: 'uncertainty', needs_help: true };
    }
  } catch (error) {
    console.error('Error in AI intent analysis:', error);
    return { intent: 'uncertainty', needs_help: true };
  }
}

/**
 * Handle parameter collection for ongoing actions
 * This function processes user input to collect missing parameters
 */
async function handleParameterCollection(intent, parameters, conversationId, originalMessage, userToken, req, baseUrl) {
  if (!conversationId) return null;
  
  const context = getOngoingActionContext(conversationId);
  if (!context) return null;
  
  const { action, missingParameters, collectedParameters } = context;
  
  console.log('🔍 DEBUG: handleParameterCollection called with:', {
    intent,
    action,
    missingParameters,
    originalMessage,
    conversationId
  });
  
  // Minimal fast-path: handle simple INVITE_TEACHERS courseName replies (e.g., "ai integration")
  if (action === 'INVITE_TEACHERS' && missingParameters && missingParameters.includes('courseName')) {
    const text = (originalMessage || '').trim();
    if (text.length > 0 && text.length < 120) {
      // Merge any previously collected emails
      const emails = (collectedParameters && Array.isArray(collectedParameters.emails)) ? collectedParameters.emails : [];
      const allParameters = { ...(collectedParameters || {}), courseName: text, emails };
      completeOngoingAction(conversationId);
      return {
        action: 'INVITE_TEACHERS',
        actionComplete: true,
        allParameters,
        collectedParameters: allParameters,
        missingParameters: []
      };
    }
  }
  
  // Check if this message provides any of the missing parameters
  let newParameters = {};
  let parametersFound = false;
  
  switch (action) {
    case 'CREATE_COURSE':
      // Handle confirmation for course name first
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
      // Check if user provided a course name
      else if (missingParameters.includes('name')) {
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
      }
      break;
      
    case 'CREATE_ASSIGNMENT':
      // Check if user provided assignment title
      if (missingParameters.includes('title')) {
        // Try different patterns for title extraction
        const titlePatterns = [
          /(?:called|titled|title is|call it|the title should be|the title is)\s+(.+)$/i,
          /(?:title:?|name:?)\s+(.+)$/i
        ];
        
        let titleExtracted = false;
        for (const pattern of titlePatterns) {
          const titleMatch = originalMessage.match(pattern);
        if (titleMatch && titleMatch[1]) {
          newParameters.title = titleMatch[1].trim();
          parametersFound = true;
            titleExtracted = true;
            break;
          }
        }
        
        // If no pattern matched, try AI-based extraction
        if (!titleExtracted) {
          try {
            const aiExtractionPrompt = `Extract the assignment title from this user message. Return only the title, nothing else.
User message: "${originalMessage}"
Examples:
- "The title should be Intro to CS" → "Intro to CS"
- "Call it Math Homework" → "Math Homework" 
- "Title: Final Project" → "Final Project"
- "Intro to CS" → "Intro to CS"
- "Homework 1" → "Homework 1"
Extracted title:`;

            // Use the correct OpenAI API key instead of user token
            const openaiApiKey = process.env.OPENAI_API_KEY;
            const aiResponse = await makeApiCall(
              'https://api.openai.com/v1/chat/completions',
              'POST',
              {
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: 'You are an AI assistant that extracts assignment titles from user messages. Always respond with just the title, nothing else.'
                  },
                  {
                    role: 'user',
                    content: aiExtractionPrompt
                  }
                ],
                max_tokens: 50,
                temperature: 0.1
              },
              openaiApiKey,
              req
            );

            if (aiResponse && aiResponse.choices && aiResponse.choices[0] && aiResponse.choices[0].message) {
              const extractedTitle = aiResponse.choices[0].message.content.trim();
              if (extractedTitle && extractedTitle.length > 0 && extractedTitle.length < 200) {
                newParameters.title = extractedTitle;
                parametersFound = true;
                titleExtracted = true;
              }
            }
          } catch (error) {
            console.error('Error in AI title extraction:', error);
          }
        }

        // If still no title extracted, check if they just said the title directly
        if (!titleExtracted) {
          // Only treat as direct title if it's a short, reasonable title and doesn't contain common words
          const commonWords = ['assignment', 'create', 'make', 'should', 'be', 'the', 'title', 'for', 'in', 'class', 'course'];
          const words = originalMessage.toLowerCase().split(/\s+/);
          const hasCommonWords = words.some(word => commonWords.includes(word));
          
          if (!hasCommonWords && originalMessage.length < 100) {
          newParameters.title = originalMessage.trim();
          parametersFound = true;
          }
        }
      }
      
      // Check if user answered about attachment
      if (missingParameters.includes('hasAttachment')) {
        const lowerMessage = originalMessage.toLowerCase().trim();
        const yesPatterns = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'y', 'ya', 'yea', 'attach'];
        const noPatterns = ['no', 'nope', 'nah', 'n', 'skip', 'not', 'don\'t'];
        
        if (yesPatterns.some(pattern => lowerMessage === pattern || lowerMessage.includes(pattern))) {
          newParameters.hasAttachment = true;
          newParameters.attachmentUrl = 'pending'; // Will be provided later through frontend
          parametersFound = true;
        } else if (noPatterns.some(pattern => lowerMessage === pattern || lowerMessage.includes(pattern))) {
          newParameters.hasAttachment = false;
          parametersFound = true;
        }
      }
      
      // Check if user provided course name
      if (missingParameters.includes('courseName')) {
        let courseName = originalMessage.trim();
        
        // Handle course name correction patterns
        const correctionPatterns = [
          /sorry\s+(?:the\s+)?course\s+name\s+is\s+(.+)/i,
          /(?:the\s+)?course\s+name\s+is\s+(.+)/i,
          /(?:it'?s|it\s+is)\s+(.+)/i,
          /(?:actually\s+)?(?:it'?s|it\s+is)\s+(.+)/i,
          /(?:correct\s+)?course\s+name\s+is\s+(.+)/i,
          /(?:the\s+)?correct\s+name\s+is\s+(.+)/i
        ];
        
        // Try to extract course name from correction patterns
        for (const pattern of correctionPatterns) {
          const match = courseName.match(pattern);
          if (match && match[1]) {
            courseName = match[1].trim();
            console.log('🔍 DEBUG: Extracted course name from correction pattern:', courseName);
            break;
          }
        }
        
        // Check if it's a generic term that needs clarification
        const genericTerms = [
          'my class', 'my course', 'the class', 'the course', 'class', 'course',
          'it', 'this', 'that', 'one', 'some', 'any', 'a class', 'a course'
        ];
        
        if (genericTerms.includes(courseName.toLowerCase())) {
          return {
            action: 'CREATE_ASSIGNMENT',
            missingParameters: ['courseName'],
            collectedParameters: collectedParameters,
            nextMessage: `I need to know which specific class you're referring to. Could you please tell me the name of the class? For example: "Grade Islamiat class" or "Math 101".`,
            actionComplete: false
          };
        }
        
        // Validate the course name immediately
        try {
          const courseMatch = await findMatchingCourse(
            courseName, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            return {
              action: 'CREATE_ASSIGNMENT',
              missingParameters: ['courseName'],
              collectedParameters: collectedParameters,
              nextMessage: `I couldn't find any courses matching "${courseName}". Could you please check the course name and try again?`,
              actionComplete: false
            };
          }
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            // Multiple matches - ask for clarification
            return {
              action: 'CREATE_ASSIGNMENT',
              missingParameters: ['courseName'],
              collectedParameters: collectedParameters,
              nextMessage: `I found multiple courses matching "${courseName}". Which one would you like to create an assignment for?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              actionComplete: false
            };
          }
          
          // Course found and validated - use the matched course name, not the user input
          newParameters.courseName = courseMatch.course.name;
          parametersFound = true;
        } catch (error) {
          console.error('Error validating course name:', error);
          return {
            action: 'CREATE_ASSIGNMENT',
            missingParameters: ['courseName'],
            collectedParameters: collectedParameters,
            nextMessage: `I encountered an error while looking for the course. Could you please try again?`,
            actionComplete: false
          };
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
      
      case 'AI_ASSISTED_ANNOUNCEMENT':
        // Handle AI-assisted announcement parameter collection
        if (missingParameters.includes('courseName')) {
          // User provided course name
          newParameters.courseName = originalMessage.trim();
          parametersFound = true;
        } else if (missingParameters.includes('announcementText')) {
          // User provided announcement text
          newParameters.announcementText = originalMessage.trim();
          parametersFound = true;
        } else if (missingParameters.includes('confirmation')) {
          // User confirmed the announcement
          const message = originalMessage.toLowerCase().trim();
          if (message.includes('yes') || message.includes('y') || message.includes('ok') || message.includes('sure') || message.includes('post')) {
            newParameters.confirmed = true;
            parametersFound = true;
          } else if (message.includes('no') || message.includes('n') || message.includes('change') || message.includes('edit')) {
            // User wants to change the announcement
            return {
              action: 'AI_ASSISTED_ANNOUNCEMENT',
              missingParameters: ['announcementText'],
              collectedParameters: { ...collectedParameters, courseName: collectedParameters.courseName },
              nextMessage: "No problem! What would you like the announcement to say instead?",
              actionComplete: false
            };
        }
        
        // Fallback: If AI analysis failed but the message looks like a simple course name, accept it
        if (!parametersFound && intentAnalysis.intent === 'uncertainty') {
          const simpleName = originalMessage.trim();
          if (simpleName.length > 2 && simpleName.length < 100 && isValidCourseName(simpleName)) {
            newParameters.name = simpleName;
            parametersFound = true;
            console.log('🔍 DEBUG: Fallback accepted course name:', simpleName);
          }
        }
      }
      break;
      
      case 'CREATE_ANNOUNCEMENT':
        // If we're waiting for a course name, treat the user's response as a course name
        if (missingParameters.includes('courseName')) {
          let courseName = originalMessage.trim();
          
          // Handle course name correction patterns
          const correctionPatterns = [
            /sorry\s+(?:the\s+)?course\s+name\s+is\s+(.+)/i,
            /(?:the\s+)?course\s+name\s+is\s+(.+)/i,
            /(?:it'?s|it\s+is)\s+(.+)/i,
            /(?:actually\s+)?(?:it'?s|it\s+is)\s+(.+)/i,
            /(?:correct\s+)?course\s+name\s+is\s+(.+)/i,
            /(?:the\s+)?correct\s+name\s+is\s+(.+)/i,
            /sorry\s+it\s+is\s+(.+)/i,
            /sorry\s+(.+)/i
          ];
          
          // Try to extract course name from correction patterns
          for (const pattern of correctionPatterns) {
            const match = courseName.match(pattern);
            if (match && match[1]) {
              courseName = match[1].trim();
              console.log('🔍 DEBUG: Extracted course name from correction pattern:', courseName);
              break;
            }
          }
          
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
          
          // Validate the course name immediately
          try {
            const courseMatch = await findMatchingCourse(
              courseName, 
              userToken, 
              req, 
              baseUrl
            );
            
            if (!courseMatch.success) {
              return {
                action: 'CREATE_ANNOUNCEMENT',
                missingParameters: ['courseName'],
                collectedParameters: collectedParameters,
                nextMessage: `I couldn't find any courses matching "${courseName}". Could you please check the course name and try again? You can also say "list courses" to see all available courses.`,
                actionComplete: false
              };
            }
            
            if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
              // Multiple matches - ask for clarification
              return {
                action: 'CREATE_ANNOUNCEMENT',
                missingParameters: ['courseName'],
                collectedParameters: collectedParameters,
                nextMessage: `I found multiple courses matching "${courseName}". Which one would you like to create an announcement for?`,
                options: courseMatch.allMatches.map(course => ({
                  id: course.id,
                  name: course.name,
                  section: course.section || "No section"
                })),
                actionComplete: false
              };
            }
            
            // If we have an exact match, proceed directly
            if (courseMatch.isExactMatch) {
              console.log('🔍 DEBUG: Exact match found, proceeding with course:', courseMatch.course.name);
            }
            
            // Course found and validated - use the matched course name, not the user input
            newParameters.courseName = courseMatch.course.name;
          parametersFound = true;
          } catch (error) {
            console.error('Error validating course name:', error);
            return {
              action: 'CREATE_ANNOUNCEMENT',
              missingParameters: ['courseName'],
              collectedParameters: collectedParameters,
              nextMessage: `I encountered an error while looking for the course. Could you please try again?`,
              actionComplete: false
            };
          }
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
      console.log('🔍 DEBUG: INVITE_STUDENTS parameter collection - missingParameters:', missingParameters);
      console.log('🔍 DEBUG: INVITE_STUDENTS originalMessage:', originalMessage);
      
      // Check if user provided course name
      if (missingParameters.includes('courseName')) {
        console.log('🔍 DEBUG: Looking for course name in message');
        let courseName = originalMessage.trim();
        
        // Handle course name correction patterns first
        const correctionPatterns = [
          /sorry\s+(?:it\s+is|the\s+)?(.+)/i,
          /(?:it'?s|it\s+is)\s+(.+)/i,
          /(?:actually\s+)?(?:it'?s|it\s+is)\s+(.+)/i,
          /(?:the\s+)?correct\s+(?:course\s+)?name\s+is\s+(.+)/i,
          /(?:the\s+)?course\s+name\s+is\s+(.+)/i,
          /(?:to|in)\s+(.+?)(?:\s|$)/i,
          /add\s+student\s+to\s+(.+)/i
        ];
        
        // Try to extract course name from correction patterns
        for (const pattern of correctionPatterns) {
          const match = courseName.match(pattern);
          if (match && match[1]) {
            courseName = match[1].trim();
            console.log('🔍 DEBUG: Extracted course name from correction pattern:', courseName);
            break;
          }
        }
        
        // Check if user wants to list courses
        if (courseName.toLowerCase().includes('list courses') || courseName.toLowerCase().includes('show courses')) {
          try {
            const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
            const courses = Array.isArray(coursesResponse) ? coursesResponse : (coursesResponse.courses || []);
            
            if (courses.length === 0) {
              return {
                action: 'INVITE_STUDENTS',
                missingParameters: ['courseName'],
                collectedParameters: { ...collectedParameters },
                nextMessage: "I don't see any courses available. Please create a course first or check your classroom setup.",
                actionComplete: false
              };
            }
            
            const courseList = courses.map(course => `• ${course.name}${course.section ? ` (${course.section})` : ''}`).join('\n');
            
            return {
              action: 'INVITE_STUDENTS',
              missingParameters: ['courseName'],
              collectedParameters: { ...collectedParameters },
              nextMessage: `Here are your available courses:\n\n${courseList}\n\nWhich course would you like to invite students to?`,
              actionComplete: false
            };
          } catch (error) {
            console.error('Error fetching courses:', error);
            return {
              action: 'INVITE_STUDENTS',
              missingParameters: ['courseName'],
              collectedParameters: { ...collectedParameters },
              nextMessage: "I couldn't fetch your courses. Please try again or provide the course name directly.",
              actionComplete: false
            };
          }
        }
        
        newParameters.courseName = courseName;
          parametersFound = true;
        console.log('🔍 DEBUG: Found course name:', newParameters.courseName);
      }
      
      // Check if user provided student emails
      if (missingParameters.includes('studentEmails')) {
        console.log('🔍 DEBUG: Looking for student emails in message');
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = originalMessage.match(emailRegex) || [];
        if (emails.length > 0) {
          newParameters.studentEmails = emails;
          parametersFound = true;
          console.log('🔍 DEBUG: Found student emails:', emails);
        }
      }
      
      console.log('🔍 DEBUG: INVITE_STUDENTS parameter collection result:', {
        parametersFound,
        newParameters,
        missingParameters
      });
      break;
    case 'CHECK_ASSIGNMENT_SUBMISSIONS':
      // Handle course name collection for submission status check
      if (missingParameters.includes('courseName')) {
        let courseName = originalMessage.trim();
        
        // Handle course name correction patterns
        const correctionPatterns = [
          /sorry\s+(?:the\s+)?course\s+name\s+is\s+(.+)/i,
          /(?:the\s+)?course\s+name\s+is\s+(.+)/i,
          /(?:it'?s|it\s+is)\s+(.+)/i,
          /(?:actually\s+)?(?:it'?s|it\s+is)\s+(.+)/i,
          /(?:correct\s+)?course\s+name\s+is\s+(.+)/i,
          /(?:the\s+)?correct\s+name\s+is\s+(.+)/i
        ];
        
        // Try to extract course name from correction patterns
        for (const pattern of correctionPatterns) {
          const match = courseName.match(pattern);
          if (match && match[1]) {
            courseName = match[1].trim();
            console.log('🔍 DEBUG: Extracted course name from correction pattern:', courseName);
            break;
          }
        }
        
        // Check if user wants to check all courses
        console.log('🔍 DEBUG: Checking course name for "all courses" patterns:', courseName);
        if (courseName.toLowerCase() === 'all' || 
            courseName.toLowerCase() === 'all courses' ||
            courseName.toLowerCase().includes('all courses') ||
            courseName.toLowerCase().includes('all courses created today') ||
            courseName.toLowerCase().includes('courses created today') ||
            courseName.toLowerCase().includes('show me all courses') ||
            courseName.toLowerCase().includes('just show me all courses') ||
            courseName.toLowerCase().includes('list all courses') ||
            courseName.toLowerCase().includes('show all courses')) {
          console.log('✅ DEBUG: Matched "all courses" pattern, setting checkAllCourses = true');
          newParameters.courseName = 'all';
          newParameters.checkAllCourses = true;
          parametersFound = true;
          
          // Return early to avoid course matching logic
          return {
            action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
            missingParameters: [],
            collectedParameters: { ...collectedParameters, ...newParameters },
            allParameters: { ...collectedParameters, ...newParameters },
            nextMessage: "I'll check all courses for today's assignments.",
            actionComplete: true
          };
        }
        // Check if user wants to check recent assignments across all courses
        else if (courseName.toLowerCase().includes('check recent assignments') || courseName.toLowerCase().includes('recent assignments')) {
          newParameters.courseName = 'all';
          newParameters.checkAllCourses = true;
          newParameters.checkRecentAssignments = true;
          parametersFound = true;
          
          // Return early to avoid course matching logic
          return {
            action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
            missingParameters: [],
            collectedParameters: { ...collectedParameters, ...newParameters },
            allParameters: { ...collectedParameters, ...newParameters },
            nextMessage: "I'll check recent assignments across all courses.",
            actionComplete: true
          };
        }
        // Check if user wants to cancel (common responses after "couldn't find courses")
        console.log('🔍 DEBUG: Checking for cancellation patterns:', courseName);
        if (courseName.toLowerCase() === 'ok' || courseName.toLowerCase() === 'cancel' || 
                 courseName.toLowerCase() === 'stop' || courseName.toLowerCase() === 'never mind' ||
                 courseName.toLowerCase() === 'forget it' || courseName.toLowerCase() === 'done' ||
                 courseName.toLowerCase().includes('cancel') || courseName.toLowerCase().includes('stop') ||
                 courseName.toLowerCase().includes('never mind') || courseName.toLowerCase().includes('forget it') ||
                 courseName.toLowerCase().includes('cancel this action') || courseName.toLowerCase().includes('cancel action')) {
          console.log('✅ DEBUG: Matched cancellation pattern, cancelling action');
          return {
            action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
            missingParameters: [],
            collectedParameters: { ...collectedParameters },
            nextMessage: "Okay, I've cancelled the submission status check. Is there anything else I can help you with?",
            actionComplete: true
          };
        }
        // Check if user wants to list courses
        else if (courseName.toLowerCase().includes('list courses') || courseName.toLowerCase().includes('show courses')) {
          try {
            const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
            const courses = Array.isArray(coursesResponse) ? coursesResponse : (coursesResponse.courses || []);
            
            if (courses.length === 0) {
              return {
                action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                missingParameters: ['courseName'],
                collectedParameters: { ...collectedParameters },
                nextMessage: "I don't see any courses available. Please create a course first or check your classroom setup.",
                actionComplete: false
              };
            }
            
            const courseList = courses.map(course => `• ${course.name}${course.section ? ` (${course.section})` : ''}`).join('\n');
            
            return {
              action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
              missingParameters: ['courseName'],
              collectedParameters: { ...collectedParameters },
              nextMessage: `Here are your available courses:\n\n${courseList}\n\nWhich course would you like to check submission status for?`,
              actionComplete: false
            };
          } catch (error) {
            console.error('Error fetching courses for submission status:', error);
            return {
              action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
              missingParameters: ['courseName'],
              collectedParameters: { ...collectedParameters },
              nextMessage: "I couldn't fetch your courses. Please try again or specify the course name directly.",
              actionComplete: false
            };
          }
        }
        
        // Try to find matching course
        try {
          const courseMatch = await findMatchingCourse(courseName, userToken, req, baseUrl);
          if (!courseMatch.success) {
            return {
              action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
              missingParameters: ['courseName'],
              collectedParameters: { ...collectedParameters },
                nextMessage: `${courseMatch.message}\n\nWould you like to:\n• Try a different course name\n• List all available courses\n• Cancel this action\n\nPlease let me know what you'd like to do.`,
              actionComplete: false
            };
          }
          
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
            const courseOptions = courseMatch.allMatches.map(course => `• ${course.name}${course.section ? ` (${course.section})` : ''}`).join('\n');
            return {
              action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
              missingParameters: ['courseName'],
              collectedParameters: { ...collectedParameters },
              nextMessage: `I found multiple courses matching "${courseName}". Which one do you mean?\n\n${courseOptions}`,
              actionComplete: false
            };
          }
          
          // Course found and validated - use the matched course name, not the user input
          newParameters.courseName = courseMatch.course.name;
          parametersFound = true;
        } catch (error) {
          console.error('Error in course matching for submission status:', error);
          return {
            action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
            missingParameters: ['courseName'],
            collectedParameters: { ...collectedParameters },
            nextMessage: "I encountered an error while looking up the course. Please try again.",
            actionComplete: false
          };
        }
      }
      
      // Handle assignment title collection for submission status check
      if (missingParameters.includes('assignmentTitle')) {
        const assignmentTitle = originalMessage.trim();
        
        // For "today's assignment", we don't need a specific title
        if (collectedParameters.isTodaysAssignment) {
          newParameters.assignmentTitle = 'today\'s assignment';
          parametersFound = true;
        } else {
          // User provided a specific assignment title
          newParameters.assignmentTitle = assignmentTitle;
          parametersFound = true;
        }
      }
      
      // Handle assignment selection when multiple assignments are found
      if (missingParameters.includes('assignmentSelection')) {
        console.log('🔍 DEBUG: Processing assignmentSelection parameter');
        console.log('🔍 DEBUG: Original message:', originalMessage);
        console.log('🔍 DEBUG: Available assignments:', collectedParameters.availableAssignments);
        
        const selection = originalMessage.trim().toLowerCase();
        const availableAssignments = collectedParameters.availableAssignments || [];
        
        console.log('🔍 DEBUG: Selection:', selection);
        console.log('🔍 DEBUG: Available assignments count:', availableAssignments.length);
        
        // Handle positive responses like "yes", "ok", "sure" when there's only one assignment
        if (availableAssignments.length === 1 && (selection === 'yes' || selection === 'ok' || selection === 'sure' || selection === 'y')) {
          console.log('🔍 DEBUG: User confirmed single assignment selection');
          newParameters.selectedAssignments = availableAssignments;
          newParameters.assignmentTitle = availableAssignments[0].title;
          parametersFound = true;
        } else if (selection === 'all') {
          // User wants to check all assignments
          console.log('🔍 DEBUG: User selected "all"');
          newParameters.selectedAssignments = availableAssignments;
          newParameters.assignmentTitle = 'all assignments created today';
          parametersFound = true;
        } else {
          // Try to match by number or title
          let selectedAssignment = null;
          
          // Check if it's a number (1, 2, 3, etc.)
          const numberMatch = selection.match(/^(\d+)$/);
          if (numberMatch) {
            const index = parseInt(numberMatch[1]) - 1;
            console.log('🔍 DEBUG: Number match, index:', index);
            if (index >= 0 && index < availableAssignments.length) {
              selectedAssignment = availableAssignments[index];
              console.log('🔍 DEBUG: Selected assignment by number:', selectedAssignment.title);
            }
          } else {
            // Try to match by title
            selectedAssignment = availableAssignments.find(a => 
              a.title.toLowerCase().includes(selection)
            );
            console.log('🔍 DEBUG: Title match result:', selectedAssignment ? selectedAssignment.title : 'No match');
          }
          
          if (selectedAssignment) {
            newParameters.selectedAssignments = [selectedAssignment];
            newParameters.assignmentTitle = selectedAssignment.title;
            parametersFound = true;
            console.log('🔍 DEBUG: Assignment selection successful');
          } else {
            console.log('🔍 DEBUG: No assignment found for selection:', selection);
            return {
              action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
              missingParameters: ['assignmentSelection'],
              collectedParameters: { ...collectedParameters },
              nextMessage: `I couldn't find an assignment matching "${originalMessage}". Please try again with a number (1-${availableAssignments.length}), part of the title, or "all".`,
              actionComplete: false
            };
          }
        }
      }
      
      console.log('🔍 DEBUG: CHECK_ASSIGNMENT_SUBMISSIONS parameter collection result:', {
        parametersFound,
        newParameters,
        missingParameters
      });
      break;
    case 'CHECK_UNSUBMITTED_ASSIGNMENTS':
      console.log('🔍 DEBUG: CHECK_UNSUBMITTED_ASSIGNMENTS parameter collection - missingParameters:', missingParameters);
      console.log('🔍 DEBUG: CHECK_UNSUBMITTED_ASSIGNMENTS collectedParameters:', collectedParameters);
      console.log('🔍 DEBUG: CHECK_UNSUBMITTED_ASSIGNMENTS originalMessage:', originalMessage);
      
      // Handle course name collection for unsubmitted assignments check
      if (missingParameters.includes('courseName')) {
        let courseName = originalMessage.trim();
        
        // Handle course name correction patterns
        const correctionPatterns = [
          /sorry\s+it\s+is\s+(.+)/i,
          /it\s+is\s+(.+)/i,
          /it's\s+(.+)/i,
          /the\s+course\s+name\s+is\s+(.+)/i,
          /course\s+name\s+is\s+(.+)/i,
          /it\s+should\s+be\s+(.+)/i,
          /correct\s+to\s+(.+)/i,
          /change\s+to\s+(.+)/i,
          /update\s+to\s+(.+)/i,
          /make\s+it\s+(.+)/i,
          /use\s+(.+)/i,
          /try\s+(.+)/i
        ];
        
        for (const pattern of correctionPatterns) {
          const match = courseName.match(pattern);
          if (match && match[1]) {
            courseName = match[1].trim();
            console.log('🔍 DEBUG: Extracted course name from correction pattern:', courseName);
            break;
          }
        }
        
        // Check if user wants to check all courses
        console.log('🔍 DEBUG: Checking course name for "all courses" patterns:', courseName);
        if (courseName.toLowerCase() === 'all' || 
            courseName.toLowerCase() === 'all courses' ||
            courseName.toLowerCase().includes('all courses') ||
            courseName.toLowerCase().includes('all courses created today') ||
            courseName.toLowerCase().includes('courses created today') ||
            courseName.toLowerCase().includes('show me all courses') ||
            courseName.toLowerCase().includes('just show me all courses') ||
            courseName.toLowerCase().includes('list all courses') ||
            courseName.toLowerCase().includes('show all courses')) {
          console.log('✅ DEBUG: Matched "all courses" pattern, setting checkAllCourses = true');
          newParameters.courseName = 'all';
          newParameters.checkAllCourses = true;
          parametersFound = true;
          
          // Return early to avoid course matching logic
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: [],
            collectedParameters: { ...collectedParameters, ...newParameters },
            allParameters: { ...collectedParameters, ...newParameters },
            nextMessage: "I'll check unsubmitted assignments for all courses with today's assignments.",
            actionComplete: true
          };
        }
        
        // Check if user wants to check recent assignments across all courses
        if (courseName.toLowerCase().includes('recent assignments') || 
            courseName.toLowerCase().includes('check recent') ||
            courseName.toLowerCase().includes('recent')) {
          console.log('✅ DEBUG: Matched "recent assignments" pattern');
          newParameters.courseName = 'all';
          newParameters.checkAllCourses = true;
          parametersFound = true;
          
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: [],
            collectedParameters: { ...collectedParameters, ...newParameters },
            allParameters: { ...collectedParameters, ...newParameters },
            nextMessage: "I'll check recent assignments across all courses.",
            actionComplete: true
          };
        }
        
        // Check if user wants to cancel (common responses after "couldn't find courses")
        console.log('🔍 DEBUG: Checking for cancellation patterns:', courseName);
        if (courseName.toLowerCase() === 'ok' || courseName.toLowerCase() === 'cancel' || 
            courseName.toLowerCase() === 'stop' || courseName.toLowerCase() === 'never mind' ||
            courseName.toLowerCase() === 'forget it' || courseName.toLowerCase() === 'done' ||
            courseName.toLowerCase().includes('cancel') || courseName.toLowerCase().includes('stop') ||
            courseName.toLowerCase().includes('never mind') || courseName.toLowerCase().includes('forget it') ||
            courseName.toLowerCase().includes('cancel this action') || courseName.toLowerCase().includes('cancel action')) {
          console.log('✅ DEBUG: Matched cancellation pattern, cancelling action');
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: [],
            collectedParameters: { ...collectedParameters },
            nextMessage: "Okay, I've cancelled the unsubmitted assignments check. Is there anything else I can help you with?",
            actionComplete: true
          };
        }
        
        // Check if this might be an assignment title response that got misrouted
        if (courseName.toLowerCase() === 'all' || 
            courseName.toLowerCase() === 'all assignments' ||
            courseName.toLowerCase().includes('all assignments')) {
          console.log('🔍 DEBUG: Detected "all" in course name collection - might be misrouted assignment title');
          // This should not happen if the flow is correct, but let's handle it
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: ['assignmentTitle'],
            collectedParameters: { ...collectedParameters },
            nextMessage: "It looks like you want to check all assignments. Which assignment would you like to check for unsubmitted students?",
            actionComplete: false
          };
        }
        
        // Try to find matching course
        const courseMatch = await findMatchingCourse(courseName, userToken, req, baseUrl);
        
        if (!courseMatch.success) {
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: ['courseName'],
            collectedParameters: { ...collectedParameters },
            nextMessage: `${courseMatch.message}\n\nWould you like to:\n• Try a different course name\n• List all available courses\n• Cancel this action\n\nPlease let me know what you'd like to do.`,
            actionComplete: false
          };
        }
        
        // Handle multiple course matches
        if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
          const courseOptions = courseMatch.allMatches.map(course => `• ${course.name}${course.section ? ` (${course.section})` : ''}`).join('\n');
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: ['courseName'],
            collectedParameters: { ...collectedParameters },
            nextMessage: `I found multiple courses matching "${courseName}". Which one do you mean?\n\n${courseOptions}`,
            actionComplete: false
          };
        }
        
        // Course found successfully
        newParameters.courseName = courseMatch.course.name;
        newParameters.courseIdentifier = courseMatch.course.id;
        parametersFound = true;
        
        // Update the ongoing action to track assignment title collection
        updateOngoingActionParameters(conversationId, newParameters);
        
        // Update the ongoing action context to require assignment title instead of course name
        const conversation = getConversation(conversationId);
        if (conversation && conversation.context.ongoingAction === 'CHECK_UNSUBMITTED_ASSIGNMENTS') {
          conversation.context.requiredParameters = ['assignmentTitle'];
          conversation.context.missingParameters = ['assignmentTitle'];
          console.log('🔍 DEBUG: Updated ongoing action to require assignmentTitle instead of courseName');
        }
        
        // If this is for today's assignment, we can complete the action
        if (collectedParameters.isTodaysAssignment) {
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: [],
            collectedParameters: { ...collectedParameters, ...newParameters },
            allParameters: { ...collectedParameters, ...newParameters },
            nextMessage: `Great! I found the course "${courseMatch.course.name}". Now I'll check for unsubmitted assignments from today.`,
            actionComplete: true
          };
        } else {
          // Ask for assignment title
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: ['assignmentTitle'],
            collectedParameters: { ...collectedParameters, ...newParameters },
            nextMessage: `Great! I found the course "${courseMatch.course.name}". Which assignment would you like to check for unsubmitted students?`,
            actionComplete: false
          };
        }
      }
      
      // Handle assignment title collection
      if (missingParameters.includes('assignmentTitle')) {
        console.log('🔍 DEBUG: Processing assignment title collection for CHECK_UNSUBMITTED_ASSIGNMENTS');
        console.log('🔍 DEBUG: originalMessage for assignment title:', originalMessage);
        console.log('🔍 DEBUG: missingParameters:', missingParameters);
        console.log('🔍 DEBUG: collectedParameters:', collectedParameters);
        let assignmentTitle = originalMessage.trim();
        
        // Handle assignment title correction patterns
        const correctionPatterns = [
          /sorry\s+it\s+is\s+(.+)/i,
          /it\s+is\s+(.+)/i,
          /it's\s+(.+)/i,
          /the\s+assignment\s+title\s+is\s+(.+)/i,
          /assignment\s+title\s+is\s+(.+)/i,
          /it\s+should\s+be\s+(.+)/i,
          /correct\s+to\s+(.+)/i,
          /change\s+to\s+(.+)/i,
          /update\s+to\s+(.+)/i,
          /make\s+it\s+(.+)/i,
          /use\s+(.+)/i,
          /try\s+(.+)/i
        ];
        
        for (const pattern of correctionPatterns) {
          const match = assignmentTitle.match(pattern);
          if (match && match[1]) {
            assignmentTitle = match[1].trim();
            console.log('🔍 DEBUG: Extracted assignment title from correction pattern:', assignmentTitle);
            break;
          }
        }
        
        // Check if user wants to cancel
        if (assignmentTitle.toLowerCase() === 'cancel' || 
            assignmentTitle.toLowerCase() === 'stop' || 
            assignmentTitle.toLowerCase() === 'never mind' ||
            assignmentTitle.toLowerCase() === 'forget it' ||
            assignmentTitle.toLowerCase() === 'done') {
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: [],
            collectedParameters: { ...collectedParameters },
            nextMessage: "Okay, I've cancelled the unsubmitted assignments check. Is there anything else I can help you with?",
            actionComplete: true
          };
        }
        
        // Check if user wants to check all assignments
        console.log('🔍 DEBUG: Checking if assignment title is "all" or similar:', assignmentTitle);
        if (assignmentTitle.toLowerCase() === 'all' || 
            assignmentTitle.toLowerCase() === 'all assignments' ||
            assignmentTitle.toLowerCase().includes('all assignments') ||
            assignmentTitle.toLowerCase() === 'all of them' ||
            assignmentTitle.toLowerCase().includes('every assignment') ||
            assignmentTitle.toLowerCase().includes('everyone') ||
            assignmentTitle.toLowerCase().includes('all students')) {
          console.log('✅ DEBUG: Matched "all assignments" pattern, setting assignmentTitle = "all"');
          newParameters.assignmentTitle = 'all';
          parametersFound = true;
          
          return {
            action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
            missingParameters: [],
            collectedParameters: { ...collectedParameters, ...newParameters },
            allParameters: { ...collectedParameters, ...newParameters },
            nextMessage: "I'll check unsubmitted students for all assignments in the course.",
            actionComplete: true
          };
        }
        
        // Assignment title provided
        newParameters.assignmentTitle = assignmentTitle;
        parametersFound = true;
        
        return {
          action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
          missingParameters: [],
          collectedParameters: { ...collectedParameters, ...newParameters },
          allParameters: { ...collectedParameters, ...newParameters },
          nextMessage: `Perfect! I'll check for unsubmitted students for "${assignmentTitle}" in ${collectedParameters.courseName}.`,
          actionComplete: true
        };
      }
      
      console.log('🔍 DEBUG: CHECK_UNSUBMITTED_ASSIGNMENTS parameter collection result:', {
        parametersFound,
        newParameters,
        missingParameters
      });
      break;
  }
  
  if (parametersFound) {
    // Update the ongoing action with new parameters
    updateOngoingActionParameters(conversationId, newParameters);
    
    // Special handling for assignmentSelection - once processed, remove it from required parameters
    if (newParameters.selectedAssignments && newParameters.assignmentTitle) {
      // Remove assignmentSelection from required parameters since we've processed it
      const conversation = getConversation(conversationId);
      if (conversation && conversation.context.ongoingAction === 'CHECK_ASSIGNMENT_SUBMISSIONS') {
        conversation.context.requiredParameters = conversation.context.requiredParameters.filter(
          param => param !== 'assignmentSelection'
        );
        console.log('🔍 Removed assignmentSelection from required parameters');
      }
    }
    
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
    // Get all courses from database
    let coursesResponse = await makeApiCall(`${baseUrl}/api/courses`, 'GET', null, userToken, req);
    
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
            
            // Respect user role when listing courses (same logic as classroom.controller.js)
            let listOptions = { pageSize: 30 };
            
            if (user.role === 'student') {
              // For students: fetch courses they're enrolled in
              listOptions.studentId = 'me';
            } else if (user.role === 'teacher') {
              // For teachers: fetch courses they're teaching
              listOptions.teacherId = 'me';
            }
            // For super_admin and other roles: fetch all courses (no filter)
            
            console.log('DEBUG: Listing courses with options:', listOptions, 'for role:', user.role);
            const result = await classroom.courses.list(listOptions);
            
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
            
            // Try to update to ACTIVE state, but don't fail if it's not allowed
            if (result.data.id) {
              try {
              await classroom.courses.patch({
                id: result.data.id,
                updateMask: 'courseState',
                requestBody: {
                  courseState: 'ACTIVE'
                }
              });
              console.log('DEBUG: Course state updated to ACTIVE');
              } catch (stateError) {
                console.log('DEBUG: Could not transition course to ACTIVE state (this is normal for some users):', stateError.message);
                // Don't fail the entire operation - the course was created successfully
              }
            }
            
            console.log('DEBUG: Internal createCourse call successful');
            return result.data;
            
          } else if (method === 'POST' && endpoint.includes('/announcements')) {
          // For createAnnouncement, use our database system
            const courseId = endpoint.split('/')[1]; // Extract courseId from /{courseId}/announcements
          console.log('DEBUG: Creating announcement with new database system for courseId:', courseId);
            
            // Validate required fields
          if (!data.content && !data.text) {
            throw new Error('Announcement content is required');
            }
            
            const announcementData = {
            courseId: courseId,
            teacherId: req.user.id,
            title: data.title || null,
            content: data.content || data.text
            };
            
            console.log('DEBUG: Creating announcement with data:', announcementData);
            
          // Use the announcement service
          const announcementService = require('../../services/announcementService');
          const result = await announcementService.createAnnouncement(announcementData);
          
          console.log('DEBUG: Announcement created successfully:', result);
          return result;
            
          } else if (method === 'GET' && endpoint.includes('/announcements')) {
          // For getAnnouncements, use our database system
          console.log('DEBUG: Getting announcements with new database system');
          
            const courseId = endpoint.split('/')[1]; // Extract courseId from /{courseId}/announcements
          
          // Use the announcement model
          const announcementModel = require('../../models/announcement.model');
          const announcements = await announcementModel.getAnnouncementsByCourse(courseId);
          
          console.log('DEBUG: Announcements retrieved successfully:', announcements.length);
          return announcements;
            
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
            
          } else if (method === 'POST' && /^\/[A-Za-z0-9_-]+\/invite-teachers$/.test(endpoint)) {
            // Internal handling for inviting teachers to a course
            // Endpoint format: /:courseId/invite-teachers
            const parts = endpoint.split('/');
            const courseId = parts[1];
            const emails = (data && Array.isArray(data.emails)) ? data.emails : [];

            if (!courseId) {
              throw new Error('Missing courseId in path');
            }
            if (!emails.length) {
              throw new Error('At least one teacher email is required');
            }

            const user = await getUserByEmail(req.user.email);
            if (!user.access_token || !user.refresh_token) {
              throw new Error('Missing required OAuth2 tokens');
            }

            const { getClassroomClient } = require('../../integrations/google.classroom');
            const classroom = getClassroomClient({
              access_token: user.access_token,
              refresh_token: user.refresh_token
            });

            // Create invitations for all teachers
            const invitationPromises = emails.map(email => classroom.invitations.create({
              requestBody: {
                courseId: courseId,
                userId: email,
                role: 'TEACHER'
              }
            }));

            const results = await Promise.all(invitationPromises);
            return {
              message: `Successfully invited ${emails.length} teacher(s)`,
              invitations: results.map(r => r.data)
            };
            
    } else {
            console.log('DEBUG: Unsupported internal endpoint, falling back to external call');
            // Fall through to external call
          }
        } catch (internalErr) {
          console.log('DEBUG: Internal call failed, falling back to external call:', internalErr.message);
          // Fall through to external call
        }
      }
    }
    
    // External HTTP call fallback
    try {
      // Normalize to HTTPS to avoid redirects changing POST to GET
      const safeUrl = url.replace('http://class.xytek.ai', 'https://class.xytek.ai');
    console.log('DEBUG: Making external HTTP API call');
    
      const axios = require('axios');
      
      // Check if this is an OpenAI API call and format the auth header correctly
      const isOpenAICall = safeUrl.includes('api.openai.com');
      const authHeader = isOpenAICall && userToken && !userToken.startsWith('Bearer ')
        ? `Bearer ${userToken}`
        : userToken;
      
    const config = {
        method: method,
        url: safeUrl,
      headers: {
          Authorization: authHeader,
        'Content-Type': 'application/json'
        },
        data: data || undefined,
        maxRedirects: 0
    };
    console.log('DEBUG: Making API call with config:', {
        method: config.method,
        url: config.url,
      hasData: !!config.data,
        headers: {
          Authorization: authHeader ? (authHeader.length > 20 ? authHeader.substring(0, 20) + '...' : authHeader) : 'none',
          'Content-Type': config.headers['Content-Type']
        }
    });
    
    const response = await axios(config);
    return response.data;
    } catch (httpErr) {
      console.log('DEBUG: API call failed:', httpErr.message);
      if (httpErr.response) {
        console.log('DEBUG: Error response status:', httpErr.response.status);
        console.log('DEBUG: Error response data:', httpErr.response.data);
      }
      throw httpErr;
    }
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

    // 🔍 PRIORITY CHECK: If there's an ongoing action, force parameter collection first
    const context = getOngoingActionContext(conversationId);
    console.log('🔍 DEBUG: Checking for ongoing action context:', context);
    
    // ✅ CORRECTION DETECTION: If this is a correction, skip parameter collection and use corrected params
    if (intentData.isCorrection) {
      console.log('✅ DEBUG: This is a CORRECTION - using corrected parameters directly');
      console.log('✅ DEBUG: Corrected parameters:', intentData.parameters);
      
      // Clear the ongoing action since we have the corrected info
      if (conversationId) {
        completeOngoingAction(conversationId);
      }
      
      // Use the corrected parameters directly
      intent = intentData.intent;
      parameters = intentData.parameters;
      
      console.log('✅ DEBUG: Skipping parameter collection, proceeding with corrected data');
    } else if (context) {
      console.log('🔍 DEBUG: Found ongoing action, forcing parameter collection');
      console.log('🔍 DEBUG: Ongoing action context:', context);
      console.log('🔍 DEBUG: Missing parameters:', context.missingParameters);
      console.log('🔍 DEBUG: Collected parameters:', context.collectedParameters);
      
      // Check if this message provides parameters for the ongoing action
      const parameterCollection = await handleParameterCollection(context.action, context.collectedParameters, conversationId, originalMessage, userToken, req, baseUrl);
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
      } else {
        // No parameters found in this message, but we have an ongoing action
        // Check if this is a new action attempt
        const newActionCheck = checkForNewActionAttempt(intent, conversationId);
        if (newActionCheck && newActionCheck.shouldBlock) {
          return {
            message: newActionCheck.message,
            conversationId: conversationId,
            ongoingAction: newActionCheck.ongoingAction
          };
        }
        
        // Check if user wants to cancel the ongoing action
        if (intent === 'CANCEL_ACTION' || originalMessage.toLowerCase().trim() === 'stop' || originalMessage.toLowerCase().trim() === 'cancel') {
          console.log('🔍 DEBUG: User wants to cancel ongoing action');
          completeOngoingAction(conversationId);
          return {
            message: `Got it! I've stopped working on ${context.action.toLowerCase().replace(/_/g, ' ')}. What would you like to do instead?`,
            conversationId: conversationId
          };
        }

        // Special handling for AI_ASSISTED_ANNOUNCEMENT flow
        if (context.action === 'AI_ASSISTED_ANNOUNCEMENT') {
          console.log('🔍 DEBUG: Handling AI_ASSISTED_ANNOUNCEMENT parameter collection');
          
          // Check if we have course name but need announcement text
          if (context.collectedParameters.courseName && context.missingParameters.includes('announcementText')) {
            // Generate AI-assisted announcement suggestions
            const suggestions = [
              "Welcome to class! Today we'll be covering [topic]. Please bring your [materials].",
              "Reminder: [assignment] is due [date]. Don't forget to submit it on time!",
              "Great work everyone! I'm proud of your progress in [subject].",
              "Class update: [information]. Let me know if you have any questions.",
              "Exciting news: [announcement]. Looking forward to sharing more details soon!"
            ];
            
            const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
            
            return {
              message: `Perfect! Now let's create your announcement for "${context.collectedParameters.courseName}".\n\nI can help you craft a professional announcement. Here's a suggestion:\n\n"${randomSuggestion}"\n\nWould you like to use this, modify it, or write your own?`,
              conversationId: conversationId,
              ongoingAction: {
                action: 'AI_ASSISTED_ANNOUNCEMENT',
                missingParameters: ['announcementText'],
                collectedParameters: context.collectedParameters
              }
            };
          }
          
          // Check if we have both course name and announcement text, need confirmation
          if (context.collectedParameters.courseName && context.collectedParameters.announcementText && context.missingParameters.includes('confirmation')) {
            return {
              message: `Here's your announcement preview:\n\n**Course:** ${context.collectedParameters.courseName}\n**Announcement:** "${context.collectedParameters.announcementText}"\n\nDoes this look good? Say "yes" to post it, or "no" to make changes.`,
              conversationId: conversationId,
              ongoingAction: {
                action: 'AI_ASSISTED_ANNOUNCEMENT',
                missingParameters: ['confirmation'],
                collectedParameters: context.collectedParameters
              }
            };
          }
        }
        
        // If it's not a new action attempt, check if the action is actually complete
        if (context.missingParameters && context.missingParameters.length === 0) {
          console.log('🔍 DEBUG: Action appears complete but not executed, forcing execution');
          // Action is complete, execute it
          const allParameters = context.collectedParameters;
          console.log('🔍 DEBUG: Executing completed action with parameters:', allParameters);
          
          // Update the intent data with the complete parameters
          intentData.intent = context.action;
          intentData.parameters = allParameters;
          intent = context.action;
          parameters = allParameters;
          
          console.log(`🔄 Forced execution of ${context.action}`);
          // Continue with normal execution below
        } else {
          // Still missing parameters, ask for them
          const contextMessage = getContextAwareMessage(conversationId);
          return {
            message: `I'm still waiting for information to complete the current action. ${contextMessage}`,
            conversationId: conversationId,
            ongoingAction: context
          };
        }
      }
    } else {
      // No ongoing action, check if this is a new action attempt (shouldn't happen, but safety check)
      const newActionCheck = checkForNewActionAttempt(intent, conversationId);
      if (newActionCheck && newActionCheck.shouldBlock) {
        return {
          message: newActionCheck.message,
          conversationId: conversationId,
          ongoingAction: newActionCheck.ongoingAction
        };
      }
    }

    // 🔍 ADDITIONAL CHECK: Handle confirmation responses for ongoing actions
    const context2 = getOngoingActionContext(conversationId);
    if (context2 && context2.missingParameters && context2.missingParameters.includes('confirmed')) {
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
      case 'PARAMETER_COLLECTION': {
        // This is a dummy intent used when there's an ongoing action
        // The actual parameter collection is handled above in the ongoing action check
        // This case should never be reached, but adding it for safety
        return {
          message: "I'm still working on something else. Please provide the information I asked for.",
          conversationId: conversationId
        };
      }
      
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
        try {
          // Use the course service to get courses from Neon DB
          const courseService = require('../courseService');
          const result = await courseService.getCourses(req.user.id, userRole);
          
          if (result.courses.length === 0) {
            const noCoursesMessage = userRole === 'teacher' 
              ? "You haven't created any courses yet. Would you like to create one?"
              : "You're not enrolled in any courses yet. Please contact your teacher to get enrolled.";
            
            return {
              message: noCoursesMessage,
              courses: [],
              conversationId: conversationId
            };
          }
          
          // Format the courses list
          const coursesList = result.courses.map((course, index) => {
            const studentCount = course.student_count || 0;
            
            // Different formatting based on user role
            if (userRole === 'student') {
              // Students only see course name and teacher
              return `${index + 1}. **${course.name}**${course.section ? ` (Section: ${course.section})` : ''}${course.teacher_name ? `\n   👨‍🏫 Teacher: ${course.teacher_name}` : ''}`;
            } else {
              // Teachers and admins see student count
              return `${index + 1}. **${course.name}**${course.section ? ` (Section: ${course.section})` : ''}\n   👥 ${studentCount} student${studentCount !== 1 ? 's' : ''}${course.teacher_name ? `\n   👨‍🏫 Teacher: ${course.teacher_name}` : ''}`;
            }
          }).join('\n\n');
          
          const roleMessage = userRole === 'teacher' 
            ? 'Here are your courses:'
            : 'Here are your enrolled courses:';
          
          return {
            message: `📚 ${roleMessage}\n\n${coursesList}\n\nTotal: ${result.count} course${result.count !== 1 ? 's' : ''}`,
            courses: result.courses,
            conversationId: conversationId
          };
        } catch (error) {
          console.error('Error in LIST_COURSES:', error);
          return {
            message: 'Sorry, I encountered an error while trying to get your courses. Please try again.',
            error: error.message,
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

        // Normalize courseName to name if provided
        if (parameters.courseName && !parameters.name) {
          parameters.name = parameters.courseName;
          console.log('🔍 DEBUG: Normalized courseName to name:', parameters.name);
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

        // If we have both name and confirmed, proceed with course creation
        if (parameters.name && parameters.confirmed) {
          // Clear the ongoing action before proceeding
          completeOngoingAction(conversationId);
        }

        const courseData = {
          name: parameters.name,
          description: parameters.description || '',
          section: parameters.section || '',
          room: parameters.room || ''
        };

        console.log('DEBUG: CREATE_COURSE - Creating course in Neon DB');
        console.log('DEBUG: CREATE_COURSE - courseData:', courseData);
        console.log('DEBUG: CREATE_COURSE - User ID:', req.user.id);

        try {
          // Use the course service to create course in Neon DB
          const courseService = require('../courseService');
          const result = await courseService.createCourse({
            name: courseData.name,
            description: courseData.description,
            section: courseData.section,
            room: courseData.room,
            teacherId: req.user.id
          });

          console.log('DEBUG: CREATE_COURSE - Course created successfully:', result);

          // ✅ COMPLETE ACTION: Mark the ongoing action as completed
          if (conversationId) {
            completeOngoingAction(conversationId);
          }

          return {
            message: `Great! I've successfully created your course "${parameters.name}". Your course is now live and ready for students to join. You can start enrolling students, creating assignments, and managing your course content right away.`,
            course: result.course,
            conversationId: conversationId
          };
        } catch (error) {
          console.error('Error in CREATE_COURSE:', error);
          
          // ✅ COMPLETE ACTION: Mark the ongoing action as completed even on error
          if (conversationId) {
            completeOngoingAction(conversationId);
          }
          
          return {
            message: `I'm sorry, but I couldn't create the course: ${error.message}. Please try again.`,
            error: error.message,
            conversationId: conversationId
          };
        }
      }
        
      case 'LIST_PENDING_ASSIGNMENTS': {
        // Only students can view their pending assignments
        if (userRole !== 'student') {
          return {
            message: 'Only students can view their pending assignments. Please contact your administrator.',
            conversationId: req.body.conversationId || generateConversationId()
          };
        }

        try {
          // Get all courses for the student
          const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
          const courses = Array.isArray(coursesResponse) ? coursesResponse : (coursesResponse.courses || []);

          if (courses.length === 0) {
            return {
              message: "You're not enrolled in any courses yet.",
              conversationId: req.body.conversationId || generateConversationId()
            };
          }

          // Get assignments from all courses
          const allAssignments = [];
          const now = new Date();

          for (const course of courses) {
            try {
              const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments`, 'GET', null, userToken, req);
              const assignments = Array.isArray(assignmentsResponse) ? assignmentsResponse : [];

              // Filter for pending assignments (not yet due or no due date)
              const pendingAssignments = assignments.filter(assignment => {
                // If no due date, consider it pending (student hasn't submitted yet)
                if (!assignment.dueDate) return true;
                
                // If has due date, check if it's in the future
                const dueDate = new Date(assignment.dueDate.year, assignment.dueDate.month - 1, assignment.dueDate.day);
                if (assignment.dueTime) {
                  dueDate.setHours(assignment.dueTime.hours || 23, assignment.dueTime.minutes || 59, 0, 0);
                } else {
                  dueDate.setHours(23, 59, 59, 999); // End of day if no time specified
                }
                
                return dueDate > now; // Only future assignments
              });

              // Add course name to each assignment
              pendingAssignments.forEach(assignment => {
                assignment.courseName = course.name;
                assignment.courseId = course.id;
              });

              allAssignments.push(...pendingAssignments);
            } catch (error) {
              console.error(`Error fetching assignments for course ${course.name}:`, error);
              // Continue with other courses even if one fails
            }
          }

          // Sort by due date (earliest first), assignments without due dates go to the end
          allAssignments.sort((a, b) => {
            // If both have due dates, sort by date
            if (a.dueDate && b.dueDate) {
              const dateA = new Date(a.dueDate.year, a.dueDate.month - 1, a.dueDate.day);
              const dateB = new Date(b.dueDate.year, b.dueDate.month - 1, b.dueDate.day);
              return dateA - dateB;
            }
            // If only a has due date, a comes first
            if (a.dueDate && !b.dueDate) return -1;
            // If only b has due date, b comes first
            if (!a.dueDate && b.dueDate) return 1;
            // If neither has due date, sort by title
            return a.title.localeCompare(b.title);
          });

          if (allAssignments.length === 0) {
            return {
              message: "🎉 Great news! You have no pending assignments at the moment.",
              conversationId: req.body.conversationId || generateConversationId()
            };
          }

          // Format the response
          let message = `📚 **Your Pending Assignments (${allAssignments.length}):**\n\n`;
          
          allAssignments.forEach((assignment, index) => {
            message += `${index + 1}. **${assignment.title}**\n`;
            message += `   📚 Course: ${assignment.courseName}\n`;
            
            if (assignment.dueDate) {
              const dueDate = new Date(assignment.dueDate.year, assignment.dueDate.month - 1, assignment.dueDate.day);
              const dueDateStr = dueDate.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });
              
              const dueTimeStr = assignment.dueTime ? 
                ` at ${assignment.dueTime.hours.toString().padStart(2, '0')}:${(assignment.dueTime.minutes || 0).toString().padStart(2, '0')}` : 
                '';
              
              message += `   📅 Due: ${dueDateStr}${dueTimeStr}\n`;
            } else {
              message += `   📅 Due: No due date set\n`;
            }
            
            message += `   📊 Points: ${assignment.maxPoints || 'N/A'}\n`;
            if (assignment.description) {
              message += `   📝 Description: ${assignment.description.substring(0, 100)}${assignment.description.length > 100 ? '...' : ''}\n`;
            }
            message += '\n';
          });

          return {
            message: message,
            conversationId: req.body.conversationId || generateConversationId()
          };

        } catch (error) {
          console.error('Error fetching pending assignments:', error);
          return {
            message: "I couldn't retrieve your pending assignments. Please try again later.",
            conversationId: req.body.conversationId || generateConversationId()
          };
        }
      }

      case 'SHOW_COURSE_GRADES': {
        try {
          if (userRole !== 'student') {
            return {
              message: "This feature is only available for students.",
              conversationId: req.body.conversationId || generateConversationId()
            };
          }

          const { courseNames } = parameters;
          if (!courseNames || courseNames.length === 0) {
            return {
              message: "I need to know which courses you want to see grades for. Please specify the course names (e.g., 'Show me my grades in SQL and Tableau').",
              conversationId: req.body.conversationId || generateConversationId()
            };
          }

          // Get all courses for the student
          const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
          const allCourses = Array.isArray(coursesResponse) ? coursesResponse : [];

          // Find courses that match the requested course names
          const matchingCourses = allCourses.filter(course => {
            const courseNameLower = course.name.toLowerCase();
            return courseNames.some(requestedCourse => {
              const requestedLower = requestedCourse.toLowerCase().trim();
              // Try multiple matching strategies
              return courseNameLower.includes(requestedLower) ||
                     courseNameLower.includes(requestedLower.replace(/\s+/g, '')) ||
                     courseNameLower.includes(requestedLower.replace(/\s+/g, '-')) ||
                     courseNameLower.includes(requestedLower.replace(/\s+/g, '_'));
            });
          });

          // Debug: Log available courses for troubleshooting
          console.log('🔍 DEBUG: Available courses:', allCourses.map(c => c.name));
          console.log('🔍 DEBUG: Requested course names:', courseNames);
          console.log('🔍 DEBUG: Matching courses found:', matchingCourses.map(c => c.name));

          if (matchingCourses.length === 0) {
            // Show available courses to help the user
            const availableCourseNames = allCourses.map(course => course.name).join(', ');
            return {
              message: `I couldn't find any courses matching: ${courseNames.join(', ')}.\n\nAvailable courses: ${availableCourseNames}\n\nPlease check the course names and try again.`,
              conversationId: req.body.conversationId || generateConversationId()
            };
          }

          // Fetch grades for each matching course
          const courseGrades = [];
          
          for (const course of matchingCourses) {
            try {
              // Get assignments for this course
              const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments`, 'GET', null, userToken, req);
              const assignments = Array.isArray(assignmentsResponse) ? assignmentsResponse : [];

              // Get submissions for each assignment
              const courseGradeData = {
                courseName: course.name,
                courseId: course.id,
                assignments: []
              };

              for (const assignment of assignments) {
                try {
                  // Get submissions for this assignment
                  const submissionsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments/${assignment.id}/submissions`, 'GET', null, userToken, req);
                  const submissions = Array.isArray(submissionsResponse) ? submissionsResponse : [];

                  // Find the student's submission
                  const studentSubmission = submissions.find(sub => sub.userId === userId);
                  
                  if (studentSubmission) {
                    courseGradeData.assignments.push({
                      title: assignment.title,
                      maxPoints: assignment.maxPoints || 0,
                      grade: studentSubmission.assignedGrade || studentSubmission.draftGrade || 0,
                      state: studentSubmission.state || 'UNKNOWN',
                      dueDate: assignment.dueDate,
                      submissionTime: studentSubmission.submissionTime
                    });
                  }
                } catch (error) {
                  console.error(`Error fetching submissions for assignment ${assignment.title}:`, error);
                }
              }

              courseGrades.push(courseGradeData);
            } catch (error) {
              console.error(`Error fetching grades for course ${course.name}:`, error);
            }
          }

          // Format the response
          let message = `📊 **Your Grades in ${courseNames.join(' and ')}:**\n\n`;
          
          if (courseGrades.length === 0) {
            message += "No grades found for the specified courses.";
          } else {
            courseGrades.forEach(courseData => {
              message += `**${courseData.courseName}**\n`;
              
              if (courseData.assignments.length === 0) {
                message += `   No graded assignments found.\n\n`;
              } else {
                courseData.assignments.forEach(assignment => {
                  const percentage = assignment.maxPoints > 0 ? 
                    Math.round((assignment.grade / assignment.maxPoints) * 100) : 0;
                  
                  message += `   📝 ${assignment.title}\n`;
                  message += `   📊 Grade: ${assignment.grade}/${assignment.maxPoints} (${percentage}%)\n`;
                  message += `   📋 Status: ${assignment.state}\n`;
                  
                  if (assignment.dueDate) {
                    const dueDate = new Date(assignment.dueDate.year, assignment.dueDate.month - 1, assignment.dueDate.day);
                    const dueDateStr = dueDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    });
                    message += `   📅 Due: ${dueDateStr}\n`;
                  }
                  
                  if (assignment.submissionTime) {
                    const submissionDate = new Date(assignment.submissionTime);
                    const submissionStr = submissionDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    });
                    message += `   ⏰ Submitted: ${submissionStr}\n`;
                  }
                  
                  message += '\n';
                });
              }
            });
          }

          return {
            message: message,
            conversationId: req.body.conversationId || generateConversationId()
          };

        } catch (error) {
          console.error('Error fetching course grades:', error);
          return {
            message: "I couldn't retrieve your grades. Please try again later.",
            conversationId: req.body.conversationId || generateConversationId()
          };
        }
      }

      case 'ASSIGNMENT_SUBMISSION_HELP': {
        return {
          message: `📝 **How to Submit an Assignment:**

**Step-by-Step Guide:**

1. **Open Your Classroom**
   • Go to your classroom platform
   • Sign in with your school account

2. **Find Your Assignment**
   • Click on the class where the assignment was posted
   • Look for the assignment in the "Classwork" tab
   • Click on the assignment title

3. **Submit Your Work**
   • Click the "View assignment" button
   • Click "Add or create" to upload your file
   • Choose from:
     - 📁 **Upload from device** - Select files from your computer
     - 📄 **Drive** - Choose files from your Drive
     - 📝 **Create** - Make a new Doc, Sheet, or Slide
     - 🔗 **Link** - Add a link to your work

4. **Add Comments (Optional)**
   • Click "Add private comment" to message your teacher
   • This is only visible to you and your teacher

5. **Submit**
   • Click the blue "Turn in" button
   • Confirm by clicking "Turn in" again

**Important Tips:**
• ⏰ Submit before the due date to avoid late penalties
• 📱 You can also submit from the mobile app
• 🔄 You can unsubmit and resubmit before the due date
• 📋 Check the assignment details for specific requirements

**Need Help?**
• Ask your teacher if you have questions about the assignment
• Check the assignment instructions for specific submission requirements
• Make sure your file is in the correct format (PDF, DOC, etc.)`,
          conversationId: req.body.conversationId || generateConversationId()
        };
      }

      case 'JOIN_CLASS_HELP': {
        return {
          message: `🎓 **How to Join a Class - It's Super Easy!**

**📧 The Easiest Way: Email Invitation**

Your teacher will send you an invitation email. Here's what happens:

1. **📬 Check Your Email**
   • Look for an invitation email from your teacher
   • Subject: "You're invited to join [Course Name]!"
   • It contains a special join link

2. **🔗 Click the Join Link**
   • Just click the link in the email
   • That's it! You're done!

3. **✨ What Happens Next:**
   
   **If you're NEW to the platform:**
   • ✅ We automatically create an account for you
   • 📧 You'll receive another email with your login credentials
   • 🎉 You're instantly enrolled in the class
   • 🔐 Use those credentials to log in and access your course
   
   **If you already have an account:**
   • ✅ You're instantly enrolled in the class
   • 🎉 You can access the course immediately
   • 📚 All course materials are ready for you

**That's It! No Complex Steps!**

You don't need to:
❌ Create an account manually
❌ Remember class codes
❌ Fill out forms
❌ Wait for approval

**✨ Just one click and you're in!**

**💡 Quick Tips:**
• 📧 Check your spam/junk folder if you don't see the invitation
• ⏰ Accept invitations promptly - they're usually valid for 7 days
• 🔐 If an account was created for you, change your password after first login
• 🆘 Contact your teacher if you didn't receive an invitation

**Need Help?**
If you have any issues, just let me know and I'll help you troubleshoot!`,
          conversationId: req.body.conversationId || generateConversationId()
        };
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
        
      case 'AI_ASSISTED_ANNOUNCEMENT': {
        console.log('🔍 DEBUG: AI_ASSISTED_ANNOUNCEMENT case - parameters:', parameters);
        
        // Only allow teachers and super_admin to create announcements
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to create announcements. Only teachers and super admins can create announcements.',
            conversationId: req.body.conversationId
          };
        }

        // Check if course name is already provided
        if (parameters.courseName) {
          // Validate the course name first
          try {
            const courseMatch = await findMatchingCourse(
              parameters.courseName, 
              userToken, 
              req, 
              baseUrl
            );
            
            if (!courseMatch.success) {
              return {
                message: `I couldn't find any courses matching "${parameters.courseName}". Could you please check the course name and try again? You can also say "list courses" to see all available courses.`,
                conversationId: conversationId
              };
            }
            
            if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
              // Multiple matches - ask for clarification
              return {
                message: `I found multiple courses matching "${parameters.courseName}". Which one would you like to create an announcement for?`,
                options: courseMatch.allMatches.map(course => ({
                  id: course.id,
                  name: course.name,
                  section: course.section || "No section"
                })),
                conversationId: conversationId
              };
            }
            
            // Course found and validated, now ask for announcement content
            if (conversationId) {
              startOngoingAction(conversationId, 'AI_ASSISTED_ANNOUNCEMENT', ['announcementText'], { courseName: parameters.courseName });
            }
            
            return {
              message: `Great! I found your course "${parameters.courseName}". What would you like to announce to your students?`,
              conversationId: conversationId,
              ongoingAction: {
                action: 'AI_ASSISTED_ANNOUNCEMENT',
                missingParameters: ['announcementText'],
                collectedParameters: { courseName: parameters.courseName }
              }
            };
          } catch (error) {
            console.error('Error validating course name:', error);
            return {
              message: `I encountered an error while looking for the course. Could you please try again?`,
              conversationId: conversationId
            };
          }
        } else {
          // No course name provided, start from the beginning
          if (conversationId) {
            startOngoingAction(conversationId, 'AI_ASSISTED_ANNOUNCEMENT', ['courseName'], {});
          }
          
          return {
            message: `I'd be happy to help you create an announcement! 😊\n\nLet me guide you through this step by step:\n\n1. First, which course would you like to post the announcement in?\n2. Then I'll help you craft the perfect announcement\n3. Finally, I'll show you a preview before posting\n\nWhich course should we start with?`,
            conversationId: conversationId,
            ongoingAction: {
              action: 'AI_ASSISTED_ANNOUNCEMENT',
              missingParameters: ['courseName'],
              collectedParameters: {}
            }
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
        // Only trigger disambiguation if needsDisambiguation is true AND no courseName was provided
        if (parameters.needsDisambiguation && !parameters.courseName && !parameters.courseIdentifier) {
          console.log('🔍 DEBUG: Disambiguation needed for generic course name');
          
          // Start ongoing action for parameter collection
          startOngoingAction(conversationId, 'CREATE_ANNOUNCEMENT', ['courseName'], {});
          
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
          // If course name is missing, ask for it first and validate it
          if (missingParams.includes('courseName')) {
          // 🚀 START TRACKING: Start tracking this action for parameter collection
            startOngoingAction(conversationId, 'CREATE_ANNOUNCEMENT', ['courseName'], parameters);
            
            return {
              message: "Which course should I post this announcement in?",
              conversationId: conversationId,
              ongoingAction: {
                action: 'CREATE_ANNOUNCEMENT',
                missingParameters: ['courseName'],
                collectedParameters: parameters
              }
            };
          }
          // If only announcement text is missing, validate course name first
          else if (missingParams.includes('announcementText')) {
            // Validate the course name first before asking for announcement text
            try {
              const courseMatch = await findMatchingCourse(
                parameters.courseName || parameters.courseIdentifier, 
                userToken, 
                req, 
                baseUrl
              );
              
              if (!courseMatch.success) {
                // Start ongoing action to allow user to correct course name
                startOngoingAction(conversationId, 'CREATE_ANNOUNCEMENT', ['courseName'], {});
          
          return {
                  message: `I couldn't find any courses matching "${parameters.courseName}". Could you please check the course name and try again?`,
            conversationId: conversationId,
            ongoingAction: {
              action: 'CREATE_ANNOUNCEMENT',
                    missingParameters: ['courseName'],
                    collectedParameters: {}
                  }
                };
              }
              
              if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
                // Multiple matches - ask for clarification
                startOngoingAction(conversationId, 'CREATE_ANNOUNCEMENT', ['courseName'], {});
                
                return {
                  message: `I found multiple courses matching "${parameters.courseName}". Which one would you like to create an announcement for?`,
                  options: courseMatch.allMatches.map(course => ({
                    id: course.id,
                    name: course.name,
                    section: course.section || "No section"
                  })),
                  conversationId: conversationId,
                  ongoingAction: {
                    action: 'CREATE_ANNOUNCEMENT',
                    missingParameters: ['courseName'],
                    collectedParameters: {}
                  }
                };
              }
              
              // Course validated successfully, now ask for announcement text
              startOngoingAction(conversationId, 'CREATE_ANNOUNCEMENT', ['announcementText'], parameters);
              
              return {
                message: `Great! I found your course "${parameters.courseName}". What would you like to announce to your students?`,
                conversationId: conversationId,
                ongoingAction: {
                  action: 'CREATE_ANNOUNCEMENT',
                  missingParameters: ['announcementText'],
              collectedParameters: parameters
            }
          };
            } catch (error) {
              console.error('Error validating course name:', error);
              startOngoingAction(conversationId, 'CREATE_ANNOUNCEMENT', ['courseName'], {});
              
              return {
                message: `I encountered an error while looking for the course. Could you please try again?`,
                conversationId: conversationId,
                ongoingAction: {
                  action: 'CREATE_ANNOUNCEMENT',
                  missingParameters: ['courseName'],
                  collectedParameters: {}
                }
              };
            }
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
          
          // Use internal API call
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
            message: `Great! I've posted your announcement "${parameters.announcementText}" in ${selectedCourse.name}. Your students will now see this announcement in their classroom.`,
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

      case 'AI_ASSISTED_ANNOUNCEMENT': {
        console.log('🔍 DEBUG: AI_ASSISTED_ANNOUNCEMENT execution - parameters:', parameters);
        
        // Only allow teachers and super_admin to create announcements
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to create announcements. Only teachers and super admins can create announcements.',
            conversationId: req.body.conversationId
          };
        }

        // Check if we have all required parameters
        if (!parameters.courseName || !parameters.announcementText || !parameters.confirmed) {
          return {
            message: 'I need more information to create the announcement. Please try again.',
            conversationId: conversationId
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
              message: `I found multiple courses matching "${parameters.courseName}". Which one would you like to create an announcement for?`,
              options: courseMatch.allMatches.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              conversationId: req.body.conversationId
            };
          }
          
        // Create the announcement using our database system
        const announcementService = require('../../services/announcementService');
        const response = await announcementService.createAnnouncement({
          courseId: selectedCourse.id,
          teacherId: req.user.id,
          title: null,
          content: parameters.announcementText
        });
        
        if (!response || !response.success) {
            return {
            message: `Sorry, I couldn't create the announcement. ${response?.message || 'Please try again.'}`,
              conversationId: req.body.conversationId
            };
          }
          
          // ✅ COMPLETE ACTION: Mark the ongoing action as completed
          if (conversationId) {
            completeOngoingAction(conversationId);
          }

          return {
          message: `Perfect! I've posted your announcement "${parameters.announcementText}" in ${selectedCourse.name}. ${response.message}`,
            announcement: response.announcement,
            conversationId: conversationId
          };
        } catch (error) {
          console.error('Error in AI_ASSISTED_ANNOUNCEMENT:', error);
          
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
          
        // Exact match - get the announcements using our database system
          const courseId = selectedCourse.id;
        const announcementModel = require('../../models/announcement.model');
        const announcements = await announcementModel.getAnnouncementsByCourse(courseId);
          
          if (!announcements || announcements.length === 0) {
            return {
              message: `📢 **${selectedCourse.name}**\n\nNo announcements found yet. This course is ready for your first announcement!`,
              conversationId: req.body.conversationId
            };
          }
          
          const announcementList = announcements.map((announcement, index) => {
          const date = new Date(announcement.created_at).toLocaleDateString();
          const titleText = announcement.title ? `**${announcement.title}**\n   ` : '';
          return `${index + 1}. ${titleText}${announcement.content}\n   📅 ${date} • By ${announcement.teacher_name}`;
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

        // Check what parameters are missing and start tracking if needed
        const missingParams = [];
        if (!parameters.courseName && !parameters.courseIdentifier) {
          missingParams.push('courseName');
        }
        if (!parameters.title) {
          missingParams.push('title');
        }
        // Check if hasAttachment hasn't been asked yet
        if (parameters.hasAttachment === undefined) {
          missingParams.push('hasAttachment');
        }

        if (missingParams.length > 0) {
          // If course name is missing, ask for it first and validate it
          if (missingParams.includes('courseName')) {
            // 🚀 START TRACKING: Start tracking this action for parameter collection
            // Preserve any existing parameters (like dueDateExpr) when starting parameter collection
            const preservedParams = { ...parameters };
            startOngoingAction(conversationId, 'CREATE_ASSIGNMENT', ['courseName'], preservedParams);
            
          return {
            message: "I need to know which course you want to create an assignment for. Please provide a course name.",
              conversationId: conversationId,
              ongoingAction: {
                action: 'CREATE_ASSIGNMENT',
                missingParameters: ['courseName'],
                collectedParameters: parameters
              }
            };
          }
          // If only title is missing, validate course name first
          else if (missingParams.includes('title')) {
            // Validate the course name first before asking for title
            try {
              const courseMatch = await findMatchingCourse(
                parameters.courseName || parameters.courseIdentifier, 
                userToken, 
                req, 
                baseUrl
              );
              
              if (!courseMatch.success) {
                // Start ongoing action to allow user to correct course name
                // Preserve any existing parameters (like dueDateExpr) when starting parameter collection
                const preservedParams = { ...parameters };
                startOngoingAction(conversationId, 'CREATE_ASSIGNMENT', ['courseName'], preservedParams);
                
          return {
                  message: `I couldn't find any courses matching "${parameters.courseName}". Could you please check the course name and try again?`,
                  conversationId: conversationId,
                  ongoingAction: {
                    action: 'CREATE_ASSIGNMENT',
                    missingParameters: ['courseName'],
                    collectedParameters: preservedParams
                  }
                };
              }
              
              if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
                // Multiple matches - ask for clarification
                // Preserve any existing parameters (like dueDateExpr) when starting parameter collection
                const preservedParams = { ...parameters };
                startOngoingAction(conversationId, 'CREATE_ASSIGNMENT', ['courseName'], preservedParams);
                
                return {
                  message: `I found multiple courses matching "${parameters.courseName}". Which one would you like to create an assignment for?`,
                  options: courseMatch.allMatches.map(course => ({
                    id: course.id,
                    name: course.name,
                    section: course.section || "No section"
                  })),
                  conversationId: conversationId,
                  ongoingAction: {
                    action: 'CREATE_ASSIGNMENT',
                    missingParameters: ['courseName'],
                    collectedParameters: preservedParams
                  }
                };
              }
              
              // Course validated successfully, now ask for assignment title
              // Preserve any existing parameters (like dueDateExpr) when starting parameter collection
              const preservedParams = { courseName: courseMatch.course.name };
              if (parameters.dueDateExpr) preservedParams.dueDateExpr = parameters.dueDateExpr;
              if (parameters.dueTimeExpr) preservedParams.dueTimeExpr = parameters.dueTimeExpr;
              if (parameters.description) preservedParams.description = parameters.description;
              if (parameters.maxPoints) preservedParams.maxPoints = parameters.maxPoints;
              
              startOngoingAction(conversationId, 'CREATE_ASSIGNMENT', ['title'], preservedParams);
              
              return {
                message: `Great! I found your course "${courseMatch.course.name}". Please provide a title for your assignment.`,
                conversationId: conversationId,
                ongoingAction: {
                  action: 'CREATE_ASSIGNMENT',
                  missingParameters: ['title'],
                  collectedParameters: { courseName: courseMatch.course.name }
                }
              };
            } catch (error) {
              console.error('Error validating course name:', error);
              // Preserve any existing parameters (like dueDateExpr) when starting parameter collection
              const preservedParams = { ...parameters };
              startOngoingAction(conversationId, 'CREATE_ASSIGNMENT', ['courseName'], preservedParams);
              
              return {
                message: `I encountered an error while looking for the course. Could you please try again?`,
                conversationId: conversationId,
                ongoingAction: {
                  action: 'CREATE_ASSIGNMENT',
                  missingParameters: ['courseName'],
                  collectedParameters: preservedParams
                }
              };
            }
          }
          // If only hasAttachment is missing, ask about attachment
          else if (missingParams.includes('hasAttachment')) {
            // We have course and title, now ask if they want to attach a file
            const preservedParams = { ...parameters };
            startOngoingAction(conversationId, 'CREATE_ASSIGNMENT', ['hasAttachment'], preservedParams);
            
            return {
              message: `Would you like to attach a file to this assignment? (yes/no)\n\n📎 You can attach:\n• PDF documents\n• Word documents\n• Images\n• Spreadsheets\n• Any other files\n\nJust say "yes" or "no".`,
              conversationId: conversationId,
              ongoingAction: {
                action: 'CREATE_ASSIGNMENT',
                missingParameters: ['hasAttachment'],
                collectedParameters: preservedParams
              }
            };
          }
        }

        // Calculate due date from expression if provided
        if (parameters.dueDateExpr) {
          console.log('🔍 DEBUG: Calculating due date from expression:', parameters.dueDateExpr);
          const calculatedDate = calculateDateFromExpression(parameters.dueDateExpr);
          console.log('🔍 DEBUG: Calculated due date:', calculatedDate);
          if (calculatedDate) {
            parameters.dueDate = calculatedDate;
            console.log('🔍 DEBUG: Set parameters.dueDate to:', parameters.dueDate);
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
          
          // Exact match - create the assignment using database system
          const courseId = selectedCourse.id;
          
          // ✅ CHECK: If user wants to attach a file but hasn't uploaded it yet
          if (parameters.hasAttachment === true && parameters.attachmentUrl === 'pending') {
            // Don't create assignment yet - return a message asking for file upload
            // The frontend should show file upload UI
            return {
              message: `📎 **Please upload your file**\n\nYou indicated you want to attach a file to this assignment. Please use the file upload button below to attach your file.\n\n**Assignment Details:**\n• Course: ${selectedCourse.name}\n• Title: ${parameters.title}${parameters.description ? `\n• Description: ${parameters.description}` : ''}\n\nOnce you upload the file, the assignment will be created automatically.`,
              awaitingFileUpload: true,
              assignmentData: {
                courseId: courseId,
                courseName: selectedCourse.name,
                title: parameters.title,
                description: parameters.description || '',
                dueDate: parameters.dueDate,
                maxPoints: parameters.maxPoints || 100
              },
              conversationId: req.body.conversationId || generateConversationId()
            };
          }
          
          try {
            // Prepare due date - convert from dueDate object to ISO string if needed
            let dueDateTime = null;
            if (parameters.dueDate) {
              // If dueDate is an object {year, month, day}, convert to Date
              if (typeof parameters.dueDate === 'object' && parameters.dueDate.year) {
                const year = parameters.dueDate.year;
                const month = parameters.dueDate.month - 1; // JS months are 0-indexed
                const day = parameters.dueDate.day;
                const hours = parameters.dueTime?.hours || 18;
                const minutes = parameters.dueTime?.minutes || 0;
                dueDateTime = new Date(year, month, day, hours, minutes, 0, 0).toISOString();
              } else if (typeof parameters.dueDate === 'string') {
                // If already a string, use it directly
                dueDateTime = parameters.dueDate;
              }
            }
            
            // ✅ EXTRACT ATTACHMENT DATA: Check if user has uploaded a file
            let attachments = [];
            if (req.body.attachmentUrl && req.body.attachmentData && req.body.attachmentUrl !== 'pending') {
              console.log('🔍 DEBUG: File uploaded! Including attachment in assignment');
              console.log('🔍 DEBUG: attachmentUrl:', req.body.attachmentUrl);
              console.log('🔍 DEBUG: attachmentData:', req.body.attachmentData);
              
              // Build attachment object from uploaded file data
              attachments = [{
                originalName: req.body.attachmentData.originalName,
                filename: req.body.attachmentData.filename,
                url: req.body.attachmentData.url,
                fullUrl: req.body.attachmentUrl,
                size: req.body.attachmentData.size,
                mimetype: req.body.attachmentData.mimetype,
                uploadedAt: new Date().toISOString(),
                uploadedBy: req.user.id
              }];
            }
            
            console.log('🔍 DEBUG: Creating assignment with database system');
            console.log('🔍 DEBUG: courseId:', courseId, 'teacherId:', req.user.id);
            console.log('🔍 DEBUG: dueDateTime:', dueDateTime);
            console.log('🔍 DEBUG: attachments:', JSON.stringify(attachments));
            
            // Use the new database assignment service
            const newAssignmentService = require('../../services/newAssignmentService');
            const response = await newAssignmentService.createAssignment({
              courseId,
              teacherId: req.user.id,
              title: parameters.title,
              description: parameters.description || '',
              dueDate: dueDateTime,
              maxPoints: parameters.maxPoints || 100,
              attachments: attachments
            });

            // ✅ COMPLETE ACTION: Mark the ongoing action as completed
            if (conversationId) {
              completeOngoingAction(conversationId);
            }

            // Format due time safely
            let dueTimeStr = '';
            if (dueDateTime) {
              const dueDateObj = new Date(dueDateTime);
              dueTimeStr = `\n• Due Date: ${dueDateObj.toLocaleDateString()} at ${dueDateObj.toLocaleTimeString()}`;
            }
            
            // Format attachment info if included
            let attachmentStr = '';
            if (attachments && attachments.length > 0) {
              attachmentStr = `\n• Attachment: ${attachments[0].originalName} (${(attachments[0].size / 1024).toFixed(2)} KB)`;
            }

            return {
              message: `Great! I've successfully created your assignment "${parameters.title}" in ${selectedCourse.name}. 😊\n\nAssignment Details:\n• Title: ${parameters.title}${parameters.description ? `\n• Description: ${parameters.description}` : ''}${dueTimeStr}${parameters.maxPoints ? `\n• Max Points: ${parameters.maxPoints}` : ''}${attachmentStr}\n\n${response.message}\n\nNext steps:\n• Students have been notified via email\n• Review student submissions\n• Grade completed assignments\n• Provide feedback to students`,
              assignment: response.assignment,
              awaitingFileUpload: false,
              conversationId: req.body.conversationId || generateConversationId()
            };
          } catch (error) {
            // ✅ COMPLETE ACTION: Mark the ongoing action as completed even on error
            if (conversationId) {
              completeOngoingAction(conversationId);
            }
            
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
          // ✅ COMPLETE ACTION: Mark the ongoing action as completed even on error
          if (conversationId) {
            completeOngoingAction(conversationId);
          }
          
          console.error('Error in CREATE_ASSIGNMENT:', error);
          return {
            message: "Sorry, I encountered an error while trying to create the assignment. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId || generateConversationId()
          };
        }
      }
        
      case 'INVITE_STUDENTS':
        console.log('🔍 DEBUG: INVITE_STUDENTS case started');
        console.log('🔍 DEBUG: Parameters received:', JSON.stringify(parameters, null, 2));
        console.log('🔍 DEBUG: User role:', userRole);
        console.log('🔍 DEBUG: Is parameter collection:', parameters.isParameterCollection);
        
        // Only allow teachers and super_admin to invite students
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          console.log('🔍 DEBUG: User not authorized to invite students');
          return {
            message: 'You are not authorized to invite students. Only teachers and super admins can invite students.',
            conversationId: req.body.conversationId
          };
        }
        
        // If this is parameter collection, handle it through the parameter collection flow
        if (parameters.isParameterCollection) {
          console.log('🔍 DEBUG: This is parameter collection, delegating to parameter collection handler');
          return null; // Let the parameter collection handler deal with it
        }
        
        // Check if both course name and student emails are missing
        if (!parameters.courseName && (!parameters.studentEmails || parameters.studentEmails.length === 0)) {
          console.log('🔍 DEBUG: Both course name and student emails missing, starting ongoing action');
          // Start ongoing action for parameter collection
          if (conversationId) {
            startOngoingAction(conversationId, 'INVITE_STUDENTS', ['courseName', 'studentEmails'], {});
          }
          return {
            message: 'I need to know which course you want to invite students to and which students to invite. Please provide a course name first.',
            conversationId: req.body.conversationId,
            ongoingAction: {
              action: 'INVITE_STUDENTS',
              missingParameters: ['courseName', 'studentEmails'],
              collectedParameters: {}
            }
          };
        }
        
        if (!parameters.courseName) {
          console.log('🔍 DEBUG: Missing course name, starting ongoing action and asking for it');
          // Start ongoing action for parameter collection
          if (conversationId) {
            startOngoingAction(conversationId, 'INVITE_STUDENTS', ['courseName'], {});
          }
          return {
            message: 'I need to know which course you want to invite students to. Please provide a course name.',
            conversationId: req.body.conversationId,
            ongoingAction: {
              action: 'INVITE_STUDENTS',
              missingParameters: ['courseName'],
              collectedParameters: {}
            }
          };
        }
        
        const studentEmails = parameters.studentEmails || parameters.emails;
        console.log('🔍 DEBUG: Student emails extracted:', studentEmails);
        if (!studentEmails || studentEmails.length === 0) {
          console.log('🔍 DEBUG: Missing student emails, starting ongoing action and asking for them');
          // Start ongoing action for parameter collection
          if (conversationId) {
            startOngoingAction(conversationId, 'INVITE_STUDENTS', ['studentEmails'], { courseName: parameters.courseName });
          }
          return {
            message: 'I need to know which students to invite. Please provide their email addresses.',
            conversationId: req.body.conversationId,
            ongoingAction: {
              action: 'INVITE_STUDENTS',
              missingParameters: ['studentEmails'],
              collectedParameters: { courseName: parameters.courseName }
            }
          };
        }
        
        let selectedCourse;
        try {
          // Use the reusable course matching function
          const courseMatch = await findMatchingCourse(
            parameters.courseName, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            // Start ongoing action to allow user to correct course name
            startOngoingAction(conversationId, 'INVITE_STUDENTS', ['courseName'], { studentEmails: parameters.studentEmails });
            
            return {
              message: courseMatch.message,
              conversationId: req.body.conversationId,
              ongoingAction: {
                action: 'INVITE_STUDENTS',
                missingParameters: ['courseName'],
                collectedParameters: { studentEmails: parameters.studentEmails }
              }
            };
          }
          
          selectedCourse = courseMatch.course;
          
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
          
          // Exact match - invite the students using our invitation service
          const courseId = selectedCourse.id;
          
          try {
            // Use our invitation service to send invitations
            const invitationService = require('../invitationService');
            
            const result = await invitationService.inviteMultipleUsers({
              courseId: courseId,
              inviterUserId: req.user.id,
              inviteeEmails: studentEmails,
              inviteeRole: 'student',
              inviterName: req.user.name,
              courseName: selectedCourse.name
            });
            
            // Format success message
            const successList = result.successful.map(inv => `✅ ${inv.email}`).join('\n');
            const failedList = result.failed.length > 0 
              ? `\n\n❌ **Failed:**\n${result.failed.map(f => `• ${f.email}: ${f.error}`).join('\n')}`
              : '';
            
            const message = `📧 **Invitations Sent!**\n\n**Course:** ${selectedCourse.name}\n\n**Successfully invited:**\n${successList}${failedList}\n\n${result.successful.length} invitation email(s) sent. Students will receive an email with a link to join the course.`;
            
            return {
              message,
              conversationId: req.body.conversationId,
              result
            };
          } catch (error) {
            console.error('Error in INVITE_STUDENTS:', error);
            
            // Handle specific errors
            if (error.message.includes('already enrolled')) {
              return {
                message: `Some students are already enrolled in this course. ${error.message}`,
                conversationId: req.body.conversationId
              };
            }
            
            if (error.message.includes('already been sent')) {
              return {
                message: `An invitation has already been sent to one or more of these email addresses for this course.`,
                conversationId: req.body.conversationId
              };
            }
            
            return {
              message: `I encountered an error while sending invitations: ${error.message}. Please try again.`,
              error: error.message,
              conversationId: req.body.conversationId
            };
          }
        } catch (error) {
          console.error('Error in INVITE_STUDENTS outer:', error);
          return {
            message: "Sorry, I encountered an error while trying to invite students. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }

      case 'STUDENT_JOIN_SUGGESTION':
        // Extract potential course names and emails from the message
        const messageText = req.body.message || '';
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = messageText.match(emailRegex) || [];
        
        // Try to extract course names from common patterns
        const coursePatterns = [
          /(?:class|course)\s+([a-zA-Z0-9\s-]+)/i,
          /(?:to|in)\s+([a-zA-Z0-9\s-]+?)(?:\s|$)/i,
          /([a-zA-Z0-9\s-]+?)\s+(?:class|course)/i,
          /add\s+student\s+to\s+(.+)/i
        ];
        
        let extractedCourse = '';
        for (const pattern of coursePatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            extractedCourse = match[1].trim();
            break;
          }
        }
        
        // Check if this needs disambiguation (generic terms like "my class")
        const needsDisambiguation = parameters.needsDisambiguation || false;
        const genericTerms = ['my class', 'my course', 'the class', 'the course', 'this class', 'this course', 'class', 'course'];
        const isGenericTerm = genericTerms.some(term => 
          extractedCourse.toLowerCase().includes(term.toLowerCase()) || 
          extractedCourse.toLowerCase() === term.toLowerCase()
        );
        
        // If this is a generic term or needs disambiguation, ask for specific course
        if (needsDisambiguation || isGenericTerm) {
          return {
            message: `I'd be happy to help you invite students! 😊\n\nI need to know which specific course you're referring to. Could you please tell me the name of the class? For example: "Computer Science", "Math 101", or "AI".\n\nOnce you tell me the course name, I can help you invite students to it!`,
            conversationId: req.body.conversationId,
            suggestions: [
              "invite student [email] to class [course name]",
              "list courses",
              "show students in [course name]"
            ],
            extractedData: {
              emails: emails,
              courseName: extractedCourse,
              needsDisambiguation: true
            }
          };
        }
        
        // Check if this should be treated as a direct invitation
        if (emails.length > 0 && extractedCourse && !isGenericTerm) {
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
          specificHelp = `\n\nI found a student email: ${emails[0]}\nJust tell me which class to invite them to!`;
        } else if (extractedCourse && !isGenericTerm) {
          // We found course but no email
          suggestions.push(`invite student [email] to class ${extractedCourse}`);
          specificHelp = `\n\nI found a course: ${extractedCourse}\nJust tell me which student to invite!`;
        }
        
        // Add general suggestions
        suggestions.push(
          "invite student [email] to class [course name]",
          "show students in [course name]",
          "list courses"
        );
        
        return {
          message: `I'd be happy to help you with student invitations! 😊\n\nInstead of sharing join links, it's better to invite students directly by adding their email addresses. This way, they'll receive a proper invitation and can join your class easily.\n\nHere's how to invite a student:\nJust say: "invite student [email] to class [course name]"\n\nFor example:\n"invite student john@gmail.com to class AI"`,
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
        
        // Normalize email list from parameters (support teacherEmail, teacherEmails, or emails)
        let inviteEmails = Array.isArray(parameters.emails)
          ? parameters.emails
          : Array.isArray(parameters.teacherEmails)
            ? parameters.teacherEmails
            : [];
        if (!inviteEmails.length && typeof parameters.teacherEmail === 'string' && parameters.teacherEmail.trim().length > 0) {
          inviteEmails = [parameters.teacherEmail.trim()];
        }
        // Fallback: extract from the raw message if still empty
        if (!inviteEmails.length && req?.body?.message) {
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const found = req.body.message.match(emailRegex) || [];
          if (found.length) inviteEmails = found;
        }
        
        // Check if we need course name
        if (parameters.needsCourseName || !parameters.courseName) {
          // Start ongoing action to collect the course name for teacher invitation
          if (conversationId) {
            startOngoingAction(conversationId, 'INVITE_TEACHERS', ['courseName'], { emails: inviteEmails });
          }
          return {
            message: 'To invite a teacher, please use: "invite teacher TEACHER_EMAIL to CLASS_NAME".',
            conversationId: req.body.conversationId,
            ongoingAction: {
              action: 'INVITE_TEACHERS',
              missingParameters: ['courseName'],
              collectedParameters: { emails: inviteEmails }
            }
          };
        }
        // Get all courses to find the matching one
        let teacherCoursesResponse = await makeApiCall(
          `${baseUrl}/api/classroom`,
          'GET',
          null,
          userToken,
          req
        );

        // Handle cases where coursesResponse might be directly an array
        if (!teacherCoursesResponse || !teacherCoursesResponse.courses || !Array.isArray(teacherCoursesResponse.courses)) {
          if (Array.isArray(teacherCoursesResponse)) {
            console.log('DEBUG: teacherCoursesResponse is directly an array, wrapping it');
            teacherCoursesResponse = { courses: teacherCoursesResponse };
          } else {
          return {
            message: 'Failed to retrieve courses. Please try again.',
            conversationId: req.body.conversationId
          };
          }
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
            { emails: inviteEmails },
            userToken,
            req
          );

          return {
            message: `Successfully invited ${inviteEmails.length} teacher(s) to ${teacherMatchingCourses[0].name}.`,
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
   • "schedule call Project Discussion today at 7pm" - Set up calls
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

      case 'COURSE_NAME_CORRECTION': {
        // Handle course name corrections - this should be processed as parameter collection
        if (conversationId) {
          const context = getOngoingActionContext(conversationId);
          if (context && context.action === 'INVITE_STUDENTS' && context.missingParameters.includes('courseName')) {
            console.log('🔍 DEBUG: Processing course name correction for ongoing INVITE_STUDENTS action');
            // Process this as parameter collection for the ongoing action
            const parameterCollection = await handleParameterCollection(context.action, context.collectedParameters, conversationId, originalMessage, userToken, req, baseUrl);
            
            if (parameterCollection) {
              if (parameterCollection.actionComplete) {
                // Action is now complete, execute it with all collected parameters
                console.log(`🎯 Action ${parameterCollection.action} is now complete with parameters:`, parameterCollection.allParameters);
                
                // Update the intent data with the complete parameters
                intentData.intent = parameterCollection.action;
                intentData.parameters = parameterCollection.allParameters;
                intent = parameterCollection.action;
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
                    missingParameters: parameterCollection.missingParameters,
                    collectedParameters: parameterCollection.collectedParameters
                  }
                };
              }
            } else {
              // No parameter collection result, ask for clarification
              return {
                message: "I didn't understand that course name. Could you please provide the correct course name?",
                conversationId: conversationId,
                ongoingAction: context
              };
            }
          } else {
            return {
              message: "I'm not sure what you're correcting. Could you please provide more context?",
              conversationId: conversationId
            };
          }
        }
        
        return {
          message: "I'm not sure what you're correcting. Could you please provide more context?",
          conversationId: conversationId
        };
      }

      case 'EDUCATIONAL_QUESTION':
        // Handle educational/academic questions
        return await handleEducationalQuestion(originalMessage, conversationId);

      case 'HELP': {
        // Provide comprehensive help based on what the user might need
        const helpMessage = `I'm here to help you with your classroom management! Here are some examples of what you can do:

📚 **Course Management:**
- "List my courses" - See all your courses
- "Create a course called Biology 101" - Create a new course
- "Show me the course details for Math 101" - Get course information

📝 **Assignments:**
- "Create assignment titled 'Homework 1' for Computer Science due next Friday at 5 PM" - Create an assignment
- "What assignments are due today?" - See pending assignments
- "Who submitted the tire pressure essay?" - Check submissions (teachers)
- "Grade assignment 'Essay 1' for student@email.com and give them 85" - Grade an assignment

📢 **Announcements:**
- "Post announcement 'Class is cancelled tomorrow' to AI class" - Create an announcement
- "Show announcements for Physics 101" - View announcements

👥 **Student Management:**
- "Invite student john@email.com to Computer Science class" - Invite students
- "Show enrolled students in Math 101" - View enrolled students

🗓️ **Meetings:**
- "Schedule a meeting with john@email.com for tomorrow at 3 PM" - Create a meeting
- "List my upcoming meetings" - View meetings
- "Reschedule my meeting from today 5pm to tomorrow 3pm" - Update a meeting

Need specific help? Just ask! For example:
- "How do I create an assignment?"
- "Can you tell me how to invite students?"
- "What's the best way to post an announcement?"`;
        
        return {
          message: helpMessage,
          conversationId: conversationId
        };
      }

      case 'HOW_TO_CREATE_ASSIGNMENT':
        return {
          message: `Here's how to create an assignment:

**Option 1 - Full command (recommended):**
"Create assignment titled 'Midterm Exam' for Computer Science due next Friday at 3 PM"

**Option 2 - Step by step:**
1. Say: "Create an assignment" or "I want to create an assignment"
2. Tell me the course name when I ask
3. Tell me the assignment title when I ask
4. Tell me the due date when I ask

**Tips:**
- You can include the assignment title, course name, and due date in one message
- Use natural language for dates like "tomorrow", "next Friday", "December 15th"
- Specify the time like "5 PM", "9:30 AM", or "midnight"`,
          conversationId: conversationId
        };

      case 'HOW_TO_CREATE_ANNOUNCEMENT':
        return {
          message: `Here's how to create an announcement:

**Option 1 - Full command (recommended):**
"Post announcement 'Homework is due tomorrow' to AI class"

**Option 2 - Step by step:**
1. Say: "Create an announcement" or "Post an announcement"
2. Tell me the course name when I ask
3. Tell me what you want to announce when I ask

**Tips:**
- You can include both the announcement text and course in one message
- You can use quotes around your announcement text for clarity
- Example: "Announce 'Class cancelled tomorrow' in Physics 101"`,
          conversationId: conversationId
        };

      case 'HOW_TO_INVITE_STUDENTS':
        return {
          message: `Here's how to invite students to a class:

**Option 1 - Full command (recommended):**
"Invite student john@email.com to Computer Science class"

**Option 2 - Multiple students:**
"Invite students john@email.com and jane@email.com to Math 101"

**Option 3 - Step by step:**
1. Say: "Invite a student" or "Add a student to class"
2. Tell me the student's email address
3. Tell me the course name

**Tips:**
- You can invite multiple students at once by separating emails with "and" or commas
- Make sure to provide the exact course name
- Students will receive an invitation email to join the class`,
          conversationId: conversationId
        };

      case 'HOW_TO_CREATE_COURSE':
        return {
          message: `Here's how to create a new course:

**Full command (recommended):**
"Create a course called Biology 101"

**Step by step:**
1. Say: "Create a course" or "I want to create a new class"
2. Tell me the course name when I ask

**Tips:**
- You just need to provide the course name
- Examples: "Create course Math 101", "Make a class called Physics 201"
- The course will be created in the classroom and you'll be the teacher`,
          conversationId: conversationId
        };

      case 'HOW_TO_SCHEDULE_MEETING':
        return {
          message: `Here's how to schedule a meeting:

**Full command (recommended):**
"Schedule a meeting with john@email.com for tomorrow at 3 PM"

**Step by step:**
1. Say: "Create a meeting" or "Schedule a meeting"
2. Tell me who to invite when I ask
3. Tell me when it should be when I ask

**Tips:**
- You can invite multiple people: "Schedule meeting with john@email.com and jane@email.com"
- Use natural language for dates: "tomorrow", "next Friday", "December 15th"
- Specify time clearly: "3 PM", "9:30 AM", "noon", "midnight"
- Example: "Schedule meeting with john@email.com tomorrow at 2 PM"`,
          conversationId: conversationId
        };

      case 'SEND_REMINDER': {
        console.log('🎯 DEBUG: SEND_REMINDER case executed!');
        
        // Only teachers and super_admin can send reminders
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to send reminders. Only teachers and super admins can send reminders.',
            conversationId: conversationId
          };
        }

        try {
          // Extract user from JWT token
          const token = userToken.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await getUserByEmail(decoded.email);
          
          if (!user.access_token || !user.refresh_token) {
            throw new Error('Missing required OAuth2 tokens');
          }

          const { getClassroomClient } = require('../../integrations/google.classroom');
          const classroom = getClassroomClient({
            access_token: user.access_token,
            refresh_token: user.refresh_token
          });

          // Get all courses
          const coursesResult = await classroom.courses.list({
            pageSize: 30,
            teacherId: 'me'
          });
          const courses = coursesResult.data.courses || [];
          
          if (courses.length === 0) {
            return {
              message: "You don't have any courses yet. Please create a course first.",
              conversationId: conversationId
            };
          }

          let coursesToCheck = courses;
          
          // If a specific course is mentioned, filter to that course only
          if (parameters.courseName) {
            const courseMatch = await findMatchingCourse(parameters.courseName, userToken, req, baseUrl);
            if (courseMatch.success && courseMatch.exactMatch) {
              coursesToCheck = [courseMatch.exactMatch];
            }
          }

          // Find upcoming assignments (tomorrow or next 2 days)
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dayAfterTomorrow = new Date();
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
          
          const upcomingAssignments = [];
          
          for (const course of coursesToCheck) {
            try {
              const assignmentsResult = await classroom.courses.courseWork.list({
                courseId: course.id,
                pageSize: 30,
                orderBy: 'dueDate asc'
              });
              
              const assignments = assignmentsResult.data.courseWork || [];
              
              for (const assignment of assignments) {
                if (assignment.dueDate) {
                  const dueDate = new Date(assignment.dueDate.year, assignment.dueDate.month - 1, assignment.dueDate.day);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  dueDate.setHours(0, 0, 0, 0);
                  
                  // Check if due date is tomorrow or in the next 2 days
                  const daysDiff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
                  if (daysDiff >= 0 && daysDiff <= 2) {
                    upcomingAssignments.push({
                      ...assignment,
                      courseName: course.name,
                      courseId: course.id,
                      daysUntilDue: daysDiff
                    });
                  }
                }
              }
            } catch (err) {
              console.error(`Error getting assignments for course ${course.id}:`, err);
            }
          }

          if (upcomingAssignments.length === 0) {
            return {
              message: "I couldn't find any assignments or quizzes due tomorrow or in the next few days.",
              conversationId: conversationId
            };
          }

          // Generate AI-powered reminder announcement
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
          
          const assignmentsList = upcomingAssignments.map(a => {
            const dueDate = a.dueDate ? `${a.dueDate.month}/${a.dueDate.day}/${a.dueDate.year}` : 'No due date';
            return `- ${a.title} in ${a.courseName} (Due: ${dueDate})`;
          }).join('\n');
          
          const reminderPrompt = `Create a friendly and encouraging reminder announcement for students about upcoming assignments/quizzes. The announcement should:
1. Be warm and supportive
2. Clearly list the upcoming assignments
3. Encourage students to prepare
4. Be concise (2-3 sentences max)

Assignments coming up:
${assignmentsList}

Create only the announcement text, without any introductory text or markdown formatting:`;

          const result = await model.generateContent(reminderPrompt);
          const reminderText = result.response.text().trim();
          
          // Group assignments by course
          const assignmentsByCourse = {};
          for (const assignment of upcomingAssignments) {
            if (!assignmentsByCourse[assignment.courseId]) {
              assignmentsByCourse[assignment.courseId] = [];
            }
            assignmentsByCourse[assignment.courseId].push(assignment);
          }
          
          // Post one reminder per course
          const postedReminders = [];
          
          for (const [courseId, courseAssignments] of Object.entries(assignmentsByCourse)) {
            try {
              // Create course-specific reminder text
              const courseAssignmentsList = courseAssignments.map(a => 
                `• ${a.title} (Due in ${a.daysUntilDue} day${a.daysUntilDue !== 1 ? 's' : ''})`
              ).join('\n');
              
              const courseReminderText = `Don't forget about these upcoming assignments:\n${courseAssignmentsList}\n\nPlease prepare accordingly and submit on time. Good luck! 🍀`;
              
              // Use our database system for announcements
              const announcementService = require('../../services/announcementService');
              await announcementService.createAnnouncement({
                courseId: courseId,
                teacherId: req.user.id,
                title: '📚 Upcoming Assignment Reminders',
                content: courseReminderText
              });
              
              postedReminders.push({
                course: courseAssignments[0].courseName,
                assignmentsCount: courseAssignments.length
              });
            } catch (err) {
              console.error(`Error posting reminder to ${courseAssignments[0].courseName}:`, err);
            }
          }
          
          return {
            message: `✅ I've sent reminder announcements for upcoming assignments!\n\n📋 **Reminders Posted To:**\n${postedReminders.map(c => `• ${c.course} (${c.assignmentsCount} assignment${c.assignmentsCount !== 1 ? 's' : ''})`).join('\n')}\n\n📝 **Total Upcoming Assignments:** ${upcomingAssignments.length}\n${upcomingAssignments.map(a => `• ${a.title} in ${a.courseName} (Due in ${a.daysUntilDue} day${a.daysUntilDue !== 1 ? 's' : ''})`).join('\n')}\n\n🎉 Students in these courses have been notified!`,
            conversationId: conversationId
          };
        } catch (error) {
          console.error('Error in SEND_REMINDER:', error);
          return {
            message: `Sorry, I encountered an error while trying to send the reminder: ${error.message}`,
            conversationId: conversationId
          };
        }
      }

      case 'UNKNOWN':
        // Handle unknown intents gracefully的处理
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

        // If user is asking for "today's assignment", fetch all assignments due/created today
        if (parameters.isTodaysAssignment && !parameters.courseName) {
          console.log('🔍 DEBUG: Fetching all assignments for today');
          
          try {
            // Get today's date range
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Query database for assignments due today or created today
            const assignmentModel = require('../../models/assignment.model');
            const db = require('../../utils/db');
            
            const query = `
              SELECT a.*, 
                c.name as course_name,
                u.name as teacher_name,
                (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = a.course_id) as total_students
              FROM assignments a
              JOIN courses c ON a.course_id = c.id
              JOIN users u ON a.teacher_id = u.id
              WHERE a.teacher_id = $1 
                AND (
                  (a.due_date >= $2 AND a.due_date < $3)
                  OR (a.created_at >= $2 AND a.created_at < $3)
                )
              ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC;
            `;
            
            const result = await db.query(query, [req.user.id, today, tomorrow]);
            const todaysAssignments = result.rows;
            
            if (todaysAssignments.length === 0) {
              return {
                message: "You don't have any assignments due or created today. 📅\n\nWould you like to:\n• Create a new assignment\n• Check assignments for a specific course\n• View all your assignments",
                conversationId: conversationId
              };
            }
            
            // Format the response with all today's assignments
            let message = `📝 **Assignments for Today** (${today.toLocaleDateString()})\n\n`;
            message += `Found ${todaysAssignments.length} assignment${todaysAssignments.length !== 1 ? 's' : ''}:\n\n`;
            
            todaysAssignments.forEach((assignment, index) => {
              const dueDate = assignment.due_date ? new Date(assignment.due_date).toLocaleString() : 'No due date';
              const createdDate = new Date(assignment.created_at).toLocaleString();
              
              message += `${index + 1}. **${assignment.title}**\n`;
              message += `   📚 Course: ${assignment.course_name}\n`;
              message += `   📅 Due: ${dueDate}\n`;
              message += `   ✍️ Created: ${createdDate}\n`;
              message += `   👥 Enrolled Students: ${assignment.total_students || 0}\n`;
              message += `   📊 Points: ${assignment.max_points}\n`;
              if (assignment.description) {
                message += `   📝 Description: ${assignment.description.substring(0, 100)}${assignment.description.length > 100 ? '...' : ''}\n`;
              }
              message += `\n`;
            });
            
            message += `\n💡 **Note:** Submission tracking will be added in a future update. Currently showing assignment details only.`;
            
            // Mark action as complete
            if (conversationId) {
              completeOngoingAction(conversationId);
            }
            
            return {
              message,
              assignments: todaysAssignments,
              conversationId: conversationId
            };
          } catch (error) {
            console.error('Error fetching today\'s assignments:', error);
            return {
              message: `Sorry, I encountered an error while fetching today's assignments: ${error.message}`,
              conversationId: conversationId
            };
          }
        }

        // Check if this action was completed through parameter collection
        // If so, skip parameter validation and go directly to execution
        if (parameters.selectedAssignments && parameters.assignmentTitle) {
          console.log('🔍 DEBUG: Action completed through parameter collection, proceeding to execution');
          // Skip parameter validation and go directly to execution
        } else {
          // Check what parameters are missing and start tracking if needed
        const missingParams = [];
        if (!parameters.courseName && !parameters.courseIdentifier && !parameters.isTodaysAssignment) {
          missingParams.push('courseName');
        }
        if (!parameters.isTodaysAssignment && !parameters.assignmentTitle) {
          missingParams.push('assignmentTitle');
        }

        if (missingParams.length > 0) {
          // If course name is missing, ask for it first and validate it
          if (missingParams.includes('courseName')) {
            // 🚀 START TRACKING: Start tracking this action for parameter collection
            startOngoingAction(conversationId, 'CHECK_ASSIGNMENT_SUBMISSIONS', ['courseName'], parameters);
            
            return {
              message: "I need to know which course you want to check submission status for. Please provide a course name.",
              conversationId: conversationId,
              ongoingAction: {
                action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                missingParameters: ['courseName'],
                collectedParameters: parameters
              }
            };
          } else if (missingParams.includes('assignmentTitle')) {
            // Course name is provided, but assignment title is missing
            try {
              // Validate the course name first before asking for assignment title
          const courseMatch = await findMatchingCourse(
                parameters.courseName || parameters.courseIdentifier,
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
                startOngoingAction(conversationId, 'CHECK_ASSIGNMENT_SUBMISSIONS', ['courseName'], {});
            return {
              message: courseMatch.message,
                  conversationId: conversationId,
                  ongoingAction: {
                    action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                    missingParameters: ['courseName'],
                    collectedParameters: {}
                  }
                };
              }
              
              // Handle multiple course matches
          if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
                const courseOptions = courseMatch.allMatches.map(course => `• ${course.name}${course.section ? ` (${course.section})` : ''}`).join('\n');
                startOngoingAction(conversationId, 'CHECK_ASSIGNMENT_SUBMISSIONS', ['courseName'], {});
            return {
                  message: `I found multiple courses matching "${parameters.courseName}". Which one do you mean?\n\n${courseOptions}`,
                  conversationId: conversationId,
                  ongoingAction: {
                    action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                    missingParameters: ['courseName'],
                    collectedParameters: {}
                  }
                };
              }
              
              // Course found and validated - ask for assignment title
              startOngoingAction(conversationId, 'CHECK_ASSIGNMENT_SUBMISSIONS', ['assignmentTitle'], { 
                courseName: courseMatch.course.name,
                isTodaysAssignment: parameters.isTodaysAssignment
              });
              
              if (parameters.isTodaysAssignment) {
                return {
                  message: `Great! I found the course "${courseMatch.course.name}". Now I'll look for assignments due today.`,
                  conversationId: conversationId,
                  ongoingAction: {
                    action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                    missingParameters: ['assignmentTitle'],
                    collectedParameters: { 
                      courseName: courseMatch.course.name,
                      isTodaysAssignment: true
                    }
                  }
                };
              } else {
                return {
                  message: `Great! I found the course "${courseMatch.course.name}". Which assignment would you like to check submission status for?`,
                  conversationId: conversationId,
                  ongoingAction: {
                    action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                    missingParameters: ['assignmentTitle'],
                    collectedParameters: { 
                      courseName: courseMatch.course.name,
                      isTodaysAssignment: false
                    }
                  }
                };
              }
            } catch (error) {
              console.error('Error validating course for submission status:', error);
              startOngoingAction(conversationId, 'CHECK_ASSIGNMENT_SUBMISSIONS', ['courseName'], {});
              return {
                message: "I encountered an error while looking up the course. Please try again.",
                conversationId: conversationId,
                ongoingAction: {
                  action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                  missingParameters: ['courseName'],
                  collectedParameters: {}
                }
              };
            }
          }
        }
        }
        
        try {
          // At this point, all parameters should be collected and validated
          let selectedCourse, courseId;
          
          // Check if user wants to check all courses
          if (parameters.checkAllCourses && parameters.courseName === 'all') {
            // Get all courses and find ones with assignments created today
            const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
            const courses = Array.isArray(coursesResponse) ? coursesResponse : (coursesResponse.courses || []);
            
            if (courses.length === 0) {
              return {
                message: "I don't see any courses available. Please create a course first or check your classroom setup.",
                conversationId: req.body.conversationId
              };
            }
            
            // Find courses with assignments created today
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            const coursesWithTodayAssignments = [];
            
            for (const course of courses) {
              try {
                const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments`, 'GET', null, userToken, req);
                const assignments = Array.isArray(assignmentsResponse) ? assignmentsResponse : [];
                
                const todayAssignments = assignments.filter(a => {
                  if (!a.creationTime) return false;
                  const creationDate = new Date(a.creationTime);
                  const creationDateStr = creationDate.toISOString().split('T')[0];
                  return creationDateStr === todayStr;
                });
                
                if (todayAssignments.length > 0) {
                  coursesWithTodayAssignments.push({
                    course: course,
                    assignments: todayAssignments
                  });
                }
              } catch (error) {
                console.log(`Error checking assignments for course ${course.name}:`, error.message);
                // Continue with other courses
              }
            }
            
            if (coursesWithTodayAssignments.length === 0) {
              // Start ongoing action to allow retry
              startOngoingAction(conversationId, 'CHECK_ASSIGNMENT_SUBMISSIONS', ['courseName'], { checkAllCourses: true });
              return {
                message: "I couldn't find any courses with assignments created today. Would you like me to:\n• Check recent assignments across all courses\n• List all available courses\n• Cancel this action\n\nPlease let me know what you'd like to do.",
                conversationId: req.body.conversationId,
                ongoingAction: {
                  action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                  missingParameters: ['courseName'],
                  collectedParameters: { checkAllCourses: true }
                },
                suggestions: ["check recent assignments", "list all courses", "cancel"]
              };
            }
            
            // Process all courses with today's assignments
            let allResults = [];
            
            for (const { course, assignments } of coursesWithTodayAssignments) {
              try {
                // Get submission details for each assignment
                const assignmentDetails = [];
                
                for (const assignment of assignments) {
                  const submissionsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments/${assignment.id}/submissions`, 'GET', null, userToken, req);
                  const submissions = Array.isArray(submissionsResponse) ? submissionsResponse : [];
                  
                  // Get student profiles
                  const studentsResponse = await makeApiCall(`${baseUrl}/api/classroom/${course.id}/students`, 'GET', null, userToken, req);
                  const students = Array.isArray(studentsResponse) ? studentsResponse : (studentsResponse.students || []);
                  
                  const userProfiles = {};
                  students.forEach(student => {
                    if (student.userId && student.profile) {
                      userProfiles[student.userId] = student.profile;
                    }
                  });
                  
                  const turnedIn = submissions.filter(s => s.state === 'TURNED_IN');
                  const notTurnedIn = submissions.filter(s => s.state !== 'TURNED_IN');
                  
                  assignmentDetails.push({
                    assignment: assignment,
                    turnedIn: turnedIn,
                    notTurnedIn: notTurnedIn,
                    userProfiles: userProfiles
                  });
                }
                
                allResults.push({
                  course: course,
                  assignmentDetails: assignmentDetails
                });
              } catch (error) {
                console.log(`Error processing course ${course.name}:`, error.message);
                // Continue with other courses
              }
            }
            
            // Format response for all courses
            let message = `📊 Assignment submissions for all courses with today's assignments:\n\n`;
            
            allResults.forEach(({ course, assignmentDetails }, courseIndex) => {
              message += `**${course.name}**\n`;
              
              assignmentDetails.forEach((details, assignmentIndex) => {
                const assignment = details.assignment;
                message += `  ${assignmentIndex + 1}. "${assignment.title}":\n`;
                message += `     ✅ Submitted (${details.turnedIn.length}):\n`;
                
                if (details.turnedIn.length > 0) {
                  message += details.turnedIn.map(s => {
                    const userId = s.userId || s.id;
                    const userProfile = details.userProfiles[userId];
                    let studentName = 'Unknown Student';
                    
                    if (userProfile && userProfile.name && userProfile.name.fullName) {
                      studentName = userProfile.name.fullName;
                    } else if (userProfile && userProfile.emailAddress) {
                      studentName = userProfile.emailAddress;
                    }
                    
                    let submissionInfo = `       • ${studentName} - ${s.state}`;
                    
                    // Add document links if available
                    if (s.assignmentSubmission && s.assignmentSubmission.attachments && s.assignmentSubmission.attachments.length > 0) {
                      const docLinks = s.assignmentSubmission.attachments.map(att => {
                        if (att.driveFile && att.driveFile.alternateLink) {
                          return `[${att.driveFile.title || 'Document'}](${att.driveFile.alternateLink})`;
                        }
                        return null;
                      }).filter(link => link !== null);
                      
                      if (docLinks.length > 0) {
                        submissionInfo += `\n         📎 Documents: ${docLinks.join(', ')}`;
                      }
                    }
                    
                    return submissionInfo;
                  }).join('\n');
                } else {
                  message += '       None\n';
                }
                
                message += `     ❌ Not Submitted (${details.notTurnedIn.length}):\n`;
                if (details.notTurnedIn.length > 0) {
                  message += details.notTurnedIn.map(s => {
                    const userId = s.userId || s.id;
                    const userProfile = details.userProfiles[userId];
                    let studentName = 'Unknown Student';
                    
                    if (userProfile && userProfile.name && userProfile.name.fullName) {
                      studentName = userProfile.name.fullName;
                    } else if (userProfile && userProfile.emailAddress) {
                      studentName = userProfile.emailAddress;
                    }
                    
                    return `       • ${studentName}`;
                  }).join('\n');
                } else {
                  message += '       None\n';
                }
                
                message += '\n';
              });
              
              if (courseIndex < allResults.length - 1) {
                message += '---\n\n';
              }
            });
            
            return {
              message: message,
              conversationId: req.body.conversationId
            };
          } else {
            // Single course logic (existing)
          const courseMatch = await findMatchingCourse(
            parameters.courseName, 
            userToken, 
            req, 
            baseUrl
          );
          
          if (!courseMatch.success) {
            // Start ongoing action to allow retry
            startOngoingAction(conversationId, 'CHECK_ASSIGNMENT_SUBMISSIONS', ['courseName'], {});
            return {
              message: `${courseMatch.message}\n\nWould you like to:\n• Try a different course name\n• List all available courses\n• Cancel this action\n\nPlease let me know what you'd like to do.`,
              conversationId: req.body.conversationId,
              ongoingAction: {
                action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                missingParameters: ['courseName'],
                collectedParameters: {}
              }
            };
          }
            
            selectedCourse = courseMatch.course;
            courseId = selectedCourse.id;
          }
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
          let matchingAssignments = [];
          
          if (parameters.isTodaysAssignment) {
            // Find assignments created today (using UTC to avoid timezone issues)
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format in UTC
            
            console.log('🔍 DEBUG: Looking for assignments created today (UTC):', todayStr);
            console.log('🔍 DEBUG: Current server time:', today.toISOString());
            
            matchingAssignments = assignments.filter(a => {
              if (!a.creationTime) return false;
              
              // Parse the creation date (already in UTC from API)
              const creationDate = new Date(a.creationTime);
              const creationDateStr = creationDate.toISOString().split('T')[0];
              
              console.log('🔍 DEBUG: Assignment creation date:', a.title, creationDateStr, 'matches today:', creationDateStr === todayStr);
              
              return creationDateStr === todayStr;
            });
            
            if (matchingAssignments.length === 0) {
              // If no assignments found for today, show recent assignments instead
              const recentAssignments = assignments
                .filter(a => a.creationTime)
                .sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime))
                .slice(0, 3); // Show last 3 assignments
              
              if (recentAssignments.length > 0) {
                const recentList = recentAssignments.map(a => {
                  const date = new Date(a.creationTime).toLocaleDateString();
                  return `• ${a.title} (${date})`;
                }).join('\n');
                
                // Start ongoing action for assignment selection
                if (conversationId) {
                  startOngoingAction(conversationId, 'CHECK_ASSIGNMENT_SUBMISSIONS', ['assignmentSelection'], {
                    courseName: selectedCourse.name,
                    isTodaysAssignment: false,
                    availableAssignments: recentAssignments
                  });
                }
                
              return {
                  message: `I couldn't find any assignments created today in ${selectedCourse.name}.\n\nRecent assignments:\n${recentList}\n\nWould you like to check submissions for one of these assignments instead?`,
                  conversationId: req.body.conversationId,
                  ongoingAction: {
                    action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                    missingParameters: ['assignmentSelection'],
                    collectedParameters: {
                      courseName: selectedCourse.name,
                      isTodaysAssignment: false,
                      availableAssignments: recentAssignments
                    }
                  },
                  suggestions: recentAssignments.map(a => `check submissions for ${a.title}`)
                };
              } else {
                return {
                  message: `I couldn't find any assignments created today in ${selectedCourse.name}. There are no assignments in this course yet.`,
                conversationId: req.body.conversationId
              };
              }
            } else if (matchingAssignments.length > 1) {
              // Start ongoing action to handle assignment selection
              if (conversationId) {
                startOngoingAction(conversationId, 'CHECK_ASSIGNMENT_SUBMISSIONS', ['assignmentSelection'], {
                  courseName: selectedCourse.name,
                  isTodaysAssignment: true,
                  availableAssignments: matchingAssignments
                });
              }
              return {
                message: `I found ${matchingAssignments.length} assignments created today in ${selectedCourse.name}. Which one would you like to check?\n\n${matchingAssignments.map((a, index) => `${index + 1}. ${a.title} (${a.creationTime ? new Date(a.creationTime).toLocaleDateString() : 'Unknown date'})`).join('\n')}\n\nYou can say the number, title, or "all" to check all assignments.`,
                conversationId: req.body.conversationId,
                ongoingAction: {
                  action: 'CHECK_ASSIGNMENT_SUBMISSIONS',
                  missingParameters: ['assignmentSelection'],
                  collectedParameters: {
                    courseName: selectedCourse.name,
                    isTodaysAssignment: true,
                    availableAssignments: matchingAssignments
                  }
                }
              };
            }
          } else {
            // Find assignments by title (original logic)
          const assignmentTitleTerm = parameters.assignmentTitle.toLowerCase();
            matchingAssignments = assignments.filter(a => a.title && a.title.toLowerCase().includes(assignmentTitleTerm));
            
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
          }
          
          // Determine which assignments to check
          let assignmentsToCheck = [];
          if (parameters.selectedAssignments) {
            // User selected specific assignments
            assignmentsToCheck = parameters.selectedAssignments;
          } else {
            // Single assignment (original logic)
            assignmentsToCheck = [matchingAssignments[0]];
          }
          
          // Process each assignment
          let allSubmissions = [];
          let assignmentDetails = [];
          
          for (const assignment of assignmentsToCheck) {
            const assignmentId = assignment.id;
            // 3. Get submissions for this assignment
            const submissions = await makeApiCall(`${baseUrl}/api/courses/${courseId}/assignments/${assignmentId}/submissions`, 'GET', null, userToken, req);
            console.log('DEBUG submissions for', assignment.title, ':', submissions);
            const submissionList = Array.isArray(submissions)
              ? submissions
              : Array.isArray(submissions.courses)
                ? submissions.courses
                : [];
            
            if (Array.isArray(submissionList)) {
              allSubmissions.push(...submissionList);
              assignmentDetails.push({
                assignment: assignment,
                submissions: submissionList,
                turnedIn: submissionList.filter(s => s.state === 'TURNED_IN' || s.state === 'RETURNED'),
                notTurnedIn: submissionList.filter(s => s.state !== 'TURNED_IN' && s.state !== 'RETURNED')
              });
            }
          }
          
          // Get user profiles for all submitted students
          const allSubmittedUserIds = [...new Set(allSubmissions.map(s => s.userId).filter(Boolean))];
          const userProfiles = {};
          
          console.log('🔍 DEBUG: All submitted user IDs:', allSubmittedUserIds);
          
          if (allSubmittedUserIds.length > 0) {
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
          
          // Build response message
          let message = '';
          if (assignmentsToCheck.length === 1) {
            const assignment = assignmentsToCheck[0];
            const details = assignmentDetails[0];
            if (parameters.isTodaysAssignment) {
              message = `Assignment submissions for "${assignment.title}" (created today) in ${selectedCourse.name}:\n`;
            } else {
              message = `Submissions for "${assignment.title}" in ${selectedCourse.name}:\n`;
            }
            message += `\n✅ Submitted (${details.turnedIn.length}):\n`;
            
            if (details.turnedIn.length > 0) {
              message += details.turnedIn.map(s => {
                const userId = s.userId || s.id;
                const userProfile = userProfiles[userId];
                let studentName = 'Unknown Student';
                let studentEmail = '';
                
                if (userProfile && userProfile.name && userProfile.name.fullName) {
                  studentName = userProfile.name.fullName;
                  studentEmail = userProfile.emailAddress || '';
                } else if (userProfile && userProfile.emailAddress) {
                  studentName = userProfile.emailAddress;
                  studentEmail = userProfile.emailAddress;
                }
                
                let submissionInfo = `• ${studentName} - ${s.state}`;
                
                // Add document links if available
                if (s.assignmentSubmission && s.assignmentSubmission.attachments && s.assignmentSubmission.attachments.length > 0) {
                  const docLinks = s.assignmentSubmission.attachments.map(att => {
                    if (att.driveFile && att.driveFile.alternateLink) {
                      return `[${att.driveFile.title || 'Document'}](${att.driveFile.alternateLink})`;
                    }
                    return null;
                  }).filter(link => link !== null);
                  
                  if (docLinks.length > 0) {
                    submissionInfo += `\n  📎 Documents: ${docLinks.join(', ')}`;
                  }
                }
                
                return submissionInfo;
              }).join('\n');
            } else {
              message += 'None';
            }
            
            message += `\n\n❌ Not Submitted (${details.notTurnedIn.length}):\n`;
            
            if (details.notTurnedIn.length > 0) {
              message += details.notTurnedIn.map(s => {
                const userId = s.userId || s.id;
                const userProfile = userProfiles[userId];
                let studentName = 'Unknown Student';
                
                if (userProfile && userProfile.name && userProfile.name.fullName) {
                  studentName = userProfile.name.fullName;
                } else if (userProfile && userProfile.emailAddress) {
                  studentName = userProfile.emailAddress;
                }
                
                return `• ${studentName}`;
              }).join('\n');
            } else {
              message += 'None';
            }
          } else {
            // Multiple assignments
            message = `Assignment submissions for all assignments created today in ${selectedCourse.name}:\n\n`;
            
            assignmentDetails.forEach((details, index) => {
              const assignment = details.assignment;
              message += `${index + 1}. "${assignment.title}" (${assignment.creationTime ? new Date(assignment.creationTime).toLocaleDateString() : 'Unknown date'}):\n`;
              message += `   Submitted: ${details.turnedIn.length} | Not Submitted: ${details.notTurnedIn.length}\n`;
              
              if (details.turnedIn.length > 0) {
                message += `   Submitted by:\n`;
                message += details.turnedIn.map(s => {
                  const userId = s.userId || s.id;
                  const userProfile = userProfiles[userId];
                  if (userProfile && userProfile.name && userProfile.name.fullName) {
                    return `     • ${userProfile.name.fullName} (${userProfile.emailAddress})`;
                  } else if (userProfile && userProfile.emailAddress) {
                    return `     • ${userProfile.emailAddress}`;
                  } else {
                    return `     • ${userId}`;
                  }
                }).join('\n');
              }
              message += '\n';
            });
          }
          
          // ✅ COMPLETE ACTION: Mark the ongoing action as completed
          if (conversationId) {
            completeOngoingAction(conversationId);
          }
          
          return {
            message,
            submissions: allSubmissions,
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
        
        // Check for missing parameters and start ongoing action if needed
        const missingParams = [];
        if (!parameters.title) missingParams.push('title');
        if (!parameters.attendees || !Array.isArray(parameters.attendees) || parameters.attendees.length === 0) missingParams.push('attendees');
        if (!parameters.dateExpr) missingParams.push('dateExpr');
        if (!parameters.timeExpr) missingParams.push('timeExpr');
        
        console.log('🔍 DEBUG: Missing parameters for meeting:', missingParams);
        
        if (missingParams.length > 0) {
          // Start ongoing action for parameter collection
          startOngoingAction(conversationId, 'CREATE_MEETING', missingParams, parameters);
          
          // Provide helpful message based on what's missing
          let message = '';
          if (missingParams.includes('dateExpr') && missingParams.includes('timeExpr')) {
            message = "I need to know when to schedule the meeting. Could you please provide the date and time? For example: 'tomorrow at 3 PM' or 'next Friday at 10 AM'.";
          } else if (missingParams.includes('dateExpr')) {
            message = "I need to know the date for the meeting. When should I schedule it? For example: 'tomorrow', 'next Friday', or 'December 15th'.";
          } else if (missingParams.includes('timeExpr')) {
            message = "I need to know the time for the meeting. What time should I schedule it for? For example: '3 PM', '9:30 AM', or 'noon'.";
          } else if (missingParams.includes('attendees')) {
            message = "Who should I invite to this meeting? Please provide at least one email address.";
          } else if (missingParams.includes('title')) {
            message = "What should I call this meeting?";
          }
          
          return {
            message: message || "I need more information to create the meeting. Please provide the missing details.",
            conversationId: conversationId,
            ongoingAction: {
              action: 'CREATE_MEETING',
              missingParameters: missingParams,
              collectedParameters: parameters
            }
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
          
          // Check for specific error types and provide helpful messages
          if (error.message.includes('Date and time are required')) {
          return {
              message: "I need both the date and time to schedule the meeting. Please provide both. For example: 'tomorrow at 3 PM' or 'next Friday at 10 AM'.",
            error: error.message,
              conversationId: conversationId
            };
          } else if (error.message.includes('date') || error.message.includes('time')) {
            return {
              message: `There was an issue with the date or time you provided. Please check and try again with a format like "tomorrow at 3 PM" or "next Friday at 10 AM". Error: ${error.message}`,
              error: error.message,
              conversationId: conversationId
            };
          }
          
          return {
            message: `I encountered an error while creating the meeting: ${error.message}. Please check your meeting details and try again. If the problem persists, try providing the date and time again in a format like "tomorrow at 3 PM".`,
            error: error.message,
            conversationId: conversationId
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
      case 'CHECK_UNSUBMITTED_ASSIGNMENTS': {
        // Only allow teachers and super_admin to check unsubmitted assignments
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to check unsubmitted assignments. Only teachers and super admins can view submission status.',
            conversationId: req.body.conversationId
          };
        }

        // Check if this action was completed through parameter collection
        if (parameters.selectedAssignments && parameters.assignmentTitle) {
          console.log('🔍 DEBUG: Action completed through parameter collection, proceeding to execution');
          // Skip parameter validation and go directly to execution
        } else {
          // Check what parameters are missing and start tracking if needed
          const missingParams = [];
          if (!parameters.courseName && !parameters.courseIdentifier) {
            missingParams.push('courseName');
          }
          if (!parameters.isTodaysAssignment && !parameters.assignmentTitle && parameters.assignmentTitle !== 'all') {
            missingParams.push('assignmentTitle');
          }

          if (missingParams.length > 0) {
            // If course name is missing, ask for it first and validate it
            if (missingParams.includes('courseName')) {
              // 🚀 START TRACKING: Start tracking this action for parameter collection
              startOngoingAction(conversationId, 'CHECK_UNSUBMITTED_ASSIGNMENTS', ['courseName'], parameters);
              
              return {
                message: "I need to know which course you want to check unsubmitted assignments for. Please provide a course name.",
                conversationId: conversationId,
                ongoingAction: {
                  action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
                  missingParameters: ['courseName'],
                  collectedParameters: parameters
                }
              };
            } else if (missingParams.includes('assignmentTitle')) {
              // Course name is provided, but assignment title is missing
              try {
                // Validate the course name first before asking for assignment title
                const courseMatch = await findMatchingCourse(
                  parameters.courseName || parameters.courseIdentifier,
                  userToken, 
                  req, 
                  baseUrl
                );
                
                if (!courseMatch.success) {
                  startOngoingAction(conversationId, 'CHECK_UNSUBMITTED_ASSIGNMENTS', ['courseName'], {});
                  return {
                    message: courseMatch.message,
                    conversationId: conversationId,
                    ongoingAction: {
                      action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
                      missingParameters: ['courseName'],
                      collectedParameters: {}
                    }
                  };
                }
                
                // Handle multiple course matches
                if (courseMatch.allMatches && courseMatch.allMatches.length > 1 && !courseMatch.isExactMatch) {
                  const courseOptions = courseMatch.allMatches.map(course => `• ${course.name}${course.section ? ` (${course.section})` : ''}`).join('\n');
                  startOngoingAction(conversationId, 'CHECK_UNSUBMITTED_ASSIGNMENTS', ['courseName'], {});
                  return {
                    message: `I found multiple courses matching "${parameters.courseName}". Which one do you mean?\n\n${courseOptions}`,
                    conversationId: conversationId,
                    ongoingAction: {
                      action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
                      missingParameters: ['courseName'],
                      collectedParameters: {}
                    }
                  };
                }
                
                // Course found and validated - ask for assignment title
                startOngoingAction(conversationId, 'CHECK_UNSUBMITTED_ASSIGNMENTS', ['assignmentTitle'], { 
                  courseName: courseMatch.course.name,
                  isTodaysAssignment: parameters.isTodaysAssignment
                });
                
                if (parameters.isTodaysAssignment) {
                  return {
                    message: `Great! I found the course "${courseMatch.course.name}". Now I'll look for unsubmitted assignments from today.`,
                    conversationId: conversationId,
                    ongoingAction: {
                      action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
                      missingParameters: ['assignmentTitle'],
                      collectedParameters: { 
                        courseName: courseMatch.course.name,
                        isTodaysAssignment: true
                      }
                    }
                  };
                } else {
                  return {
                    message: `Great! I found the course "${courseMatch.course.name}". Which assignment would you like to check for unsubmitted students?`,
                    conversationId: conversationId,
                    ongoingAction: {
                      action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
                      missingParameters: ['assignmentTitle'],
                      collectedParameters: { 
                        courseName: courseMatch.course.name,
                        isTodaysAssignment: false
                      }
                    }
                  };
                }
              } catch (error) {
                console.error('Error validating course for unsubmitted assignments:', error);
                return {
                  message: "Sorry, I encountered an error while validating the course. Please try again.",
                  conversationId: conversationId
                };
              }
            }
          }
        }
        
        try {
          // At this point, all parameters should be collected and validated
          let selectedCourse, courseId;
          
          // Check if user wants to check all courses
          if (parameters.checkAllCourses && parameters.courseName === 'all') {
            // Get all courses and find ones with assignments created today
            const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
            const courses = Array.isArray(coursesResponse) ? coursesResponse : (coursesResponse.courses || []);
            
            if (courses.length === 0) {
              return {
                message: "I don't see any courses available. Please create a course first or check your classroom setup.",
                conversationId: req.body.conversationId
              };
            }
            
            // Find courses with assignments created today
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            const coursesWithTodayAssignments = [];
            
            for (const course of courses) {
              try {
                const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments`, 'GET', null, userToken, req);
                const assignments = Array.isArray(assignmentsResponse) ? assignmentsResponse : [];
                
                const todayAssignments = assignments.filter(a => {
                  if (!a.creationTime) return false;
                  const creationDate = new Date(a.creationTime);
                  const creationDateStr = creationDate.toISOString().split('T')[0];
                  return creationDateStr === todayStr;
                });
                
                if (todayAssignments.length > 0) {
                  coursesWithTodayAssignments.push({
                    course: course,
                    assignments: todayAssignments
                  });
                }
              } catch (error) {
                console.log(`Error checking assignments for course ${course.name}:`, error.message);
                // Continue with other courses
              }
            }
            
            if (coursesWithTodayAssignments.length === 0) {
              // Start ongoing action to allow retry
              startOngoingAction(conversationId, 'CHECK_UNSUBMITTED_ASSIGNMENTS', ['courseName'], { checkAllCourses: true });
              return {
                message: "I couldn't find any courses with assignments created today. Would you like me to:\n• Check recent assignments across all courses\n• List all available courses\n• Cancel this action\n\nPlease let me know what you'd like to do.",
                conversationId: req.body.conversationId,
                ongoingAction: {
                  action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
                  missingParameters: ['courseName'],
                  collectedParameters: { checkAllCourses: true }
                },
                suggestions: ["check recent assignments", "list all courses", "cancel"]
              };
            }
            
            // Process all courses with today's assignments
            let allResults = [];
            
            for (const { course, assignments } of coursesWithTodayAssignments) {
              try {
                // Get submission details for each assignment
                const assignmentDetails = [];
                
                for (const assignment of assignments) {
                  const submissionsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments/${assignment.id}/submissions`, 'GET', null, userToken, req);
                  const submissions = Array.isArray(submissionsResponse) ? submissionsResponse : [];
                  
                  // Get student profiles
                  const studentsResponse = await makeApiCall(`${baseUrl}/api/classroom/${course.id}/students`, 'GET', null, userToken, req);
                  const students = Array.isArray(studentsResponse) ? studentsResponse : (studentsResponse.students || []);
                  
                  const userProfiles = {};
                  students.forEach(student => {
                    if (student.userId && student.profile) {
                      userProfiles[student.userId] = student.profile;
                    }
                  });
                  
                  const turnedIn = submissions.filter(s => s.state === 'TURNED_IN');
                  const notTurnedIn = submissions.filter(s => s.state !== 'TURNED_IN');
                  
                  assignmentDetails.push({
                    assignment: assignment,
                    turnedIn: turnedIn,
                    notTurnedIn: notTurnedIn,
                    userProfiles: userProfiles
                  });
                }
                
                allResults.push({
                  course: course,
                  assignmentDetails: assignmentDetails
                });
              } catch (error) {
                console.log(`Error processing course ${course.name}:`, error.message);
                // Continue with other courses
              }
            }
            
            // Format response for all courses - improved formatting
            let message = `📊 **Unsubmitted Assignments Report - All Courses (Today's Assignments)**\n\n`;
            
            allResults.forEach(({ course, assignmentDetails }, courseIndex) => {
              message += `🎓 **${course.name}**\n`;
              message += '='.repeat(50) + '\n\n';
              
              assignmentDetails.forEach((details, assignmentIndex) => {
                const assignment = details.assignment;
                const totalStudents = details.turnedIn.length + details.notTurnedIn.length;
                const submittedCount = details.turnedIn.length;
                const notSubmittedCount = details.notTurnedIn.length;
                
                message += `**${assignmentIndex + 1}. ${assignment.title}**\n`;
                message += `📈 Progress: ${submittedCount}/${totalStudents} students submitted (${Math.round((submittedCount/totalStudents)*100)}%)\n\n`;
                
                if (details.notTurnedIn.length > 0) {
                  message += `❌ **Not Submitted (${notSubmittedCount} students):**\n`;
                  details.notTurnedIn.forEach((s, studentIndex) => {
                    const userId = s.userId || s.id;
                    const userProfile = details.userProfiles[userId];
                    let studentName = 'Unknown Student';
                    
                    if (userProfile && userProfile.name && userProfile.name.fullName) {
                      studentName = userProfile.name.fullName;
                    } else if (userProfile && userProfile.emailAddress) {
                      studentName = userProfile.emailAddress;
                    }
                    
                    message += `   ${studentIndex + 1}. ${studentName}\n`;
                  });
                } else {
                  message += `✅ **All students have submitted this assignment!**\n`;
                }
                
                message += '\n' + '─'.repeat(40) + '\n\n';
              });
              
              if (courseIndex < allResults.length - 1) {
                message += '\n' + '═'.repeat(60) + '\n\n';
              }
            });
            
            return {
              message: message,
              conversationId: req.body.conversationId
            };
          } else {
            // Single course logic (similar to CHECK_ASSIGNMENT_SUBMISSIONS but focused on unsubmitted)
            const courseMatch = await findMatchingCourse(
              parameters.courseName, 
              userToken, 
              req, 
              baseUrl
            );
            
            if (!courseMatch.success) {
              // Start ongoing action to allow retry
              startOngoingAction(conversationId, 'CHECK_UNSUBMITTED_ASSIGNMENTS', ['courseName'], {});
              return {
                message: `${courseMatch.message}\n\nWould you like to:\n• Try a different course name\n• List all available courses\n• Cancel this action\n\nPlease let me know what you'd like to do.`,
                conversationId: req.body.conversationId,
                ongoingAction: {
                  action: 'CHECK_UNSUBMITTED_ASSIGNMENTS',
                  missingParameters: ['courseName'],
                  collectedParameters: {}
                }
              };
            }
            
            selectedCourse = courseMatch.course;
            courseId = selectedCourse.id;
          }
          
          // Get assignments for the course
          const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${courseId}/assignments`, 'GET', null, userToken, req);
          const assignments = Array.isArray(assignmentsResponse) ? assignmentsResponse : [];
          
          if (!Array.isArray(assignments) || assignments.length === 0) {
            return {
              message: "I couldn't retrieve assignments for that course.",
              conversationId: req.body.conversationId
            };
          }
          
          let matchingAssignments = [];
          
          if (parameters.isTodaysAssignment) {
            // Find assignments created today
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            matchingAssignments = assignments.filter(a => {
              if (!a.creationTime) return false;
              const creationDate = new Date(a.creationTime);
              const creationDateStr = creationDate.toISOString().split('T')[0];
              return creationDateStr === todayStr;
            });
            
            if (matchingAssignments.length === 0) {
              return {
                message: `I couldn't find any assignments created today in ${selectedCourse.name}.`,
                conversationId: req.body.conversationId
              };
            }
          } else if (parameters.assignmentTitle) {
            // Check if user wants all assignments
            if (parameters.assignmentTitle === 'all') {
              console.log('🔍 DEBUG: User wants all assignments, using all assignments');
              matchingAssignments = assignments;
            } else {
              // Find assignment by title
              matchingAssignments = assignments.filter(a => 
                a.title.toLowerCase().includes(parameters.assignmentTitle.toLowerCase())
              );
              
              if (matchingAssignments.length === 0) {
                return {
                  message: `I couldn't find any assignments matching "${parameters.assignmentTitle}" in ${selectedCourse.name}.`,
                  conversationId: req.body.conversationId
                };
              }
            }
          } else {
            // No specific assignment - show all assignments with unsubmitted students
            matchingAssignments = assignments;
          }
          
          // Get submission details for each assignment
          const assignmentDetails = [];
          
          for (const assignment of matchingAssignments) {
            try {
              const submissionsResponse = await makeApiCall(`${baseUrl}/api/courses/${courseId}/assignments/${assignment.id}/submissions`, 'GET', null, userToken, req);
              const submissions = Array.isArray(submissionsResponse) ? submissionsResponse : [];
              
              // Get student profiles
              const studentsResponse = await makeApiCall(`${baseUrl}/api/classroom/${courseId}/students`, 'GET', null, userToken, req);
              const students = Array.isArray(studentsResponse) ? studentsResponse : (studentsResponse.students || []);
              
              const userProfiles = {};
              students.forEach(student => {
                if (student.userId && student.profile) {
                  userProfiles[student.userId] = student.profile;
                }
              });
              
              const turnedIn = submissions.filter(s => s.state === 'TURNED_IN');
              const notTurnedIn = submissions.filter(s => s.state !== 'TURNED_IN');
              
              assignmentDetails.push({
                assignment: assignment,
                turnedIn: turnedIn,
                notTurnedIn: notTurnedIn,
                userProfiles: userProfiles
              });
            } catch (error) {
              console.log(`Error getting submissions for assignment ${assignment.title}:`, error.message);
              // Continue with other assignments
            }
          }
          
          // Format response - focus on unsubmitted students
          let message = '';
          if (matchingAssignments.length === 1) {
            const assignment = matchingAssignments[0];
            const details = assignmentDetails[0];
            const totalStudents = details.turnedIn.length + details.notTurnedIn.length;
            const submittedCount = details.turnedIn.length;
            const notSubmittedCount = details.notTurnedIn.length;
            
            if (parameters.isTodaysAssignment) {
              message = `📊 **Assignment Submission Report**\n\n`;
              message += `**Assignment:** ${assignment.title}\n`;
              message += `**Course:** ${selectedCourse.name}\n`;
              message += `**Created:** Today\n\n`;
            } else {
              message = `📊 **Assignment Submission Report**\n\n`;
              message += `**Assignment:** ${assignment.title}\n`;
              message += `**Course:** ${selectedCourse.name}\n\n`;
            }
            
            message += `📈 **Progress:** ${submittedCount}/${totalStudents} students submitted (${Math.round((submittedCount/totalStudents)*100)}%)\n\n`;
            
            if (details.notTurnedIn.length > 0) {
              message += `❌ **Not Submitted (${notSubmittedCount} students):**\n\n`;
              details.notTurnedIn.forEach((s, index) => {
                const userId = s.userId || s.id;
                const userProfile = details.userProfiles[userId];
                let studentName = 'Unknown Student';
                
                if (userProfile && userProfile.name && userProfile.name.fullName) {
                  studentName = userProfile.name.fullName;
                } else if (userProfile && userProfile.emailAddress) {
                  studentName = userProfile.emailAddress;
                }
                
                message += `   ${index + 1}. ${studentName}\n`;
              });
            } else {
              message += `✅ **All students have submitted this assignment!**\n`;
            }
          } else {
            // Multiple assignments - improved formatting
            message = `📊 **Unsubmitted Assignments Report for ${selectedCourse.name}**\n\n`;
            
            assignmentDetails.forEach((details, index) => {
              const assignment = details.assignment;
              const totalStudents = details.turnedIn.length + details.notTurnedIn.length;
              const submittedCount = details.turnedIn.length;
              const notSubmittedCount = details.notTurnedIn.length;
              
              message += `**${index + 1}. ${assignment.title}**\n`;
              message += `📈 Progress: ${submittedCount}/${totalStudents} students submitted (${Math.round((submittedCount/totalStudents)*100)}%)\n\n`;
              
              if (details.notTurnedIn.length > 0) {
                message += `❌ **Not Submitted (${notSubmittedCount} students):**\n`;
                details.notTurnedIn.forEach((s, studentIndex) => {
                  const userId = s.userId || s.id;
                  const userProfile = details.userProfiles[userId];
                  let studentName = 'Unknown Student';
                  
                  if (userProfile && userProfile.name && userProfile.name.fullName) {
                    studentName = userProfile.name.fullName;
                  } else if (userProfile && userProfile.emailAddress) {
                    studentName = userProfile.emailAddress;
                  }
                  
                  message += `   ${studentIndex + 1}. ${studentName}\n`;
                });
              } else {
                message += `✅ **All students have submitted this assignment!**\n`;
              }
              
              message += '\n' + '─'.repeat(50) + '\n\n';
            });
          }
          
          // Complete the ongoing action after showing results
          if (conversationId) {
            completeOngoingAction(conversationId);
            console.log('✅ DEBUG: Completed CHECK_UNSUBMITTED_ASSIGNMENTS action - conversation context cleared');
          }
          
          return {
            message: message,
            conversationId: req.body.conversationId
          };
          
        } catch (error) {
          console.error('Error in CHECK_UNSUBMITTED_ASSIGNMENTS:', error);
          return {
            message: "Sorry, I encountered an error while checking unsubmitted assignments. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }

      case 'HIGHLIGHT_MISSING_WORK_STUDENTS': {
        // Only allow teachers and super_admin to highlight missing work students
        if (userRole !== 'teacher' && userRole !== 'super_admin') {
          return {
            message: 'You are not authorized to view student performance data. Only teachers and super admins can access this information.',
            conversationId: req.body.conversationId
          };
        }

        try {
          console.log('🔍 DEBUG: Starting cross-course analysis for missing work students');
          
          // Get all courses
          const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
          const courses = Array.isArray(coursesResponse) ? coursesResponse : (coursesResponse.courses || []);
          
          if (courses.length === 0) {
            return {
              message: "I don't see any courses available. Please create a course first or check your classroom setup.",
              conversationId: req.body.conversationId
            };
          }
          
          console.log(`🔍 DEBUG: Analyzing ${courses.length} courses for missing work students`);
          
          // Analyze each course for missing work
          const courseAnalysis = [];
          const studentMissingWork = new Map(); // studentId -> { studentInfo, missingAssignments: [] }
          
          for (const course of courses) {
            try {
              console.log(`🔍 DEBUG: Analyzing course: ${course.name}`);
              
              // Get assignments for this course
              const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments`, 'GET', null, userToken, req);
              const assignments = Array.isArray(assignmentsResponse) ? assignmentsResponse : [];
              
              if (assignments.length === 0) {
                console.log(`🔍 DEBUG: No assignments found in ${course.name}`);
                continue;
              }
              
              // Get students for this course
              const studentsResponse = await makeApiCall(`${baseUrl}/api/classroom/${course.id}/students`, 'GET', null, userToken, req);
              const students = Array.isArray(studentsResponse) ? studentsResponse : (studentsResponse.students || []);
              
              if (students.length === 0) {
                console.log(`🔍 DEBUG: No students found in ${course.name}`);
                continue;
              }
              
              // Create user profiles map
              const userProfiles = {};
              students.forEach(student => {
                if (student.userId && student.profile) {
                  userProfiles[student.userId] = student.profile;
                }
              });
              
              // Analyze each assignment
              for (const assignment of assignments) {
                try {
                  const submissionsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments/${assignment.id}/submissions`, 'GET', null, userToken, req);
                  const submissions = Array.isArray(submissionsResponse) ? submissionsResponse : [];
                  
                  // Find students who haven't submitted
                  const notTurnedIn = submissions.filter(s => s.state !== 'TURNED_IN');
                  
                  notTurnedIn.forEach(submission => {
                    const userId = submission.userId || submission.id;
                    const userProfile = userProfiles[userId];
                    
                    if (userProfile) {
                      let studentName = 'Unknown Student';
                      let studentEmail = '';
                      
                      if (userProfile.name && userProfile.name.fullName) {
                        studentName = userProfile.name.fullName;
                        studentEmail = userProfile.emailAddress || '';
                      } else if (userProfile.emailAddress) {
                        studentName = userProfile.emailAddress;
                        studentEmail = userProfile.emailAddress;
                      }
                      
                      // Initialize student data if not exists
                      if (!studentMissingWork.has(userId)) {
                        studentMissingWork.set(userId, {
                          studentInfo: {
                            name: studentName,
                            email: studentEmail,
                            userId: userId
                          },
                          missingAssignments: []
                        });
                      }
                      
                      // Add missing assignment
                      studentMissingWork.get(userId).missingAssignments.push({
                        courseName: course.name,
                        courseId: course.id,
                        assignmentTitle: assignment.title,
                        assignmentId: assignment.id,
                        dueDate: assignment.dueDate,
                        maxPoints: assignment.maxPoints
                      });
                    }
                  });
                  
                } catch (error) {
                  console.log(`Error analyzing assignment ${assignment.title} in ${course.name}:`, error.message);
                  // Continue with other assignments
                }
              }
              
            } catch (error) {
              console.log(`Error analyzing course ${course.name}:`, error.message);
              // Continue with other courses
            }
          }
          
          // Convert map to array and sort by number of missing assignments
          const studentsWithMissingWork = Array.from(studentMissingWork.values())
            .filter(student => student.missingAssignments.length > 0)
            .sort((a, b) => b.missingAssignments.length - a.missingAssignments.length);
          
          if (studentsWithMissingWork.length === 0) {
            return {
              message: "🎉 **Great News!**\n\nAll students are up to date with their assignments across all courses. No missing work found!",
              conversationId: req.body.conversationId
            };
          }
          
          // Format the comprehensive report
          let message = `🚨 **Students with Missing Work - Cross-Course Analysis**\n\n`;
          message += `📊 **Summary:** ${studentsWithMissingWork.length} students have missing assignments across ${courses.length} courses\n\n`;
          message += '='.repeat(60) + '\n\n';
          
          studentsWithMissingWork.forEach((student, index) => {
            const missingCount = student.missingAssignments.length;
            const riskLevel = missingCount >= 5 ? '🔴 HIGH RISK' : missingCount >= 3 ? '🟡 MEDIUM RISK' : '🟢 LOW RISK';
            
            message += `**${index + 1}. ${student.studentInfo.name}** ${riskLevel}\n`;
            message += `📧 Email: ${student.studentInfo.email}\n`;
            message += `📉 Missing Assignments: ${missingCount}\n\n`;
            
            // Group missing assignments by course
            const assignmentsByCourse = {};
            student.missingAssignments.forEach(assignment => {
              if (!assignmentsByCourse[assignment.courseName]) {
                assignmentsByCourse[assignment.courseName] = [];
              }
              assignmentsByCourse[assignment.courseName].push(assignment);
            });
            
            // List missing assignments by course
            Object.entries(assignmentsByCourse).forEach(([courseName, assignments]) => {
              message += `   🎓 **${courseName}** (${assignments.length} missing):\n`;
              assignments.forEach(assignment => {
                const dueDateStr = assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date';
                const pointsStr = assignment.maxPoints ? ` (${assignment.maxPoints} pts)` : '';
                message += `      • ${assignment.assignmentTitle} - Due: ${dueDateStr}${pointsStr}\n`;
              });
              message += '\n';
            });
            
            message += '─'.repeat(50) + '\n\n';
          });
          
          // Add summary statistics
          const totalMissingAssignments = studentsWithMissingWork.reduce((sum, student) => sum + student.missingAssignments.length, 0);
          const highRiskStudents = studentsWithMissingWork.filter(s => s.missingAssignments.length >= 5).length;
          const mediumRiskStudents = studentsWithMissingWork.filter(s => s.missingAssignments.length >= 3 && s.missingAssignments.length < 5).length;
          const lowRiskStudents = studentsWithMissingWork.filter(s => s.missingAssignments.length < 3).length;
          
          message += `📈 **Summary Statistics:**\n`;
          message += `• Total Missing Assignments: ${totalMissingAssignments}\n`;
          message += `• High Risk Students (5+ missing): ${highRiskStudents}\n`;
          message += `• Medium Risk Students (3-4 missing): ${mediumRiskStudents}\n`;
          message += `• Low Risk Students (1-2 missing): ${lowRiskStudents}\n\n`;
          message += `💡 **Recommendation:** Focus on high-risk students first and consider reaching out to provide additional support.`;
          
          return {
            message: message,
            conversationId: req.body.conversationId
          };
          
        } catch (error) {
          console.error('Error in HIGHLIGHT_MISSING_WORK_STUDENTS:', error);
          return {
            message: "Sorry, I encountered an error while analyzing student performance across courses. Please try again.",
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
      
      case 'PROCEED_WITH_AVAILABLE_INFO': {
        // Handle user wanting to proceed with available information
        if (conversationId) {
          const context = getOngoingActionContext(conversationId);
          if (context) {
            // Complete the ongoing action and proceed with what we have
            completeOngoingAction(conversationId);
            return {
              message: "I'll proceed with the available information. Let me know if you need anything else!",
              conversationId: conversationId
            };
          } else {
            return {
              message: "I don't have any ongoing actions to proceed with. What would you like me to help you with?",
              conversationId: conversationId
            };
          }
        }
        return {
          message: "I don't have any ongoing actions to proceed with. What would you like me to help you with?",
          conversationId: conversationId
        };
      }
      
      default:
        console.log('❌ DEBUG: No matching case found for intent:', intent);
        console.log('🔍 DEBUG: Available cases: LIST_COURSES, CREATE_COURSE, LIST_ASSIGNMENTS, CREATE_ANNOUNCEMENT, GET_ANNOUNCEMENTS, GET_COURSE, CREATE_ASSIGNMENT, INVITE_STUDENTS, INVITE_TEACHERS, PROVIDE_MATERIALS, HELP, CHECK_ASSIGNMENT_SUBMISSIONS, CHECK_UNSUBMITTED_ASSIGNMENTS, HIGHLIGHT_MISSING_WORK_STUDENTS, GRADE_ASSIGNMENT, CREATE_MEETING, SHOW_ENROLLED_STUDENTS, READ_EMAIL, SEND_EMAIL, PROCEED_WITH_AVAILABLE_INFO, CANCEL_ACTION');
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

/**
 * Handle educational/academic questions using AI
 */
async function handleEducationalQuestion(question, conversationId) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    
    // Initialize Gemini Flash
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Create a focused prompt for educational questions
    const prompt = `
      You are an educational AI assistant. Provide a SHORT, concise answer to the academic question.
      
      REQUIREMENTS:
      - Keep response under 150 words
      - Use **bold** for key terms only
      - Use • for brief bullet points
      - Be direct and to the point
      - No unnecessary examples or lengthy explanations
      - Focus on the core concept only
      
      Question: "${question}"
      
      Give a brief, educational answer. Be concise.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    console.log('🔍 DEBUG: Raw AI response for educational question:', response);

    return {
      message: response,
      conversationId: conversationId
    };
  } catch (error) {
    console.error('Error handling educational question:', error);
    return {
      message: "I'm sorry, I encountered an error while trying to answer your educational question. Please try again or rephrase your question.",
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
      
      message += `${courseNumber}. ${course.name}${section}\n`;
    });


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
        message += `• **Classroom Link:** [Open Classroom](${course.alternateLink})\n`;
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