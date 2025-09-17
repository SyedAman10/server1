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
  console.log('🔍 DEBUG: detectIntentFallback called with message:', message);
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
  
  // Proactive suggestions for joining/inviting students
  if (
    lowerMessage.includes('join') || 
    lowerMessage.includes('invite') || 
    lowerMessage.includes('add student') ||
    lowerMessage.includes('enroll') ||
    lowerMessage.includes('student wants to join') ||
    lowerMessage.includes('how to join') ||
    lowerMessage.includes('join class') ||
    lowerMessage.includes('join course') ||
    lowerMessage.includes('add student to class') ||
    lowerMessage.includes('add student to course')
  ) {
    // Check if this is a direct invitation request with email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = message.match(emailRegex) || [];
    
    // Try to extract course name
    let courseName = '';
    const coursePatterns = [
      /(?:class|course)\s+([a-zA-Z0-9\s-]+)/i,
      /(?:to|in)\s+([a-zA-Z0-9\s-]+?)(?:\s|$)/i,
      /([a-zA-Z0-9\s-]+?)\s+(?:class|course)/i
    ];
    
    for (const pattern of coursePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        courseName = match[1].trim();
        break;
      }
    }
    
    // Check for generic terms that should trigger clarification
    const genericTerms = ['my class', 'my course', 'the class', 'the course', 'this class', 'this course', 'class', 'course'];
    const isGenericTerm = genericTerms.some(term => 
      courseName.toLowerCase().includes(term.toLowerCase()) || 
      courseName.toLowerCase() === term.toLowerCase()
    );
    
    // If we have both email and course, and it's not a generic term, treat as direct invitation
    if (emails.length > 0 && courseName && !isGenericTerm) {
      return {
        intent: 'INVITE_STUDENTS',
        confidence: 0.9,
        parameters: {
          studentEmails: emails,
          courseName: courseName
        }
      };
    }
    
    // If we have a generic term, treat as suggestion request
    if (isGenericTerm) {
      return {
        intent: 'STUDENT_JOIN_SUGGESTION',
        confidence: 0.9,
        parameters: {
          originalMessage: message,
          extractedEmails: emails,
          extractedCourse: courseName,
          needsDisambiguation: true
        }
      };
    }
    
    // Otherwise, provide suggestions
    return {
      intent: 'STUDENT_JOIN_SUGGESTION',
      confidence: 0.8,
      parameters: {
        originalMessage: message,
        extractedEmails: emails,
        extractedCourse: courseName
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
  
  // Delete/Cancel meeting - MUST come BEFORE UPDATE_MEETING to prevent false positives
  if (
    (lowerMessage.includes('cancel') || lowerMessage.includes('delete') || lowerMessage.includes('remove')) && 
    (lowerMessage.includes('meeting') || lowerMessage.includes('appointment') || lowerMessage.includes('call'))
  ) {
    console.log('🎯 DEBUG: DELETE_MEETING intent detected!');
    
    // Extract meeting details to identify which meeting to cancel
    let dateExpr = '';
    let timeExpr = '';
    
    // Extract date and time (e.g., "tomorrow at 5pm")
    const dateTimeMatch = message.match(/(?:which is\s+)?(?:on\s+)?(today|tomorrow|next\s+\w+|in\s+\d+\s+weeks?|end\s+of\s+month)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (dateTimeMatch) {
      dateExpr = dateTimeMatch[1].trim();
      timeExpr = dateTimeMatch[2].trim();
    }
    
    return {
      intent: 'DELETE_MEETING',
      confidence: 0.9,
      parameters: {
        ...(dateExpr ? { dateExpr } : {}),
        ...(timeExpr ? { timeExpr } : {})
      }
    };
  }
  
  // Update/Reschedule meeting - MUST come BEFORE CREATE_MEETING to prevent false positives
  if (
    (lowerMessage.includes('reschedule') || lowerMessage.includes('update') || lowerMessage.includes('change') || lowerMessage.includes('move')) && 
    (lowerMessage.includes('meeting') || lowerMessage.includes('appointment') || lowerMessage.includes('call'))
  ) {
    console.log('🎯 DEBUG: UPDATE_MEETING intent detected!');
    
    // Extract current meeting details
    let currentDateExpr = '';
    let currentTimeExpr = '';
    let newDateExpr = '';
    let newTimeExpr = '';
    let newDuration = null;
    
    // Extract current date/time (e.g., "today at 5pm")
    const currentDateTimeMatch = message.match(/(?:which is\s+)?(?:on\s+)?(today|tomorrow|next\s+\w+|in\s+\d+\s+weeks?|end\s+of\s+month)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (currentDateTimeMatch) {
      currentDateExpr = currentDateTimeMatch[1].trim();
      currentTimeExpr = currentDateTimeMatch[2].trim();
    }
    
    // Extract new date/time (e.g., "make it to 6pm tomorrow")
    const newDateTimeMatch = message.match(/(?:make it\s+(?:to\s+)?|change it\s+(?:to\s+)?|reschedule\s+(?:to\s+)?)(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(today|tomorrow|next\s+\w+|in\s+\d+\s+weeks?|end\s+of\s+month)/i);
    if (newDateTimeMatch) {
      newTimeExpr = newDateTimeMatch[1].trim();
      newDateExpr = newDateTimeMatch[2].trim();
    }
    
    // Extract duration if mentioned
    const durationMatch = message.match(/(?:for\s+)?(\d+)\s*(?:hour|minute|min|hr)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1], 10);
      if (message.toLowerCase().includes('minute') || message.toLowerCase().includes('min')) {
        newDuration = value;
      } else {
        newDuration = value * 60; // Convert hours to minutes
      }
    }
    
    return {
      intent: 'UPDATE_MEETING',
      confidence: 0.9,
      parameters: {
        ...(currentDateExpr ? { currentDateExpr } : {}),
        ...(currentTimeExpr ? { currentTimeExpr } : {}),
        ...(newDateExpr ? { newDateExpr } : {}),
        ...(newTimeExpr ? { newTimeExpr } : {}),
        ...(newDuration ? { newDuration } : {})
      }
    };
  }
  
  // List/Show meetings - MUST come BEFORE CREATE_MEETING to prevent false positives
  if (
    (lowerMessage.includes('show') || lowerMessage.includes('list') || lowerMessage.includes('get all') || lowerMessage.includes('see all')) && 
    (lowerMessage.includes('meeting') || lowerMessage.includes('appointment') || lowerMessage.includes('call'))
  ) {
    console.log('🎯 DEBUG: LIST_MEETINGS intent detected!');
    return {
      intent: 'LIST_MEETINGS',
      confidence: 0.9,
      parameters: {}
    };
  }
  
  // Create meeting - MUST come BEFORE CREATE_COURSE to prevent false positives
  // Only trigger if user explicitly wants to create/schedule something
  if (
    (lowerMessage.includes('create') || lowerMessage.includes('schedule') || lowerMessage.includes('set up') || lowerMessage.includes('book')) && 
    (lowerMessage.includes('meeting') || lowerMessage.includes('appointment') || lowerMessage.includes('call')) &&
    !lowerMessage.includes('show') && !lowerMessage.includes('list') && !lowerMessage.includes('get all') && !lowerMessage.includes('see all')
  ) {
    console.log('🎯 DEBUG: Meeting intent detected!');
    // Extract meeting title
    let title = '';
    // Try different patterns for title extraction
    const titlePatterns = [
      // Pattern 1: "create meeting [title] with [email]"
      /(?:create|schedule|set up)\s+(?:a\s+)?(?:meeting|appointment|call)\s+([^with]+?)\s+with/i,
      // Pattern 2: "create meeting [title] at [time]"
      /(?:create|schedule|set up)\s+(?:a\s+)?(?:meeting|appointment|call)\s+([^at]+?)\s+at/i,
      // Pattern 3: "create meeting [title] on [date]"
      /(?:create|schedule|set up)\s+(?:a\s+)?(?:meeting|appointment|call)\s+([^on]+?)\s+on/i,
      // Pattern 4: "create meeting [title] for [time]"
      /(?:create|schedule|set up)\s+(?:a\s+)?(?:meeting|appointment|call)\s+([^for]+?)\s+for/i,
      // Pattern 5: "create meeting [title]" (end of message)
      /(?:create|schedule|set up)\s+(?:a\s+)?(?:meeting|appointment|call)\s+(.+?)(?:\s+with|\s+at|\s+on|\s+for|$)/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        title = match[1].trim();
        break;
      }
    }
    
    // If no title found, use a default
    if (!title) {
      title = 'Meeting';
    }
    
    // Extract attendees (emails)
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const attendees = message.match(emailRegex) || [];
    
    // Extract date expressions
    let dateExpr = '';
    const datePatterns = [
      /(?:on|at|for)\s+(today|tomorrow|next\s+\w+|in\s+\d+\s+weeks?|end\s+of\s+month)/i,
      /(?:on|at|for)\s+(\w+\s+\d+)/i, // e.g., "December 15"
      /(?:on|at|for)\s+(\d{1,2}\/\d{1,2})/i, // e.g., "12/15"
      // New pattern for "today at 5pm" format
      /(today|tomorrow|next\s+\w+|in\s+\d+\s+weeks?|end\s+of\s+month)\s+at/i
    ];
    
    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        dateExpr = match[1].trim();
        break;
      }
    }
    
    // Extract time expressions
    let timeExpr = '';
    const timePatterns = [
      /(?:at|for)\s+(\d{1,2}:\d{2}\s*(?:am|pm)?)/i, // e.g., "5:30 PM"
      /(?:at|for)\s+(\d{1,2}\s*(?:am|pm))/i, // e.g., "5 PM"
      /(?:at|for)\s+(noon|midnight)/i,
      // New pattern for "today at 5pm" format
      /at\s+(\d{1,2}:\d{2}\s*(?:am|pm)?)/i, // e.g., "at 5:30 PM"
      /at\s+(\d{1,2}\s*(?:am|pm))/i, // e.g., "at 5 PM"
      /at\s+(noon|midnight)/i
    ];
    
    for (const pattern of timePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        timeExpr = match[1].trim();
        break;
      }
    }
    
    // Extract duration (optional)
    let duration = 60; // Default 1 hour
    const durationMatch = message.match(/(?:for|duration|length)\s+(\d+)\s*(?:hour|minute|min|hr)/i);
    if (durationMatch && durationMatch[1]) {
      const value = parseInt(durationMatch[1], 10);
      if (message.toLowerCase().includes('minute') || message.toLowerCase().includes('min')) {
        duration = value;
      } else {
        duration = value * 60; // Convert hours to minutes
      }
    }
    
    // Extract description
    let description = '';
    const descMatch = message.match(/(?:about|regarding|for)\s+([^with]+?)(?:\s+with|\s+at|\s+on|\s+for|$)/i);
    if (descMatch && descMatch[1]) {
      description = descMatch[1].trim();
    }
    
    return {
      intent: 'CREATE_MEETING',
      confidence: 0.9,
      parameters: {
        ...(title ? { title } : {}),
        ...(attendees.length > 0 ? { attendees } : {}),
        ...(dateExpr ? { dateExpr } : {}),
        ...(timeExpr ? { timeExpr } : {}),
        ...(duration !== 60 ? { duration } : {}),
        ...(description ? { description } : {})
      }
    };
  }
  
  // Create course
  console.log('🔍 DEBUG: Checking for course intent...');
  console.log('🔍 DEBUG: Has create/make/new course:', lowerMessage.includes('create') || lowerMessage.includes('make') || lowerMessage.includes('new course'));
  
  if (lowerMessage.includes('create') || lowerMessage.includes('make') || lowerMessage.includes('new course')) {
    console.log('🎯 DEBUG: Course intent detected!');
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

    // Check for generic terms that need clarification
    const genericTerms = [
      'my class', 'my course', 'the class', 'the course', 'class', 'course',
      'it', 'this', 'that', 'one', 'some', 'any', 'a class', 'a course'
    ];
    
    if (genericTerms.includes(courseName.toLowerCase())) {
      return {
        intent: 'CREATE_ANNOUNCEMENT',
        confidence: 0.7,
        parameters: {
          courseName: courseName,
          needsDisambiguation: true
        }
      };
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

    // Check for generic terms that should trigger clarification
    const genericTerms = ['my class', 'my course', 'the class', 'the course', 'this class', 'this course', 'class', 'course'];
    const isGenericTerm = genericTerms.some(term => 
      courseName.toLowerCase().includes(term.toLowerCase()) || 
      courseName.toLowerCase() === term.toLowerCase()
    );

    // If it's a generic term, treat as suggestion request
    if (isGenericTerm) {
      return {
        intent: 'STUDENT_JOIN_SUGGESTION',
        confidence: 0.9,
        parameters: {
          originalMessage: message,
          extractedEmails: emails,
          extractedCourse: courseName,
          needsDisambiguation: true
        }
      };
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
    lowerMessage.includes('check') && lowerMessage.includes('assignment') ||
    lowerMessage.includes('assignment submissions') ||
    lowerMessage.includes('who submitted') ||
    lowerMessage.includes('submissions for')
  ) {
    // Try to extract assignment title and course name
    let assignmentTitle = '';
    let courseName = '';
    
    // e.g. "who has submitted assignment test 2 in sql"
    const assignmentMatch = message.match(/assignment\s+([\w\s-]+)/i);
    if (assignmentMatch && assignmentMatch[1]) {
      assignmentTitle = assignmentMatch[1].trim();
    }
    
    // Extract course name from 'in course X', 'for course X', or 'in X'
    const courseMatch = message.match(/(?:in|for)\s+(?:course\s+)?([\w\s-]+)/i);
    if (courseMatch && courseMatch[1]) {
      courseName = courseMatch[1].trim();
    }
    
    return {
      intent: 'CHECK_ASSIGNMENT_SUBMISSIONS',
      confidence: 0.8,
      parameters: {
        ...(courseName ? { courseName } : {}),
        ...(assignmentTitle ? { assignmentTitle } : {})
      }
    };
  }

  // List assignments in a course
  if (
    lowerMessage.includes('show') && lowerMessage.includes('assignment') ||
    lowerMessage.includes('list') && lowerMessage.includes('assignment') ||
    lowerMessage.includes('all assignment') ||
    lowerMessage.includes('assignment in') ||
    lowerMessage.includes('assignments for')
  ) {
    // Extract course name from 'in course X', 'for course X', or 'in X'
    let courseName = '';
    const courseMatch = message.match(/(?:in|for)\s+(?:course\s+)?([\w\s-]+)/i);
    if (courseMatch && courseMatch[1]) {
      courseName = courseMatch[1].trim();
    }
    
    return {
      intent: 'LIST_ASSIGNMENTS',
      confidence: 0.8,
      parameters: {
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
  
  // Email reading
  if (lowerMessage.includes('read') && lowerMessage.includes('email')) {
    const emailMatch = message.match(/from\s+([^\s]+@[^\s]+)/i);
    const senderEmail = emailMatch ? emailMatch[1] : null;
    
    return {
      intent: 'READ_EMAIL',
      confidence: 0.9,
      parameters: {
        ...(senderEmail ? { senderEmail } : {})
      }
    };
  }
  
  // Email sending
  if (lowerMessage.includes('send') && lowerMessage.includes('email')) {
    const recipientMatch = message.match(/to\s+([^\s]+@[^\s]+)/i);
    const recipientEmail = recipientMatch ? recipientMatch[1] : null;
    
    // Extract message content after "saying" or similar words
    const messageMatch = message.match(/saying\s+(.+)/i);
    const emailMessage = messageMatch ? messageMatch[1].trim() : null;
    
    return {
      intent: 'SEND_EMAIL',
      confidence: 0.9,
      parameters: {
        ...(recipientEmail ? { recipientEmail } : {}),
        ...(emailMessage ? { message: emailMessage } : {})
      }
    };
  }
  
  // Cancel or stop ongoing actions
  if (lowerMessage.includes('cancel') || lowerMessage.includes('stop') || lowerMessage.includes('never mind') || 
      lowerMessage.includes('forget it') || lowerMessage.includes('that\'s all') || lowerMessage.includes('done') ||
      lowerMessage.includes('quit') || lowerMessage.includes('exit') || lowerMessage.includes('abort')) {
    return {
      intent: 'CANCEL_ACTION',
      confidence: 0.9,
      parameters: {}
    };
  }
  
  // Greeting and casual conversation
  if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey') || 
      lowerMessage.includes('good morning') || lowerMessage.includes('good afternoon') || 
      lowerMessage.includes('good evening') || lowerMessage.includes('how are you') ||
      lowerMessage.includes('what\'s up') || lowerMessage.includes('how\'s it going') ||
      lowerMessage.includes('sup') || lowerMessage.includes('yo') || lowerMessage.includes('morning') ||
      lowerMessage.includes('afternoon') || lowerMessage.includes('evening') || 
      lowerMessage.includes('nice to meet you') || lowerMessage.includes('pleasure') ||
      lowerMessage.includes('thanks') || lowerMessage.includes('thank you') || lowerMessage.includes('thx')) {
    return {
      intent: 'GREETING',
      confidence: 0.9,
      parameters: {}
    };
  }
  
  // Default to unknown
  console.log('🔍 DEBUG: No specific intent detected, returning UNKNOWN');
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
  console.log('🔍 DEBUG: detectIntent called with message:', message);
  
  // First check if there's an ongoing action that needs parameter collection
  if (conversationId) {
    const { getOngoingActionContext } = require('./conversationManager');
    const context = getOngoingActionContext(conversationId);
    if (context) {
      console.log('🔍 DEBUG: Found ongoing action context, checking if message provides parameters');
      
      // Check if this message provides parameters for the ongoing action
      const { action, missingParameters } = context;
      
      // If we're waiting for student emails and this looks like an email
      if (action === 'INVITE_STUDENTS' && missingParameters.includes('studentEmails')) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = message.match(emailRegex) || [];
        if (emails.length > 0) {
          console.log('🔍 DEBUG: Message contains email for ongoing INVITE_STUDENTS action');
          return {
            intent: 'INVITE_STUDENTS',
            confidence: 0.95,
            parameters: {
              studentEmails: emails,
              isParameterCollection: true
            }
          };
        }
      }
      
      // If we're waiting for course name and this looks like a course name
      if (action === 'INVITE_STUDENTS' && missingParameters.includes('courseName')) {
        // Check if it's a simple course name (no email, short message)
        if (!message.includes('@') && message.length < 50) {
          console.log('🔍 DEBUG: Message looks like course name for ongoing INVITE_STUDENTS action');
          return {
            intent: 'INVITE_STUDENTS',
            confidence: 0.9,
            parameters: {
              courseName: message.trim(),
              isParameterCollection: true
            }
          };
        }
      }
    }
  }
  
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
      - LIST_ASSIGNMENTS: User wants to see all assignments in a course (extract courseName or courseId)
      - SHOW_ENROLLED_STUDENTS: User wants to see the list of enrolled students in a course (extract courseName)
      - CREATE_MEETING: User wants to create a meeting or schedule an appointment (extract title, attendees, dateExpr, timeExpr, duration, description)
      - LIST_MEETINGS: User wants to see all meetings or list upcoming meetings (no parameters needed)
      - UPDATE_MEETING: User wants to update or reschedule an existing meeting (extract currentDateExpr, currentTimeExpr, newDateExpr, newTimeExpr, newDuration)
      - DELETE_MEETING: User wants to cancel or delete an existing meeting (extract dateExpr, timeExpr)
      - READ_EMAIL: User wants to read emails from a specific sender (extract senderEmail, limit, subject if specified)
      - SEND_EMAIL: User wants to send an email to someone (extract recipientEmail, subject, message, attachments if specified)
      - CANCEL_ACTION: User wants to cancel, stop, or abort an ongoing action (e.g., user says "cancel", "stop", "never mind", "forget it", "that's all", "done", "quit", "exit", "abort")
      - PROCEED_WITH_AVAILABLE_INFO: User wants to skip providing more information and proceed with available data (e.g., user says "no", "skip", "that's all", "proceed", etc.)
      - STUDENT_JOIN_SUGGESTION: User is asking about joining a class, inviting students, or how students can join (provide helpful suggestions and prompts)
      - GREETING: User is saying hello, hi, hey, good morning/afternoon/evening, how are you, what's up, thanks, or engaging in casual conversation (no action needed)
        Examples: "hi", "hello", "hey there", "good morning", "how are you doing?", "thanks", "thank you"
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

      For listing assignments, extract these fields if provided:
      - courseId/courseName: The course ID or name to list assignments from

      For grading assignments, extract these fields if provided:
      - courseName: The course name
      - assignmentTitle: The assignment title
      - studentEmail: The student's email (or name if email not provided)
      - assignedGrade: The grade to assign (final grade)
      - draftGrade: The draft grade (optional, visible only to teachers)
      
      For meeting creation, extract these fields if provided:
      - title: The meeting title or subject
      - attendees: Array of attendee email addresses
      - dateExpr: Natural language date expression (e.g., "today", "tomorrow", "next Friday", "December 15")
      - timeExpr: Natural language time expression (e.g., "5 PM", "9:30 AM", "noon")
      - duration: Meeting duration in minutes (default: 60)
      - description: Meeting description or agenda
      
      For meeting updates/rescheduling, extract these fields if provided:
      - currentDateExpr: Current meeting date expression (e.g., "today", "tomorrow")
      - currentTimeExpr: Current meeting time expression (e.g., "5pm", "9am")
      - newDateExpr: New meeting date expression (e.g., "tomorrow", "next Friday")
      - newTimeExpr: New meeting time expression (e.g., "6pm", "10am")
      - newDuration: New meeting duration in minutes (optional)
      
      For meeting deletion/cancellation, extract these fields if provided:
      - dateExpr: Meeting date expression (e.g., "today", "tomorrow")
      - timeExpr: Meeting time expression (e.g., "5pm", "9am")
      
      For email reading, extract these fields if provided:
      - senderEmail: The email address of the sender to read emails from
      - limit: Number of emails to retrieve (default: 10)
      - subject: Subject line to filter emails by (optional)
      
      For email sending, extract these fields if provided:
      - recipientEmail: The email address of the recipient
      - subject: The subject line of the email
      - message: The body content of the email
      - attachments: Array of file names or paths to attach (optional)
      
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