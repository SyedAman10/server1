const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automation.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

// All automation routes require authentication
router.use(authenticate);

// ==================== AGENTS ====================
router.post('/agents', automationController.createAgent);
router.get('/agents', automationController.getUserAgents);
router.get('/agents/:agentId', automationController.getAgent);
router.put('/agents/:agentId', automationController.updateAgent);
router.delete('/agents/:agentId', automationController.deleteAgent);
router.patch('/agents/:agentId/status', automationController.toggleAgentStatus);

// ==================== EMAIL CONFIGURATION ====================
router.get('/agents/:agentId/gmail/auth', automationController.setupGmailOAuth);
// Gmail callback is handled by /api/auth/google/callback with state parameter
router.put('/agents/:agentId/email-config', automationController.updateEmailConfig);

// ==================== WORKFLOWS ====================
router.post('/workflows', automationController.createWorkflow);
router.get('/agents/:agentId/workflows', automationController.getWorkflowsByAgent);
router.get('/workflows/:workflowId', automationController.getWorkflow);
router.put('/workflows/:workflowId', automationController.updateWorkflow);
router.delete('/workflows/:workflowId', automationController.deleteWorkflow);
router.post('/workflows/:workflowId/execute', automationController.executeWorkflow);

// ==================== EXECUTIONS ====================
router.get('/agents/:agentId/executions', automationController.getExecutionsByAgent);
router.get('/agents/:agentId/stats', automationController.getExecutionStats);

module.exports = router;

