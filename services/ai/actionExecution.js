const { calculateDateFromExpression, convertTimeExpression } = require('../../utils/dateUtils');
const axios = require('axios');
const jwt = require('jsonwebtoken');

/**
 * Helper function to make API calls to our backend endpoints
 */
async function makeApiCall(url, method, data, userToken) {
  console.log('DEBUG: makeApiCall called with:', {
    url,
    method,
    data: data ? 'data present' : 'no data',
    userToken: userToken ? 'token present' : 'no token'
  });

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

    console.log('DEBUG: Making API call with config:', {
      method,
      url,
      hasData: !!config.data
    });

    const response = await axios(config);

    console.log('DEBUG: API call successful, response status:', response.status);
    console.log('DEBUG: API response data:', response.data);

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
        courses: response.data
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
      } else if (url.includes('/assignments')) {
        return {
          message: "Assignment created successfully",
          assignment: result
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
        return await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken);
        
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
            userToken
          );

          console.log('DEBUG: CREATE_COURSE - makeApiCall response:', response);

          return {
            message: `Successfully created the course "${parameters.name}".`,
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
          // Get all courses to find the matching one
          const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken);
          
          if (!coursesResponse || !coursesResponse.courses || !Array.isArray(coursesResponse.courses)) {
            return {
              message: "I couldn't find your courses. Please try again.",
              conversationId: req.body.conversationId
            };
          }
          
          const searchTerm = (parameters.courseName || parameters.courseIdentifier || '').toLowerCase();
          const matchingCourses = coursesResponse.courses.filter(course => 
            course.name && course.name.toLowerCase().includes(searchTerm)
          );
          
          if (matchingCourses.length === 0) {
            return {
              message: `I couldn't find any courses matching "${parameters.courseName || parameters.courseIdentifier}".`,
              conversationId: req.body.conversationId
            };
          } else if (matchingCourses.length === 1) {
            // Exact match - create the announcement
            const courseId = matchingCourses[0].id;
            const announcementData = {
              text: parameters.announcementText,
              materials: parameters.materials || [],
              state: 'PUBLISHED'
            };

            const response = await makeApiCall(
              `${baseUrl}/api/classroom/${courseId}/announcements`,
              'POST',
              announcementData,
              userToken
            );

            return {
              message: `Successfully created the announcement in ${matchingCourses[0].name}.`,
              announcement: response.announcement,
              conversationId: req.body.conversationId
            };
          } else {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName || parameters.courseIdentifier}". Which one would you like to create an announcement for?`,
              options: matchingCourses.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              announcementText: parameters.announcementText,
              conversationId: req.body.conversationId
            };
          }
        } catch (error) {
          console.error('Error in CREATE_ANNOUNCEMENT:', error);
          return {
            message: "Sorry, I encountered an error while trying to create the announcement. Please try again.",
            error: error.message,
            conversationId: req.body.conversationId
          };
        }
      }
        
      case 'GET_COURSE': {
        // Handle course retrieval by ID or by name
        if (parameters.courseId) {
          return await makeApiCall(`${baseUrl}/api/classroom/${parameters.courseId}`, 'GET', null, userToken);
        } else if (parameters.courseName || parameters.courseIdentifier) {
          // If we only have a name, we need to:
          // 1. Get all courses
          // 2. Find the matching one(s)
          const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken);
          
          if (!coursesResponse || !coursesResponse.courses || !Array.isArray(coursesResponse.courses)) {
            return {
              message: "I couldn't find your courses. Please try again.",
              conversationId: req.body.conversationId
            };
          }
          
          const searchTerm = (parameters.courseName || parameters.courseIdentifier || '').toLowerCase();
          const matchingCourses = coursesResponse.courses.filter(course => 
            course.name && course.name.toLowerCase().includes(searchTerm)
          );
          
          if (matchingCourses.length === 0) {
            return {
              message: `I couldn't find any courses matching "${parameters.courseName || parameters.courseIdentifier}".`,
              conversationId: req.body.conversationId
            };
          } else if (matchingCourses.length === 1) {
            // Exact match - get the details
            return await makeApiCall(`${baseUrl}/api/classroom/${matchingCourses[0].id}`, 'GET', null, userToken);
          } else {
            // Multiple matches - ask for clarification
            return {
              message: `I found multiple courses matching "${parameters.courseName || parameters.courseIdentifier}". Which one did you mean?`,
              options: matchingCourses.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              conversationId: req.body.conversationId
            };
          }
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
          // Get all courses to find the matching one
          const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken);
          
          if (!coursesResponse || !coursesResponse.courses || !Array.isArray(coursesResponse.courses)) {
            return {
              message: "I couldn't find your courses. Please try again.",
              conversationId: req.body.conversationId || generateConversationId()
            };
          }
          
          const searchTerm = (parameters.courseName || parameters.courseIdentifier || '').toLowerCase();
          const matchingCourses = coursesResponse.courses.filter(course => 
            course.name && course.name.toLowerCase().includes(searchTerm)
          );
          
          if (matchingCourses.length === 0) {
            return {
              message: `I couldn't find any courses matching "${parameters.courseName || parameters.courseIdentifier}".`,
              conversationId: req.body.conversationId || generateConversationId()
            };
          } else if (matchingCourses.length === 1) {
            // Exact match - create the assignment immediately, with or without materials
            const courseId = matchingCourses[0].id;
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
                userToken
              );

              return {
                message: `Successfully created the assignment "${parameters.title}" in ${matchingCourses[0].name}.`,
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
          } else {
            // Multiple matches - ask for clarification
            return {
              type: 'COURSE_DISAMBIGUATION_NEEDED',
              message: `I found multiple courses matching "${parameters.courseName || parameters.courseIdentifier}". Which one would you like to create an assignment for?`,
              options: matchingCourses.map(course => ({
                id: course.id,
                name: course.name,
                section: course.section || "No section"
              })),
              assignmentData: {
                title: parameters.title,
                description: parameters.description || '',
                materials: parameters.materials || [],
                maxPoints: parameters.maxPoints || 100,
                dueDate: parameters.dueDate,
                dueTime: parameters.dueTime
              },
              conversationId: req.body.conversationId || generateConversationId()
            };
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
        // Get all courses to find the matching one
        const coursesResponse = await makeApiCall(
          `${baseUrl}/api/classroom`,
          'GET',
          null,
          userToken
        );

        if (!coursesResponse || !coursesResponse.courses || !Array.isArray(coursesResponse.courses)) {
          return {
            message: 'Failed to retrieve courses. Please try again.',
            conversationId: req.body.conversationId
          };
        }

        // Find courses matching the name
        const matchingCourses = coursesResponse.courses.filter(course =>
          course.name.toLowerCase().includes(parameters.courseName.toLowerCase())
        );

        const studentEmails = parameters.studentEmails || parameters.emails;
        if (matchingCourses.length === 0) {
          return {
            message: `I couldn't find any courses matching "${parameters.courseName}".`,
            conversationId: req.body.conversationId
          };
        } else if (matchingCourses.length === 1) {
          // Exact match - invite the students
          const courseId = matchingCourses[0].id;
          const invitationPromises = studentEmails.map(email =>
            makeApiCall(
              `${baseUrl}/api/classroom/${courseId}/invite`,
              'POST',
              { email },
              userToken
            )
          );

          try {
            await Promise.all(invitationPromises);
            return {
              message: `Successfully invited ${studentEmails.length} students to ${matchingCourses[0].name}.`,
              conversationId: req.body.conversationId
            };
          } catch (error) {
            return {
              message: `Failed to invite students: ${error.message}`,
              conversationId: req.body.conversationId
            };
          }
        } else {
          // Multiple matches - ask for clarification
          return {
            message: `I found multiple courses matching "${parameters.courseName}". Which one would you like to invite the students to?`,
            options: matchingCourses.map(course => ({
              id: course.id,
              name: course.name,
              section: course.section || "No section"
            })),
            studentEmails: studentEmails,
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
          userToken
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
            userToken
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
              userToken
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
                userToken
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
              userToken
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
        // Get all courses
        const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken);
        if (!coursesResponse || !coursesResponse.courses || !Array.isArray(coursesResponse.courses)) {
          return {
            message: "I couldn't find your courses. Please try again.",
            conversationId: req.body.conversationId
          };
        }
        const searchTerm = parameters.courseName.toLowerCase();
        const matchingCourses = coursesResponse.courses.filter(course =>
          course.name && course.name.toLowerCase().includes(searchTerm)
        );
        if (matchingCourses.length === 0) {
          return {
            message: `I couldn't find any courses matching "${parameters.courseName}".`,
            conversationId: req.body.conversationId
          };
        } else if (matchingCourses.length > 1) {
          return {
            message: `I found multiple courses matching "${parameters.courseName}". Which one do you mean?`,
            options: matchingCourses.map(course => ({
              id: course.id,
              name: course.name,
              section: course.section || "No section"
            })),
            conversationId: req.body.conversationId
          };
        }
        const courseId = matchingCourses[0].id;
        // 2. Find the assignment by title
        const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${courseId}/assignments`, 'GET', null, userToken);
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
            message: `I couldn't find any assignments matching "${parameters.assignmentTitle}" in ${matchingCourses[0].name}.`,
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
        const submissions = await makeApiCall(`${baseUrl}/api/courses/${courseId}/assignments/${assignmentId}/submissions`, 'GET', null, userToken);
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
        let message = `Submissions for "${matchingAssignments[0].title}" in ${matchingCourses[0].name}:\n`;
        message += `\nSubmitted (${turnedIn.length}):\n`;
        message += turnedIn.map(s => `• ${s.userId || s.id} (${s.state})`).join('\n') || 'None';
        message += `\n\nNot Submitted (${notTurnedIn.length}):\n`;
        message += notTurnedIn.map(s => `• ${s.userId || s.id} (${s.state})`).join('\n') || 'None';
        return {
          message,
          submissions: submissionList,
          conversationId: req.body.conversationId
        };
      }
      
      case 'GRADE_ASSIGNMENT': {
        // 1. Validate parameters
        const { courseName, assignmentTitle, studentEmail, assignedGrade, draftGrade } = parameters;
        if (!courseName || !assignmentTitle || !studentEmail || (assignedGrade === undefined && draftGrade === undefined)) {
          return { message: "Please provide course, assignment, student, and grade information.", conversationId: req.body.conversationId };
        }

        // 2. Find the course
        const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken);
        if (!coursesResponse || !coursesResponse.courses || !Array.isArray(coursesResponse.courses)) {
          return { message: `Course list not found.`, conversationId: req.body.conversationId };
        }
        const course = coursesResponse.courses.find(c => c.name && c.name.toLowerCase().includes(courseName.toLowerCase()));
        if (!course) return { message: `Course "${courseName}" not found.`, conversationId: req.body.conversationId };

        // 3. Find the assignment
        const assignmentsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments`, 'GET', null, userToken);
        const assignments = Array.isArray(assignmentsResponse)
          ? assignmentsResponse
          : Array.isArray(assignmentsResponse.courses)
            ? assignmentsResponse.courses
            : [];
        const assignment = assignments.find(a => a.title && a.title.toLowerCase().includes(assignmentTitle.toLowerCase()));
        if (!assignment) return { message: `Assignment "${assignmentTitle}" not found.`, conversationId: req.body.conversationId };

        // 4. Find the student submission
        const submissionsResponse = await makeApiCall(`${baseUrl}/api/courses/${course.id}/assignments/${assignment.id}/submissions`, 'GET', null, userToken);
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
            const studentsList = await makeApiCall(`${baseUrl}/api/classroom/${course.id}/students`, 'GET', null, userToken);
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
            userToken
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
            userToken
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
        // Get all courses
        const coursesResponse = await makeApiCall(`${baseUrl}/api/classroom`, 'GET', null, userToken);
        if (!coursesResponse || !coursesResponse.courses || !Array.isArray(coursesResponse.courses)) {
          return {
            message: "I couldn't find your courses. Please try again.",
            conversationId: req.body.conversationId
          };
        }
        const searchTerm = parameters.courseName.toLowerCase();
        const matchingCourses = coursesResponse.courses.filter(course =>
          course.name && course.name.toLowerCase().includes(searchTerm)
        );
        if (matchingCourses.length === 0) {
          return {
            message: `I couldn't find any courses matching "${parameters.courseName}".`,
            conversationId: req.body.conversationId
          };
        } else if (matchingCourses.length > 1) {
          return {
            message: `I found multiple courses matching "${parameters.courseName}". Which one do you mean?`,
            options: matchingCourses.map(course => ({
              id: course.id,
              name: course.name,
              section: course.section || "No section"
            })),
            conversationId: req.body.conversationId
          };
        }
        const courseId = matchingCourses[0].id;
        // Get students
        const studentsList = await makeApiCall(`${baseUrl}/api/classroom/${courseId}/students`, 'GET', null, userToken);
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
            message: `No students are currently enrolled in ${matchingCourses[0].name}.`,
            conversationId: req.body.conversationId
          };
        }
        const studentLines = students.map(s => `• ${s.profile && s.profile.name && s.profile.name.fullName ? s.profile.name.fullName : s.userId} (${s.profile && s.profile.emailAddress ? s.profile.emailAddress : 'No email'})`).join('\n');
        return {
          message: `Enrolled students in ${matchingCourses[0].name}:\n${studentLines}`,
          students,
          conversationId: req.body.conversationId
        };
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