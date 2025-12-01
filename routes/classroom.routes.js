const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');

// Import DATABASE controllers (no Google Classroom)
const courseController = require('../controllers/course.controller');
const announcementController = require('../controllers/announcement.controller');
const invitationController = require('../controllers/invitation.controller');

const router = express.Router();

// Protect all classroom routes
router.use(authenticate);

// ========================================
// COURSE ROUTES (Database-driven)
// ========================================

// GET /api/classroom - List all courses (backwards compatible)
router.get('/', async (req, res) => {
  console.log('DEBUG: GET /api/classroom - Redirecting to database');
  
  // Create a custom response handler to capture the result
  const originalJson = res.json.bind(res);
  let intercepted = false;
  
  res.json = function(data) {
    if (!intercepted) {
      intercepted = true;
      
      // If the response has a 'courses' property, return just the array for backwards compatibility
      if (data && data.courses && Array.isArray(data.courses)) {
        console.log('DEBUG: Transforming response to array format (backwards compatible)');
        return originalJson(data.courses);
      }
      
      // Otherwise, return as-is
      return originalJson(data);
    }
  };
  
  return courseController.getCourses(req, res);
});

// POST /api/classroom - Create course (backwards compatible)
router.post('/', (req, res) => {
  console.log('DEBUG: POST /api/classroom - Redirecting to database');
  return courseController.createCourse(req, res);
});

// GET /api/classroom/:courseId - Get single course (backwards compatible)
router.get('/:courseId', (req, res) => {
  console.log('DEBUG: GET /api/classroom/:courseId - Redirecting to database');
  return courseController.getCourseById(req, res);
});

// PATCH /api/classroom/:courseId - Update course (backwards compatible)
router.patch('/:courseId', (req, res) => {
  console.log('DEBUG: PATCH /api/classroom/:courseId - Redirecting to database');
  return courseController.updateCourse(req, res);
});

// DELETE /api/classroom/:courseId - Delete course (backwards compatible)
router.delete('/:courseId', (req, res) => {
  console.log('DEBUG: DELETE /api/classroom/:courseId - Redirecting to database');
  return courseController.deleteCourse(req, res);
});

// PATCH /api/classroom/:courseId/archive - Archive course
router.patch('/:courseId/archive', async (req, res) => {
  console.log('DEBUG: PATCH /api/classroom/:courseId/archive - Redirecting to database');
  // For now, just return success (archiving can be implemented later)
  res.json({ success: true, message: 'Course archived (not implemented yet)' });
});

// ========================================
// ANNOUNCEMENT ROUTES (Database-driven)
// ========================================

// POST /api/classroom/:courseId/announcements - Create announcement (backwards compatible)
router.post('/:courseId/announcements', async (req, res) => {
  console.log('DEBUG: POST /api/classroom/:courseId/announcements - Redirecting to database');
  // Add courseId from URL params to body
  req.body.courseId = req.params.courseId;
  return announcementController.createAnnouncement(req, res);
});

// GET /api/classroom/:courseId/announcements - Get announcements (backwards compatible)
router.get('/:courseId/announcements', async (req, res) => {
  console.log('DEBUG: GET /api/classroom/:courseId/announcements - Redirecting to database');
  
  // Intercept response to transform format
  const originalJson = res.json.bind(res);
  let intercepted = false;
  
  res.json = function(data) {
    if (!intercepted) {
      intercepted = true;
      
      // Transform to array format for backwards compatibility
      if (data && data.announcements && Array.isArray(data.announcements)) {
        console.log('DEBUG: Transforming announcements to array format (backwards compatible)');
        return originalJson(data.announcements);
      }
      
      return originalJson(data);
    }
  };
  
  // Set courseId in params for the controller
  req.params.courseId = req.params.courseId;
  return announcementController.getAnnouncementsByCourse(req, res);
});

// ========================================
// STUDENT ROUTES (Database-driven)
// ========================================

// GET /api/classroom/:courseId/students - List students (backwards compatible)
router.get('/:courseId/students', async (req, res) => {
  console.log('DEBUG: GET /api/classroom/:courseId/students - Redirecting to database');
  
  // Intercept response to transform format
  const originalJson = res.json.bind(res);
  let intercepted = false;
  
  res.json = function(data) {
    if (!intercepted) {
      intercepted = true;
      
      // Transform to array format for backwards compatibility
      if (data && data.students && Array.isArray(data.students)) {
        console.log('DEBUG: Transforming students to array format (backwards compatible)');
        return originalJson(data.students);
      }
      
      return originalJson(data);
    }
  };
  
  req.params.id = req.params.courseId; // Map courseId to id for controller
  return courseController.getEnrolledStudents(req, res);
});

// GET /api/classroom/:courseId/enrolled-students - List enrolled students (backwards compatible)
router.get('/:courseId/enrolled-students', (req, res) => {
  console.log('DEBUG: GET /api/classroom/:courseId/enrolled-students - Redirecting to database');
  req.params.id = req.params.courseId; // Map courseId to id for controller
  return courseController.getEnrolledStudents(req, res);
});

// ========================================
// INVITATION ROUTES (Database-driven)
// ========================================

// POST /api/classroom/:courseId/invite - Invite students (backwards compatible)
router.post('/:courseId/invite', async (req, res) => {
  console.log('DEBUG: POST /api/classroom/:courseId/invite - Using invitation system');
  try {
    // Use the invitation controller
    req.body.courseId = req.params.courseId;
    return invitationController.createInvitation(req, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/classroom/:courseId/invite-teachers - Invite teachers
router.post('/:courseId/invite-teachers', async (req, res) => {
  console.log('DEBUG: POST /api/classroom/:courseId/invite-teachers');
  // For now, return not implemented
  res.status(501).json({ error: 'Teacher invitations not implemented yet' });
});

// ========================================
// GRADES ROUTE (Placeholder)
// ========================================

// GET /api/classroom/:courseId/grades - Get grades
router.get('/:courseId/grades', async (req, res) => {
  console.log('DEBUG: GET /api/classroom/:courseId/grades');
  // For now, return empty grades
  res.json({ success: true, grades: [] });
});

module.exports = router;
 