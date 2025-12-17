const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submission.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Create submission (students only)
router.post('/', submissionController.createSubmission);

// Get my submissions (student)
router.get('/my-submissions', submissionController.getMySubmissions);

// Get my specific submission for an assignment (student)
router.get('/assignment/:assignmentId', submissionController.getSubmission);

// Get all submissions for an assignment (teacher)
router.get('/assignment/:assignmentId/all', submissionController.getAssignmentSubmissions);

// Grade a submission (teacher only)
router.patch('/:submissionId/grade', submissionController.gradeSubmission);

module.exports = router;

