const express = require('express');
const router = express.Router();
const aiConfigController = require('../controllers/aiConfig.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * AI Configuration Routes
 * All routes require authentication
 */

// Create or update AI configuration
router.post('/', authenticate, aiConfigController.upsertAiConfig);

// Get all AI configurations for current user
router.get('/', authenticate, aiConfigController.getAllAiConfigs);

// Get specific AI configuration
router.get('/:provider', authenticate, aiConfigController.getAiConfig);

// Delete AI configuration
router.delete('/:provider', authenticate, aiConfigController.deleteAiConfig);

// Test AI configuration (doesn't save)
router.post('/test', authenticate, aiConfigController.testAiConfig);

module.exports = router;

