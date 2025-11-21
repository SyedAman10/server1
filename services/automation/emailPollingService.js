const emailAgentConfigModel = require('../../models/emailAgentConfig.model');
const automationWorkflowModel = require('../../models/automationWorkflow.model');
const gmailService = require('./gmailIntegrationService');
const { executeWorkflow } = require('./automationExecutionEngine');

/**
 * Email Polling Service
 * Polls email accounts for new messages and triggers workflows
 */

let pollingInterval = null;
let isPolling = false;

// Start email polling
function startEmailPolling(intervalSeconds = 60) {
  if (pollingInterval) {
    console.log('⚠️  Email polling is already running');
    return;
  }

  console.log(`🚀 Starting email polling (interval: ${intervalSeconds}s)`);
  
  // Run immediately once
  pollAllEmailAgents();
  
  // Then run at intervals
  pollingInterval = setInterval(() => {
    if (!isPolling) {
      pollAllEmailAgents();
    }
  }, intervalSeconds * 1000);
}

// Stop email polling
function stopEmailPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('🛑 Email polling stopped');
  }
}

// Poll all email agents
async function pollAllEmailAgents() {
  if (isPolling) {
    console.log('⏭️  Skipping poll - previous poll still running');
    return;
  }

  isPolling = true;
  
  try {
    console.log('📧 Polling email agents...');
    
    // Get all email configs that need polling
    const emailConfigs = await emailAgentConfigModel.getEmailConfigsForPolling();
    
    if (emailConfigs.length === 0) {
      console.log('   No email agents to poll');
      return;
    }

    console.log(`   Found ${emailConfigs.length} email agent(s) to poll`);
    
    // Poll each email agent
    for (const emailConfig of emailConfigs) {
      try {
        await pollEmailAgent(emailConfig);
      } catch (error) {
        console.error(`   ❌ Error polling agent ${emailConfig.agent_name}:`, error.message);
      }
    }
    
    console.log('✅ Email polling completed');
  } catch (error) {
    console.error('❌ Error in email polling:', error);
  } finally {
    isPolling = false;
  }
}

// Poll a single email agent
async function pollEmailAgent(emailConfig) {
  try {
    console.log(`   📬 Polling ${emailConfig.agent_name} (${emailConfig.email_address})`);
    
    // Get active workflows for this agent
    const workflows = await automationWorkflowModel.getActiveWorkflows(emailConfig.agent_id);
    
    if (workflows.length === 0) {
      console.log(`      No active workflows for this agent`);
      await emailAgentConfigModel.updateEmailConfig(emailConfig.agent_id, {
        lastCheckedAt: new Date()
      });
      return;
    }

    // Refresh tokens if needed
    let tokens = emailConfig.oauth_tokens;
    if (tokens && tokens.expiry_date && tokens.expiry_date < Date.now()) {
      console.log(`      ⏳ Access token expired, refreshing...`);
      try {
        tokens = await gmailService.refreshAccessToken(tokens.refresh_token);
        await emailAgentConfigModel.updateEmailConfig(emailConfig.agent_id, {
          oauthTokens: tokens
        });
        console.log(`      ✅ Token refreshed successfully`);
      } catch (refreshError) {
        console.error(`      ❌ Token refresh failed:`, refreshError.message);
        console.error(`      → Agent "${emailConfig.agent_name}" needs re-authorization`);
        // Skip this agent for now - user needs to re-authorize
        return;
      }
    }

    // Get filters from config
    const filters = emailConfig.filters || {};
    
    // Add filter for only new emails (after last check)
    if (emailConfig.last_email_id) {
      // Gmail doesn't support "after email ID", so we'll filter by date
      if (emailConfig.last_checked_at) {
        const lastCheckedDate = new Date(emailConfig.last_checked_at);
        const dateStr = Math.floor(lastCheckedDate.getTime() / 1000); // Unix timestamp
        filters.after = dateStr.toString();
      }
    }

    // Always check for unread emails for inbound agents
    filters.isUnread = true;

    // List new emails
    const emails = await gmailService.listEmails(tokens, filters);
    
    if (emails.length === 0) {
      console.log(`      No new emails`);
      await emailAgentConfigModel.updateEmailConfig(emailConfig.agent_id, {
        lastCheckedAt: new Date()
      });
      return;
    }

    console.log(`      Found ${emails.length} new email(s)`);

    // Process each email
    for (const email of emails) {
      console.log(`      📨 Processing email: ${email.subject}`);
      
      // Trigger workflows for this email
      for (const workflow of workflows) {
        try {
          // Check if trigger conditions match
          if (shouldTriggerWorkflow(workflow, email, emailConfig)) {
            console.log(`         🔔 Triggering workflow: ${workflow.name}`);
            
            await executeWorkflow(workflow.id, {
              email,
              agent: {
                id: emailConfig.agent_id,
                name: emailConfig.agent_name,
                type: 'email_inbound'
              }
            });
          }
        } catch (workflowError) {
          console.error(`         ❌ Error executing workflow ${workflow.name}:`, workflowError.message);
        }
      }
    }

    // Update last checked time and last email ID
    await emailAgentConfigModel.updateEmailConfig(emailConfig.agent_id, {
      lastCheckedAt: new Date(),
      lastEmailId: emails[0].id // Store the most recent email ID
    });

  } catch (error) {
    console.error(`   ❌ Error polling email agent:`, error);
    throw error;
  }
}

// Check if workflow should be triggered
function shouldTriggerWorkflow(workflow, email, emailConfig) {
  const triggerConfig = workflow.trigger_config;
  
  // Check trigger type
  if (triggerConfig.type !== 'email_received') {
    return false;
  }

  // Check filters
  if (triggerConfig.filters) {
    const filters = triggerConfig.filters;
    
    // Check sender filter
    if (filters.from) {
      const fromPattern = new RegExp(filters.from, 'i');
      if (!fromPattern.test(email.from)) {
        return false;
      }
    }

    // Check recipient filter
    if (filters.to) {
      const toPattern = new RegExp(filters.to, 'i');
      if (!toPattern.test(email.to)) {
        return false;
      }
    }

    // Check subject filter
    if (filters.subject) {
      const subjectPattern = new RegExp(filters.subject, 'i');
      if (!subjectPattern.test(email.subject)) {
        return false;
      }
    }

    // Check body filter
    if (filters.bodyContains) {
      const bodyPattern = new RegExp(filters.bodyContains, 'i');
      if (!bodyPattern.test(email.body)) {
        return false;
      }
    }

    // Check has attachment filter
    if (filters.hasAttachment !== undefined) {
      const hasAttachment = email.attachments && email.attachments.length > 0;
      if (filters.hasAttachment !== hasAttachment) {
        return false;
      }
    }

    // Check label filter
    if (filters.labels && filters.labels.length > 0) {
      const hasRequiredLabel = filters.labels.some(label => 
        email.labelIds.includes(label)
      );
      if (!hasRequiredLabel) {
        return false;
      }
    }
  }

  // All filters passed
  return true;
}

// Poll a specific agent immediately (manual trigger)
async function pollAgentNow(agentId) {
  try {
    const emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agentId);
    
    if (!emailConfig) {
      throw new Error('Email configuration not found for this agent');
    }

    // Add agent details
    const agentModel = require('../../models/automationAgent.model');
    const agent = await agentModel.getAgentById(agentId);
    
    emailConfig.agent_id = agent.id;
    emailConfig.agent_name = agent.name;
    emailConfig.agent_status = agent.status;
    emailConfig.user_id = agent.user_id;

    await pollEmailAgent(emailConfig);
    
    return {
      success: true,
      message: 'Email agent polled successfully'
    };
  } catch (error) {
    console.error('Error polling agent:', error);
    throw error;
  }
}

module.exports = {
  startEmailPolling,
  stopEmailPolling,
  pollAllEmailAgents,
  pollAgentNow
};

