const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/newAssignment.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Create assignment (teachers and super_admin only)
router.post('/', assignmentController.createAssignment);

// Get assignments for a course
router.get('/course/:courseId', assignmentController.getAssignmentsByCourse);

// Get upcoming assignments
router.get('/upcoming', assignmentController.getUpcomingAssignments);

// Get a single assignment
router.get('/:assignmentId', assignmentController.getAssignmentById);

// Update assignment (teachers and super_admin only)
router.put('/:assignmentId', assignmentController.updateAssignment);

// Delete assignment (teachers and super_admin only)
router.delete('/:assignmentId', assignmentController.deleteAssignment);

module.exports = router;

