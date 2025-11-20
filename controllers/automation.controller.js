const automationAgentModel = require('../models/automationAgent.model');
const automationWorkflowModel = require('../models/automationWorkflow.model');
const automationExecutionModel = require('../models/automationExecution.model');
const emailAgentConfigModel = require('../models/emailAgentConfig.model');
const gmailService = require('../services/automation/gmailIntegrationService');
const { executeWorkflow } = require('../services/automation/automationExecutionEngine');
const { getAuthUrl, getTokensFromCode } = require('../integrations/google.oauth');

/**
 * Automation Controller
 * Handles HTTP requests for automation agents, workflows, and executions
 */

// ==================== AGENTS ====================

// Create agent
exports.createAgent = async (req, res) => {
  try {
    const { name, description, type, config } = req.body;
    const userId = req.user.id;

    if (!name || !type || !config) {
      return res.status(400).json({
        success: false,
        message: 'Name, type, and config are required'
      });
    }

    const agent = await automationAgentModel.createAgent({
      userId,
      name,
      description,
      type,
      config
    });

    return res.status(201).json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create agent'
    });
  }
};

// Get user's agents
exports.getUserAgents = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    const agents = type
      ? await automationAgentModel.getAgentsByType(userId, type)
      : await automationAgentModel.getAgentsByUser(userId);

    // Add email config for email agents
    for (const agent of agents) {
      if (agent.type.includes('email')) {
        const emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agent.id);
        agent.emailConfig = emailConfig;
        
        // Add convenience fields for frontend
        agent.isGmailConnected = !!(emailConfig && emailConfig.email_address);
        agent.connectedEmail = emailConfig ? emailConfig.email_address : null;
      }
    }

    return res.status(200).json({
      success: true,
      agents,
      count: agents.length
    });
  } catch (error) {
    console.error('Error getting agents:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get agents'
    });
  }
};

// Get agent by ID
exports.getAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;

    const agent = await automationAgentModel.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check ownership
    if (agent.user_id !== userId && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this agent'
      });
    }

    // Get email config if it's an email agent
    if (agent.type.includes('email')) {
      const emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agent.id);
      agent.emailConfig = emailConfig;
      
      // Add convenience fields for frontend
      agent.isGmailConnected = !!(emailConfig && emailConfig.email_address);
      agent.connectedEmail = emailConfig ? emailConfig.email_address : null;
    }

    return res.status(200).json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error getting agent:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get agent'
    });
  }
};

// Update agent
exports.updateAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const agent = await automationAgentModel.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check ownership
    if (agent.user_id !== userId && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this agent'
      });
    }

    const updatedAgent = await automationAgentModel.updateAgent(agentId, updates);

    return res.status(200).json({
      success: true,
      agent: updatedAgent
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update agent'
    });
  }
};

// Delete agent
exports.deleteAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;

    const agent = await automationAgentModel.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check ownership
    if (agent.user_id !== userId && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this agent'
      });
    }

    await automationAgentModel.deleteAgent(agentId);

    return res.status(200).json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete agent'
    });
  }
};

// Toggle agent status
exports.toggleAgentStatus = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!['active', 'inactive', 'paused'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, inactive, or paused'
      });
    }

    const agent = await automationAgentModel.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check ownership
    if (agent.user_id !== userId && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this agent'
      });
    }

    const updatedAgent = await automationAgentModel.updateAgentStatus(agentId, status);

    return res.status(200).json({
      success: true,
      agent: updatedAgent
    });
  } catch (error) {
    console.error('Error toggling agent status:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle agent status'
    });
  }
};

// ==================== EMAIL CONFIGURATION ====================

// Setup Gmail OAuth
exports.setupGmailOAuth = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;

    const agent = await automationAgentModel.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check ownership
    if (agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to configure this agent'
      });
    }

    // Generate OAuth URL using existing integration with state parameter
    const state = JSON.stringify({ 
      type: 'automation',
      userId, 
      agentId 
    });
    const authUrl = getAuthUrl(state);

    return res.status(200).json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('Error setting up Gmail OAuth:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to setup Gmail OAuth'
    });
  }
};

// Handle Gmail OAuth callback (called from main auth callback)
exports.handleGmailCallback = async (code, userId, agentId) => {
  try {
    // Exchange code for tokens using existing integration
    const tokens = await getTokensFromCode(code);

    // Get Gmail profile
    const profile = await gmailService.getProfile(tokens);

    // Check if email config exists
    let emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agentId);

    if (emailConfig) {
      // Update existing config
      await emailAgentConfigModel.updateEmailConfig(agentId, {
        emailAddress: profile.emailAddress,
        oauthTokens: tokens
      });
    } else {
      // Create new config
      await emailAgentConfigModel.createEmailConfig({
        agentId,
        emailAddress: profile.emailAddress,
        provider: 'gmail',
        oauthTokens: tokens
      });
    }

    console.log(`✅ Gmail authorization successful for agent ${agentId}: ${profile.emailAddress}`);

    return {
      success: true,
      message: 'Gmail authorization successful',
      emailAddress: profile.emailAddress
    };
  } catch (error) {
    console.error('Error handling Gmail callback:', error);
    throw error;
  }
};

// Update email config
exports.updateEmailConfig = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const agent = await automationAgentModel.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check ownership
    if (agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to configure this agent'
      });
    }

    const emailConfig = await emailAgentConfigModel.updateEmailConfig(agentId, updates);

    return res.status(200).json({
      success: true,
      emailConfig
    });
  } catch (error) {
    console.error('Error updating email config:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update email config'
    });
  }
};

// ==================== WORKFLOWS ====================

// Create workflow
exports.createWorkflow = async (req, res) => {
  try {
    const { agentId, name, description, triggerConfig, actions, conditions } = req.body;
    const userId = req.user.id;

    if (!agentId || !name || !triggerConfig || !actions) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID, name, trigger config, and actions are required'
      });
    }

    // Check agent ownership
    const agent = await automationAgentModel.getAgentById(agentId);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create workflows for this agent'
      });
    }

    const workflow = await automationWorkflowModel.createWorkflow({
      agentId,
      name,
      description,
      triggerConfig,
      actions,
      conditions
    });

    return res.status(201).json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create workflow'
    });
  }
};

// Get workflows by agent
exports.getWorkflowsByAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;

    // Check agent ownership
    const agent = await automationAgentModel.getAgentById(agentId);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view workflows for this agent'
      });
    }

    const workflows = await automationWorkflowModel.getWorkflowsByAgent(agentId);

    return res.status(200).json({
      success: true,
      workflows,
      count: workflows.length
    });
  } catch (error) {
    console.error('Error getting workflows:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get workflows'
    });
  }
};

// Get workflow by ID
exports.getWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;

    const workflow = await automationWorkflowModel.getWorkflowById(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    // Check agent ownership
    const agent = await automationAgentModel.getAgentById(workflow.agent_id);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this workflow'
      });
    }

    return res.status(200).json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('Error getting workflow:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get workflow'
    });
  }
};

// Update workflow
exports.updateWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const workflow = await automationWorkflowModel.getWorkflowById(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    // Check agent ownership
    const agent = await automationAgentModel.getAgentById(workflow.agent_id);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this workflow'
      });
    }

    const updatedWorkflow = await automationWorkflowModel.updateWorkflow(workflowId, updates);

    return res.status(200).json({
      success: true,
      workflow: updatedWorkflow
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update workflow'
    });
  }
};

// Delete workflow
exports.deleteWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;

    const workflow = await automationWorkflowModel.getWorkflowById(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    // Check agent ownership
    const agent = await automationAgentModel.getAgentById(workflow.agent_id);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this workflow'
      });
    }

    await automationWorkflowModel.deleteWorkflow(workflowId);

    return res.status(200).json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete workflow'
    });
  }
};

// Execute workflow manually
exports.executeWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;
    const triggerData = req.body.triggerData || {};

    const workflow = await automationWorkflowModel.getWorkflowById(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    // Check agent ownership
    const agent = await automationAgentModel.getAgentById(workflow.agent_id);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to execute this workflow'
      });
    }

    const result = await executeWorkflow(workflowId, triggerData);

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error executing workflow:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute workflow'
    });
  }
};

// ==================== EXECUTIONS ====================

// Get executions by agent
exports.getExecutionsByAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    // Check agent ownership
    const agent = await automationAgentModel.getAgentById(agentId);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view executions for this agent'
      });
    }

    const executions = await automationExecutionModel.getExecutionsByAgent(
      agentId,
      parseInt(limit),
      parseInt(offset)
    );

    return res.status(200).json({
      success: true,
      executions,
      count: executions.length
    });
  } catch (error) {
    console.error('Error getting executions:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get executions'
    });
  }
};

// Get execution stats
exports.getExecutionStats = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;

    // Check agent ownership
    const agent = await automationAgentModel.getAgentById(agentId);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view stats for this agent'
      });
    }

    const stats = await automationExecutionModel.getExecutionStats(agentId);

    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting execution stats:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get execution stats'
    });
  }
};

