const { calculateDateFromExpression, convertTimeExpression } = require('../../utils/dateUtils');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getUserByEmail } = require('../../models/user.model');

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
  let { intent, parameters } = intentData;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  let userRole = null;
  
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
      case 'LIST_COURSES':
        return await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
        
      case 'CREATE_COURSE': {
        if (!parameters.name) {
          return {
            message: "I need a name for the course. Please provide one.",
            conversationId: req.body.conversationId
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

          return {
            message: `🎉 **Course "${parameters.name}" created successfully!**\n\n📚 **Course Details:**\n• Name: ${parameters.name}${parameters.section ? `\n• Section: ${parameters.section}` : ''}${parameters.description ? `\n• Description: ${parameters.description}` : ''}\n\n✅ Your course is now active in Google Classroom. Students can join using the enrollment code, and you can start posting announcements, assignments, and materials.\n\n💡 **Next steps:**\n• Post a welcome announcement\n• Create your first assignment\n• Invite students to join`,
            course: response.course,
            conversationId: req.body.conversationId
          };
        } catch (error) {
          console.error('Error in CREATE_COURSE:', error);
          return {
            message: "Sorry, I encountered an error while trying to create the course. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }
        
      case 'CREATE_ANNOUNCEMENT': {
        if (!parameters.courseName && !parameters.courseIdentifier) {
          return {
            message: "I need to know which course you want to create an announcement for. Please provide a course name.",
            conversationId: req.body.conversationId
          };
        }

        if (!parameters.announcementText) {
          return {
            message: "Please provide the text for your announcement.",
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
          
          return {
            message: `✅ Announcement posted successfully in **${selectedCourse.name}**!\n\n📢 **${parameters.announcementText}**\n\nYour students will now see this announcement in their Google Classroom. You can view all announcements anytime by asking me to show the announcements for this course.`,
            announcement: response.announcement,
            conversationId: req.body.conversationId
          };
        } catch (error) {
          console.error('Error in CREATE_ANNOUNCEMENT:', error);
          return {
            message: "Sorry, I encountered an error while creating the announcement. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }
        
      case 'GET_ANNOUNCEMENTS': {
        if (!parameters.courseName && !parameters.courseIdentifier) {
          return {
            message: "I need to know which course you want to view announcements for. Please provide a course name.",
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
        // Handle course retrieval by ID or by name
        if (parameters.courseId) {
          return await makeApiCall(`${baseUrl}/api/classroom/${parameters.courseId}`, 'GET', null, userToken, req);
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
          return await makeApiCall(`${baseUrl}/api/classroom/${selectedCourse.id}`, 'GET', null, userToken, req);
        } else {
          return {
            message: "I need more information about which course you're interested in. Could you provide a course name or ID?",
            conversationId: req.body.conversationId
          };
        }
      }
        
      case 'CREATE_ASSIGNMENT': {
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
          
          // Exact match - create the assignment immediately, with or without materials
          const courseId = selectedCourse.id;
          const assignmentData = {
            title: parameters.title,
            description: parameters.description || '',
            materials: parameters.materials || [],
            state: 'PUBLISHED',
            maxPoints: parameters.maxPoints || 100,
            dueDate: parameters.dueDate,
            dueTime: parameters.dueTime
          };

          try {
            const response = await makeApiCall(
              `${baseUrl}/api/courses/${courseId}/assignments`,
              'POST',
              assignmentData,
              userToken,
              req
            );

            return {
              message: `Successfully created the assignment "${parameters.title}" in ${selectedCourse.name}.`,
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
          
          // Exact match - invite the students
          const courseId = selectedCourse.id;
          const invitationPromises = studentEmails.map(email =>
            makeApiCall(
              `${baseUrl}/api/classroom/${courseId}/invite`,
              'POST',
              { email },
              userToken,
              req
            )
          );

          try {
            await Promise.all(invitationPromises);
            return {
              message: `Successfully invited ${studentEmails.length} students to ${selectedCourse.name}.`,
              conversationId: req.body.conversationId
            };
          } catch (error) {
            return {
              message: `Failed to invite students: ${error.message}`,
              conversationId: req.body.conversationId
            };
          }
        } catch (error) {
          console.error('Error in INVITE_STUDENTS:', error);
          return {
            message: "Sorry, I encountered an error while inviting students. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }

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
        return {
          message: `I'm here to help you manage your Google Classroom courses! Here's what I can do:

1. Course Management:
   • List all your courses
   • Get details for a specific course
   • Create new courses

2. Announcements:
   • Create announcements in any course
   • Post updates and messages

3. Assignments:
   • Create assignments with due dates
   • Add materials and documents
   • Set points and descriptions

4. Student Management:
   • Invite students to courses
   • Add multiple students at once

5. Document Management:
   • Attach files from Google Drive
   • Add URLs as materials
   • Search for existing documents

Just let me know what you'd like to do! For example:
• "list my courses"
• "create a new course"
• "create announcement in chemistry"
• "create assignment in history"
• "invite students to math class"`,
          conversationId: req.body.conversationId
        };

      case 'CHECK_ASSIGNMENT_SUBMISSIONS': {
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
          // 4. Format summary
          const turnedIn = submissionList.filter(s => s.state === 'TURNED_IN' || s.state === 'RETURNED');
          const notTurnedIn = submissionList.filter(s => s.state !== 'TURNED_IN' && s.state !== 'RETURNED');
          let message = `Submissions for "${matchingAssignments[0].title}" in ${selectedCourse.name}:\n`;
          message += `\nSubmitted (${turnedIn.length}):\n`;
          message += turnedIn.map(s => `• ${s.userId || s.id} (${s.state})`).join('\n') || 'None';
          message += `\n\nNot Submitted (${notTurnedIn.length}):\n`;
          message += notTurnedIn.map(s => `• ${s.userId || s.id} (${s.state})`).join('\n') || 'None';
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
        // 1. Validate parameters
        const { courseName, assignmentTitle, studentEmail, assignedGrade, draftGrade } = parameters;
        if (!courseName || !assignmentTitle || !studentEmail || (assignedGrade === undefined && draftGrade === undefined)) {
          return { message: "Please provide course, assignment, student, and grade information.", conversationId: req.body.conversationId };
        }

        // 2. Find the course
        const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken, req);
        if (!coursesResponse || !coursesResponse.courses || !Array.isArray(coursesResponse.courses)) {
          return { message: `Course list not found.`, conversationId: req.body.conversationId };
        }
        const course = coursesResponse.courses.find(c => c.name && c.name.toLowerCase().includes(courseName.toLowerCase()));
        if (!course) return { message: `Course "${courseName}" not found.`, conversationId: req.body.conversationId };

        // 3. Find the assignment
        const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments`, 'GET', null, userToken, req);
        const assignments = Array.isArray(assignmentsResponse)
          ? assignmentsResponse
          : Array.isArray(assignmentsResponse.courses)
            ? assignmentsResponse.courses
            : [];
        const assignment = assignments.find(a => a.title && a.title.toLowerCase().includes(assignmentTitle.toLowerCase()));
        if (!assignment) return { message: `Assignment "${assignmentTitle}" not found.`, conversationId: req.body.conversationId };

        // 4. Find the student submission
        const submissionsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments/${assignment.id}/submissions`, 'GET', null, userToken, req);
        const submissions = Array.isArray(submissionsResponse)
          ? submissionsResponse
          : Array.isArray(submissionsResponse.courses)
            ? submissionsResponse.courses
            : [];
        console.log('DEBUG GRADE_ASSIGNMENT submissions:', submissions);
        let matchUserId = studentEmail;
        // If the input is an email, look up the userId from the students list
        if (studentEmail.includes('@')) {
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
            console.log('DEBUG GRADE_ASSIGNMENT searching for email:', studentEmail);
            const foundStudent = students.find(s => s.profile && s.profile.emailAddress && s.profile.emailAddress.toLowerCase() === studentEmail.toLowerCase());
            if (foundStudent && foundStudent.userId) {
              matchUserId = foundStudent.userId;
            } else {
              return { message: `No student found in course with email ${studentEmail}.`, conversationId: req.body.conversationId };
            }
          } catch (err) {
            return { message: `Failed to look up student by email: ${err.message}`, conversationId: req.body.conversationId };
          }
        }
        // Now match by userId
        let submission = submissions.find(s => s.userId && s.userId === matchUserId);
        if (!submission) {
          // Try partial match for userId
          submission = submissions.find(s => s.userId && s.userId.includes(matchUserId));
        }
        if (!submission) return { message: `Submission for student "${studentEmail}" not found.`, conversationId: req.body.conversationId };

        // 5. Update the grade
        const gradeData = {};
        if (assignedGrade !== undefined) gradeData.assignedGrade = assignedGrade;
        if (draftGrade !== undefined) gradeData.draftGrade = draftGrade;

        try {
          await makeApiCall(
            `${baseUrl}/api/courses/${course.id}/courseWork/${assignment.id}/studentSubmissions/${submission.id}`,
            'PATCH',
            gradeData,
            userToken,
            req
          );
        } catch (error) {
          return { message: `Failed to update grade: ${error.message}`, conversationId: req.body.conversationId };
        }

        // 6. Optionally, return the submission (change state to RETURNED)
        try {
          await makeApiCall(
            `${baseUrl}/api/courses/${course.id}/courseWork/${assignment.id}/studentSubmissions/${submission.id}:return`,
            'POST',
            {},
            userToken,
            req
          );
        } catch (error) {
          // Not fatal, just log
          console.error('Failed to return submission:', error.message);
        }

        return { message: `Grade updated for ${studentEmail} on "${assignmentTitle}".`, conversationId: req.body.conversationId };
      }

      case 'SHOW_ENROLLED_STUDENTS': {
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
      
      default:
        return "I'm not sure how to handle that request. Please try again or ask for help.";
    }
  } catch (error) {
    console.error('Action execution error:', error);
    if (error.response && error.response.data) {
      return `Error: ${error.response.data.error || 'An error occurred'}`;
    }
    return "Sorry, I couldn't complete that action. Please try again later.";
  }
}

module.exports = {
  executeAction,
  makeApiCall
}; 