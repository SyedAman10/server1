const express = require('express');
const {
  createAssignmentController,
  listAssignmentsController,
  getAssignmentController,
  updateAssignmentController,
  deleteAssignmentController,
  getStudentSubmissionsController,
  updateSubmissionGradeController,
  returnSubmissionController
} = require('../controllers/assignment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all assignment routes
router.use(authenticate);

// Assignment routes
router.post('/courses/:courseId/assignments', createAssignmentController);
router.get('/courses/:courseId/assignments', listAssignmentsController);
router.get('/courses/:courseId/assignments/:assignmentId', getAssignmentController);
router.patch('/courses/:courseId/assignments/:assignmentId', updateAssignmentController);
router.delete('/courses/:courseId/assignments/:assignmentId', deleteAssignmentController);
router.get('/courses/:courseId/assignments/:assignmentId/submissions', getStudentSubmissionsController);

// Grading routes
router.patch('/courses/:courseId/assignments/:assignmentId/submissions/:submissionId', updateSubmissionGradeController);
router.post('/courses/:courseId/assignments/:assignmentId/submissions/:submissionId/return', returnSubmissionController);

module.exports = router; 