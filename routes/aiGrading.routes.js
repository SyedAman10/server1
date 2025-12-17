const express = require('express');
const router = express.Router();
const aiGradingController = require('../controllers/aiGrading.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Public routes (for approve/reject links in emails)
router.post('/approve/:token', aiGradingController.approveGrade);
router.post('/reject/:token', aiGradingController.rejectGrade);

// Protected routes (require authentication)
router.use(authenticate);

// Get AI grading settings for an assignment
router.get('/settings/:assignmentId', aiGradingController.getGradingSettings);

// Update AI grading settings for an assignment
router.put('/settings/:assignmentId', aiGradingController.updateGradingSettings);

// Generate rubric suggestions
router.post('/rubric/:assignmentId', aiGradingController.generateRubric);

// Get pending grades for teacher
router.get('/pending', aiGradingController.getPendingGrades);

module.exports = router;

