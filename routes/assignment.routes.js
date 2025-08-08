const express = require('express');
const {
  createAssignmentController,
  listAssignmentsController,
  getAssignmentController,
  updateAssignmentController,
  deleteAssignmentController,
  getStudentSubmissionsController
} = require('../controllers/assignment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all assignment routes
router.use(authenticate);

// Assignment routes
router.post('/:courseId/assignments', createAssignmentController);
router.get('/:courseId/assignments', listAssignmentsController);
router.get('/:courseId/assignments/:assignmentId', getAssignmentController);
router.patch('/:courseId/assignments/:assignmentId', updateAssignmentController);
router.delete('/:courseId/assignments/:assignmentId', deleteAssignmentController);
router.get('/:courseId/assignments/:assignmentId/submissions', getStudentSubmissionsController);

module.exports = router; 