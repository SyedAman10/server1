const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getLastMessage, getLastMessages } = require('./conversationManager');

// Initialize Gemini Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Simple intent detection based on keywords
 * This is a fallback when the Gemini API is not available
 */
function detectIntentFallback(message, conversationId) {
  const lowerMessage = message.toLowerCase();
  const lastMessage = conversationId ? getLastMessage(conversationId) : null;
  const lastMessages = conversationId ? getLastMessages(conversationId, 3) : [];
  
  // Show enrolled students
  if (
    (lowerMessage.includes('show') || lowerMessage.includes('list')) && lowerMessage.includes('students') || lowerMessage.includes('enrolled students')
  ) {
    // Extract course name
    let courseName = '';
    const courseMatch = message.match(/in\s+([\w\s-]+)/i);
    if (courseMatch && courseMatch[1]) {
      courseName = courseMatch[1].trim();
    }
    return {
      intent: 'SHOW_ENROLLED_STUDENTS',
      confidence: 0.9,
      parameters: {
        ...(courseName ? { courseName } : {})
      }
    };
  }
  
  // Course listing
  if (lowerMessage.includes('list') || lowerMessage.includes('show') || lowerMessage.includes('get all')) {
    if (lowerMessage.includes('course')) {
      return {
        intent: 'LIST_COURSES',
        confidence: 0.8,
        parameters: {}
      };
    }
  }
  
  // Get specific course
  if (lowerMessage.includes('tell me about') || lowerMessage.includes('show details') || lowerMessage.includes('get course')) {
    return {
      intent: 'GET_COURSE',
      confidence: 0.7,
      parameters: {
        courseName: message.split('about')[1]?.trim() || message.split('details for')[1]?.trim()
      }
    };
  }
  
  // Create course
  if (lowerMessage.includes('create') || lowerMessage.includes('make') || lowerMessage.includes('new course')) {
    return {
      intent: 'CREATE_COURSE',
      confidence: 0.7,
      parameters: {
        name: message.split('called')[1]?.trim() || message.split('named')[1]?.trim()
      }
    };
  }
  
  // View announcements - MUST come BEFORE CREATE_ANNOUNCEMENT to prevent false positives
  if ((lowerMessage.includes('show') || lowerMessage.includes('view') || lowerMessage.includes('list') || lowerMessage.includes('get')) && 
      (lowerMessage.includes('announcement') || lowerMessage.includes('announcements'))) {
    
    // Extract course name
    let courseName = '';
    if (lowerMessage.includes('in')) {
      const parts = message.split('in');
      if (parts.length >= 2) {
        courseName = parts[1].split(/\s+/).slice(0, -1).join(' ').trim();
      }
    } else if (lowerMessage.includes('for')) {
      const parts = message.split('for');
      if (parts.length >= 2) {
        courseName = parts[1].split(/\s+/).slice(0, -1).join(' ').trim();
      }
    } else if (lowerMessage.includes('on')) {
      const parts = message.split('on');
      if (parts.length >= 2) {
        courseName = parts[1].split(/\s+/).slice(0, -1).join(' ').trim();
      }
    }
    
    // If no course name found, check conversation history
    if (!courseName && lastMessage) {
      const lastContent = typeof lastMessage.content === 'object' ? lastMessage.content.text : lastMessage.content;
      if (lastContent && lastContent.toLowerCase().includes('course')) {
        const lastWords = lastContent.split(/\s+/);
        const courseIndex = lastWords.findIndex(w => w.toLowerCase().includes('course'));
        if (courseIndex !== -1 && courseIndex > 0) {
          courseName = lastWords[courseIndex - 1].trim();
        }
      }
    }
    
    return {
      intent: 'GET_ANNOUNCEMENTS',
      confidence: 0.8,
      parameters: {
        courseName: courseName.replace(/course$/i, '').trim()
      }
    };
  }
  
  // Create announcement - MUST come AFTER GET_ANNOUNCEMENTS and be more specific
  if ((lowerMessage.includes('create') || lowerMessage.includes('make') || lowerMessage.includes('post')) && 
      (lowerMessage.includes('announcement') || lowerMessage.includes('announce'))) {
    // Extract course name and announcement text
    let courseName = '';
    let announcementText = '';
    
    // Try different patterns
    if (lowerMessage.includes('in')) {
      const parts = message.split('in');
      if (parts.length >= 2) {
        announcementText = parts[0].replace(/create|announcement|announce|post/gi, '').trim();
        courseName = parts[1].split(/\s+/).slice(0, -1).join(' ').trim(); // Remove the last word (usually "course")
      }
    } else if (lowerMessage.includes('for')) {
      const parts = message.split('for');
      if (parts.length >= 2) {
        announcementText = parts[0].replace(/create|announcement|announce|post/gi, '').trim();
        courseName = parts[1].split(/\s+/).slice(0, -1).join(' ').trim();
      }
    } else {
      // If no clear pattern, try to extract the last part as announcement text
      const words = message.split(/\s+/);
      const announcementIndex = words.findIndex(w => 
        w.toLowerCase().includes('announcement') || 
        w.toLowerCase().includes('announce') || 
        w.toLowerCase().includes('post')
      );
      
      if (announcementIndex !== -1) {
        announcementText = words.slice(announcementIndex + 1).join(' ').trim();
        // Try to find course name before the announcement word
        const beforeAnnouncement = words.slice(0, announcementIndex).join(' ');
        if (beforeAnnouncement.includes('in') || beforeAnnouncement.includes('for')) {
          courseName = beforeAnnouncement.split(/in|for/)[1]?.trim() || '';
        }
      }
    }

    // If no course name found, check conversation history
    if (!courseName && lastMessage) {
      const lastContent = typeof lastMessage.content === 'object' ? lastMessage.content.text : lastMessage.content;
      if (lastContent && lastContent.toLowerCase().includes('course')) {
        // Try to extract course name from last message
        const lastWords = lastContent.split(/\s+/);
        const courseIndex = lastWords.findIndex(w => w.toLowerCase().includes('course'));
        if (courseIndex !== -1 && courseIndex > 0) {
          courseName = lastWords[courseIndex - 1].trim();
        }
      }
    }

    return {
      intent: 'CREATE_ANNOUNCEMENT',
      confidence: 0.7,
      parameters: {
        courseName: courseName.replace(/course$/i, '').trim(), // Remove trailing "course" word
        announcementText: announcementText
      }
    };
  }
  
  // Create assignment
  if (lowerMessage.includes('assignment') || lowerMessage.includes('homework')) {
    // Extract title
    const title = message.split('titled')[1]?.split('due')[0]?.trim();

    // Extract Google Drive file names (support multiple, comma or 'and' separated)
    let materials = [];
    // Match patterns like: with file(s) X, Y and Z from Google Drive
    const fileSectionMatch = message.match(/(?:with|attach|including)\s+(?:file[s]?\s+)?([\w\s.,'"-]+)(?:\s+from\s+google\s+drive)?/i);
    if (fileSectionMatch && fileSectionMatch[1]) {
      // Split by comma or 'and'
      const fileNames = fileSectionMatch[1]
        .split(/,| and /i)
        .map(f => f.replace(/['"]/g, '').trim())
        .filter(f => f.length > 0);
      materials = fileNames.map(name => ({
        title: name,
        type: 'GOOGLE_DRIVE'
      }));
    }

    // Extract course name from 'in course X', 'for course X', or 'in X'
    let courseName = '';
    const courseMatch = message.match(/(?:in|for)\s+(?:course\s+)?([\w\s-]+)/i);
    if (courseMatch && courseMatch[1]) {
      courseName = courseMatch[1].trim();
    }

    return {
      intent: 'CREATE_ASSIGNMENT',
      confidence: 0.7,
      parameters: {
        title,
        ...(materials.length > 0 ? { materials } : {}),
        ...(courseName ? { courseName } : {})
      }
    };
  }
  
  // Invite students or teachers
  if (lowerMessage.includes('invite') || lowerMessage.includes('add')) {
    // Extract email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = message.match(emailRegex) || [];
    
    // Determine if it's a teacher invitation
    const isTeacherInvite = lowerMessage.includes('teacher') || lowerMessage.includes('professor') || lowerMessage.includes('instructor');
    
    // Extract course name/identifier
    let courseName = '';
    if (lowerMessage.includes('to')) {
      const parts = message.split('to');
      if (parts.length >= 2) {
        courseName = parts[1].split(/\s+/).slice(0, -1).join(' ').trim(); // Remove the last word (usually "class" or "course")
      }
    } else if (lowerMessage.includes('on')) {
      const parts = message.split('on');
      if (parts.length >= 2) {
        courseName = parts[1].split(/\s+/).slice(0, -1).join(' ').trim(); // Remove the last word (usually "class" or "course")
      }
    }

    // If no course name found, check conversation history
    if (!courseName && lastMessage) {
      const lastContent = typeof lastMessage.content === 'object' ? lastMessage.content.text : lastMessage.content;
      if (lastContent && lastContent.toLowerCase().includes('course')) {
        // Try to extract course name from last message
        const lastWords = lastContent.split(/\s+/);
        const courseIndex = lastWords.findIndex(w => w.toLowerCase().includes('course'));
        if (courseIndex !== -1 && courseIndex > 0) {
          courseName = lastWords[courseIndex - 1].trim();
        }
      }
    }

    return {
      intent: isTeacherInvite ? 'INVITE_TEACHERS' : 'INVITE_STUDENTS',
      confidence: 0.8,
      parameters: isTeacherInvite ? {
        courseName: courseName.replace(/class$|course$/i, '').trim(),
        emails: emails
      } : {
        courseName: courseName.replace(/class$|course$/i, '').trim(),
        studentEmails: emails
      }
    };
  }
  
  // Help
  if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
    return {
      intent: 'HELP',
      confidence: 0.9,
      parameters: {}
    };
  }
  
  // Check assignment submissions
  if (
    (lowerMessage.includes('who') && lowerMessage.includes('submit')) ||
    lowerMessage.includes('assignment submissions') ||
    lowerMessage.includes('show submissions') ||
    lowerMessage.includes('view submissions') ||
    lowerMessage.includes('see submissions')
  ) {
    // Try to extract assignment title and course name
    let assignmentTitle = '';
    let courseName = '';
    // e.g. "who has submitted assignment test 2 in sql"
    const assignmentMatch = message.match(/assignment\s+([\w\s-]+)/i);
    if (assignmentMatch && assignmentMatch[1]) {
      assignmentTitle = assignmentMatch[1].trim();
    }
    const courseMatch = message.match(/in\s+([\w\s-]+)/i);
    if (courseMatch && courseMatch[1]) {
      courseName = courseMatch[1].trim();
    }
    return {
      intent: 'CHECK_ASSIGNMENT_SUBMISSIONS',
      confidence: 0.8,
      parameters: {
        ...(assignmentTitle ? { assignmentTitle } : {}),
        ...(courseName ? { courseName } : {})
      }
    };
  }
  
  // Grade assignment
  if (
    lowerMessage.includes('grade') && lowerMessage.includes('assignment') && lowerMessage.match(/student|for|on/)
  ) {
    // Extract student email or name
    let studentEmail = '';
    let assignedGrade = undefined;
    let draftGrade = undefined;
    let assignmentTitle = '';
    let courseName = '';

    // Try to extract email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = message.match(emailRegex);
    if (emails && emails.length > 0) {
      studentEmail = emails[0];
    } else {
      // Try to extract student name (e.g., 'grade student John Doe')
      const studentMatch = message.match(/student\s+([\w\s]+)/i);
      if (studentMatch && studentMatch[1]) {
        studentEmail = studentMatch[1].trim();
      }
    }

    // Extract grade (e.g., 'to 95', 'set grade 88', 'grade 100')
    const gradeMatch = message.match(/(?:to|grade|set grade)\s*(\d{1,3})/i);
    if (gradeMatch && gradeMatch[1]) {
      assignedGrade = parseInt(gradeMatch[1], 10);
    }

    // Extract assignment title
    const assignmentMatch = message.match(/assignment\s+([\w\s-]+)/i);
    if (assignmentMatch && assignmentMatch[1]) {
      assignmentTitle = assignmentMatch[1].trim();
    }

    // Extract course name
    const courseMatch = message.match(/in\s+([\w\s-]+)/i);
    if (courseMatch && courseMatch[1]) {
      courseName = courseMatch[1].trim();
    }

    return {
      intent: 'GRADE_ASSIGNMENT',
      confidence: 0.9,
      parameters: {
        ...(courseName ? { courseName } : {}),
        ...(assignmentTitle ? { assignmentTitle } : {}),
        ...(studentEmail ? { studentEmail } : {}),
        ...(assignedGrade !== undefined ? { assignedGrade } : {})
      }
    };
  }
  
  // Default to unknown
  return {
    intent: 'UNKNOWN',
    confidence: 0.5,
    parameters: {}
  };
}

/**
 * Detect the user's intent using Google's Gemini Flash API
 */
async function detectIntent(message, conversationHistory, conversationId) {
  try {
    // Format conversation history for Gemini
    const formattedHistory = conversationHistory
      .filter(entry => typeof entry === 'object' && 'isUser' in entry && 'message' in entry)
      .map(entry => ({
        role: entry.isUser ? 'user' : 'model',
        parts: [{ text: typeof entry.message === 'string' ? entry.message : JSON.stringify(entry.message) }]
      }));

    // Create a new chat session
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      }
    });

    // Construct history context for better intent detection
    let historyContext = '';
    if (formattedHistory.length > 0) {
      historyContext = `
        Previous conversation context:
        ${formattedHistory.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.parts[0].text}`).join('\n')}
        
        Consider the conversation history above when determining the user's intent. The user may be referring to entities mentioned earlier in the conversation.
      `;
    }

    // Structure prompt to classify the intent
    const prompt = `
      Act as an intent classifier for a classroom management system.
      Classify the following message into one of these intents:
      - LIST_COURSES: User wants to see their courses
      - GET_COURSE: User wants details about a specific course (extract courseId if possible)
      - CREATE_COURSE: User wants to create a new course (extract course details if provided)
      - CREATE_COURSE_CONTENT: User wants to create course content or materials (extract topic and details)
      - UPDATE_COURSE: User wants to update a course (extract courseId and details)
      - DELETE_COURSE: User wants to delete a course (extract courseId)
      - ARCHIVE_COURSE: User wants to archive a course (extract courseId)
      - INVITE_STUDENTS: User wants to invite students to a course (extract courseId and student emails)
      - CREATE_ANNOUNCEMENT: User wants to create an announcement in a course (extract courseId and announcement text)
      - GET_ANNOUNCEMENTS: User wants to view/list announcements for a course (extract courseId/courseName)
      - CREATE_ASSIGNMENT: User wants to create an assignment in a course (extract courseId, title, description, due date, and materials)
      - CHECK_ASSIGNMENT_SUBMISSIONS: User wants to check who has submitted an assignment (extract courseName and assignmentTitle)
      - GRADE_ASSIGNMENT: User wants to grade a student's assignment (extract courseName, assignmentTitle, studentEmail, assignedGrade, draftGrade)
      - SHOW_ENROLLED_STUDENTS: User wants to see the list of enrolled students in a course (extract courseName)
      - PROCEED_WITH_AVAILABLE_INFO: User wants to skip providing more information and proceed with available data (e.g., user says "no", "skip", "that's all", "proceed", etc.)
      - HELP: User needs help or instructions
      - UNKNOWN: None of the above
      
      ${historyContext}
      
      User message: "${message}"
      
      For course creation, extract these fields if provided:
      - name/courseName: The name of the course
      - section: The section number or identifier
      - descriptionHeading: The course heading or title
      - description: The course description
      - room: The room number or location
      - studentEmails: Array of student email addresses to invite
      
      For assignment creation, extract these fields if provided:
      - courseId/courseName: The course ID or name where the assignment will be created
      - title: The assignment title
      - description: The assignment description
      - dueDateExpr: Natural language date expression (e.g., "next Friday", "tomorrow", "next week")
      - dueTimeExpr: Natural language time expression (e.g., "5 PM", "9 AM", "noon")
      - maxPoints: The maximum points for the assignment
      - materials: Array of materials to attach to the assignment
      
      For showing enrolled students, extract these fields if provided:
      - courseName: The course name
      
      For viewing announcements, extract these fields if provided:
      - courseId/courseName: The course ID or name to view announcements for
      
      For grading assignments, extract these fields if provided:
      - courseName: The course name
      - assignmentTitle: The assignment title
      - studentEmail: The student's email (or name if email not provided)
      - assignedGrade: The grade to assign (final grade)
      - draftGrade: The draft grade (optional, visible only to teachers)
      
      For date and time expressions:
      - Use dueDateExpr for natural language date expressions like:
        * "next Friday"
        * "tomorrow"
        * "next week"
        * "in 2 weeks"
        * "end of month"
      - Use dueTimeExpr for natural language time expressions like:
        * "5 PM"
        * "9 AM"
        * "noon"
        * "midnight"
      
      The system will automatically convert these expressions to the proper format.
      Do not try to convert the expressions yourself - just pass them as is in the parameters.
      
      If the user doesn't provide an explicit course ID but refers to a course by name or other identifier, please:
      1. Extract the name or identifying phrase they used
      2. Include it in the parameters as "courseName" or "courseIdentifier"
      3. Set a flag "needsDisambiguation": true if you think the system will need to ask the user which specific course they mean
      
      Respond in JSON format only with the following structure:
      {
        "intent": "INTENT_NAME",
        "confidence": 0.0-1.0,
        "parameters": {
          // Any extracted parameters like courseId, name, description, topic, etc.
        }
      }
    `;

    // Get the response from Gemini
    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();
    
    // Parse the JSON response
    try {
      // Clean up the response text by removing markdown code block formatting
      const cleanedResponse = responseText
        .replace(/```json\s*/, '')  // Remove opening ```json
        .replace(/```\s*$/, '')     // Remove closing ```
        .trim();                    // Remove any extra whitespace
      
      return JSON.parse(cleanedResponse);
    } catch (e) {
      console.error('Error parsing Gemini response as JSON:', e);
      console.log('Raw response:', responseText);
      return detectIntentFallback(message, conversationId);
    }
  } catch (error) {
    console.error('Intent detection error:', error);
    // Fall back to simple keyword-based intent detection
    return detectIntentFallback(message, conversationId);
  }
}

module.exports = {
  detectIntent,
  detectIntentFallback
}; 