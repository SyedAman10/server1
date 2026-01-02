const express = require('express');
const router = express.Router();
const aiGradingController = require('../controllers/aiGrading.controller');
const teacherAIPreferencesController = require('../controllers/teacherAIPreferences.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Public routes (for approve/reject links in emails)
router.get('/grade/:token', aiGradingController.getGradeByToken);
router.post('/approve/:token', aiGradingController.approveGrade);
router.post('/reject/:token', aiGradingController.rejectGrade);

// Protected routes (require authentication)
router.use(authenticate);

// === Teacher Global Preferences ===
// Get teacher's global AI preferences
router.get('/preferences', teacherAIPreferencesController.getPreferences);

// Update teacher's global AI preferences
router.put('/preferences', teacherAIPreferencesController.updatePreferences);

// Apply default settings to all existing assignments
router.post('/preferences/apply-to-all', teacherAIPreferencesController.applyToAllAssignments);

// === Per-Assignment Settings ===
// Get AI grading settings for an assignment
router.get('/settings/:assignmentId', aiGradingController.getGradingSettings);

// Update AI grading settings for an assignment
router.put('/settings/:assignmentId', aiGradingController.updateGradingSettings);

// Generate rubric suggestions
router.post('/rubric/:assignmentId', aiGradingController.generateRubric);

// Get pending grades for teacher
router.get('/pending', aiGradingController.getPendingGrades);

module.exports = router;

