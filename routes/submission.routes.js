const express = require('express');
const router = express.Router();
const cors = require('cors');
const submissionController = require('../controllers/submission.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Handle preflight requests for all routes in this router
router.options('*', cors());

// All routes require authentication (but OPTIONS requests pass through)
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return authenticate(req, res, next);
});

// Create submission (students only)
router.post('/', submissionController.createSubmission);

// Get my submissions
router.get('/my-submissions', submissionController.getMySubmissions);

// Get specific submission
router.get('/assignment/:assignmentId', submissionController.getSubmission);

module.exports = router;

