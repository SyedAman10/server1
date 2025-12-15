const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submission.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Create submission (students only)
router.post('/', submissionController.createSubmission);

// Get my submissions
router.get('/my-submissions', submissionController.getMySubmissions);

// Get specific submission
router.get('/assignment/:assignmentId', submissionController.getSubmission);

module.exports = router;

