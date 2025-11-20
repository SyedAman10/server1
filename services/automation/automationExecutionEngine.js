const automationAgentModel = require('../../models/automationAgent.model');
const automationWorkflowModel = require('../../models/automationWorkflow.model');
const automationExecutionModel = require('../../models/automationExecution.model');
const gmailService = require('./gmailIntegrationService');
const emailAgentConfigModel = require('../../models/emailAgentConfig.model');
const aiConfigModel = require('../../models/aiConfiguration.model');
const aiService = require('./aiService');

/**
 * Automation Execution Engine
 * Executes workflows based on triggers
 */

// Execute a workflow
async function executeWorkflow(workflowId, triggerData = {}) {
  const startTime = Date.now();
  let execution = null;

  try {
    // Get workflow details
    const workflow = await automationWorkflowModel.getWorkflowById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Get agent details
    const agent = await automationAgentModel.getAgentById(workflow.agent_id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Create execution record
    execution = await automationExecutionModel.createExecution({
      agentId: agent.id,
      workflowId: workflow.id,
      status: 'running',
      triggerData
    });

    console.log(`🚀 Executing workflow: ${workflow.name} (ID: ${workflow.id})`);

    // Check conditions if any
    if (workflow.conditions) {
      const conditionsMet = evaluateConditions(workflow.conditions, triggerData);
      if (!conditionsMet) {
        console.log('⚠️  Conditions not met, skipping execution');
        await automationExecutionModel.completeExecution(
          execution.id,
          'success',
          { message: 'Conditions not met, workflow skipped' }
        );
        return { success: true, skipped: true };
      }
    }

    // Execute actions
    const executionData = {
      actions: []
    };

    for (const action of workflow.actions) {
      try {
        const actionResult = await executeAction(action, triggerData, agent);
        executionData.actions.push({
          type: action.type,
          status: 'success',
          result: actionResult
        });
      } catch (actionError) {
        executionData.actions.push({
          type: action.type,
          status: 'failed',
          error: actionError.message
        });
        throw actionError; // Stop execution on action failure
      }
    }

    // Mark as completed
    await automationExecutionModel.completeExecution(
      execution.id,
      'success',
      executionData
    );

    // Update agent last run
    await automationAgentModel.updateAgent(agent.id, {
      lastRunAt: new Date()
    });

    console.log(`✅ Workflow executed successfully in ${Date.now() - startTime}ms`);

    return {
      success: true,
      execution,
      executionData
    };
  } catch (error) {
    console.error('❌ Workflow execution failed:', error);

    if (execution) {
      await automationExecutionModel.completeExecution(
        execution.id,
        'failed',
        null,
        error.message
      );
    }

    throw error;
  }
}

// Execute a single action
async function executeAction(action, triggerData, agent) {
  console.log(`📍 Executing action: ${action.type}`);

  switch (action.type) {
    case 'send_email':
      return await executeSendEmailAction(action, triggerData, agent);
    
    case 'forward_email':
      return await executeForwardEmailAction(action, triggerData, agent);
    
    case 'reply_to_email':
      return await executeReplyToEmailAction(action, triggerData, agent);
    
    case 'generate_ai_reply':
      return await executeGenerateAiReplyAction(action, triggerData, agent);
    
    case 'mark_as_read':
      return await executeMarkAsReadAction(action, triggerData, agent);
    
    case 'add_label':
      return await executeAddLabelAction(action, triggerData, agent);
    
    case 'save_to_database':
      return await executeSaveToDatabaseAction(action, triggerData, agent);
    
    case 'http_request':
      return await executeHttpRequestAction(action, triggerData, agent);
    
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// Execute send email action
async function executeSendEmailAction(action, triggerData, agent) {
  const emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agent.id);
  if (!emailConfig || !emailConfig.oauth_tokens) {
    throw new Error('Email configuration not found or not authorized');
  }

  // Replace template variables
  const to = replaceVariables(action.config.to, triggerData);
  const subject = replaceVariables(action.config.subject, triggerData);
  const body = replaceVariables(action.config.body, triggerData);

  await gmailService.sendEmail(emailConfig.oauth_tokens, {
    to,
    subject,
    body: body,
    html: action.config.isHtml ? body : undefined
  });

  return { to, subject, body };
}

// Execute forward email action
async function executeForwardEmailAction(action, triggerData, agent) {
  const emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agent.id);
  if (!emailConfig || !emailConfig.oauth_tokens) {
    throw new Error('Email configuration not found or not authorized');
  }

  const forwardTo = replaceVariables(action.config.forwardTo, triggerData);
  const email = triggerData.email;

  if (!email) {
    throw new Error('No email data in trigger');
  }

  await gmailService.sendEmail(emailConfig.oauth_tokens, {
    to: forwardTo,
    subject: `Fwd: ${email.subject}`,
    body: `\n\n---------- Forwarded message ---------\nFrom: ${email.from}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.body}`
  });

  return { forwardTo, originalSubject: email.subject };
}

// Execute reply to email action
async function executeReplyToEmailAction(action, triggerData, agent) {
  const emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agent.id);
  if (!emailConfig || !emailConfig.oauth_tokens) {
    throw new Error('Email configuration not found or not authorized');
  }

  const email = triggerData.email;
  if (!email) {
    throw new Error('No email data in trigger');
  }

  const replyBody = replaceVariables(action.config.replyBody, triggerData);
  
  // Strip HTML tags from original email body
  const cleanBody = stripHtml(email.body);
  
  // Format date nicely
  const formattedDate = new Date(email.date).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  await gmailService.sendEmail(emailConfig.oauth_tokens, {
    to: email.from,
    subject: `Re: ${email.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
        <p style="white-space: pre-line;">${replyBody}</p>
        <br>
        <div style="border-top: 1px solid #ccc; margin-top: 20px; padding-top: 10px; color: #666;">
          <p style="margin: 5px 0;"><strong>From:</strong> ${email.from}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${email.subject}</p>
          <br>
          <div style="border-left: 3px solid #ccc; padding-left: 10px; color: #666;">
            ${cleanBody}
          </div>
        </div>
      </div>
    `,
    body: `${replyBody}\n\n---------- Original Message ----------\nFrom: ${email.from}\nDate: ${formattedDate}\nSubject: ${email.subject}\n\n${cleanBody}`
  });

  return { replyTo: email.from, originalSubject: email.subject };
}

// Helper function to strip HTML tags
function stripHtml(html) {
  if (!html) return '';
  
  // Remove HTML tags
  let text = html.replace(/<style[^>]*>.*?<\/style>/gis, '')
                 .replace(/<script[^>]*>.*?<\/script>/gis, '')
                 .replace(/<[^>]+>/g, '')
                 .replace(/&nbsp;/g, ' ')
                 .replace(/&amp;/g, '&')
                 .replace(/&lt;/g, '<')
                 .replace(/&gt;/g, '>')
                 .replace(/&quot;/g, '"')
                 .replace(/&#39;/g, "'");
  
  // Clean up multiple spaces and newlines
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Execute generate AI reply action
async function executeGenerateAiReplyAction(action, triggerData, agent) {
  const emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agent.id);
  if (!emailConfig || !emailConfig.oauth_tokens) {
    throw new Error('Email configuration not found or not authorized');
  }

  const email = triggerData.email;
  if (!email) {
    throw new Error('No email data in trigger');
  }

  // Get AI configuration
  const aiConfig = action.config.aiConfigId 
    ? await aiConfigModel.getAiConfig(agent.user_id, action.config.provider)
    : await aiConfigModel.getDefaultAiConfig(agent.user_id);

  if (!aiConfig) {
    throw new Error('No AI configuration found. Please set up your AI provider first.');
  }

  // Strip HTML from email body
  const cleanEmailBody = stripHtml(email.body);

  // Generate AI reply
  console.log('🤖 Generating AI reply...');
  const aiResponse = await aiService.generateAiReply({
    provider: aiConfig.provider,
    apiKey: aiConfig.api_key,
    modelName: aiConfig.model_name,
    temperature: action.config.temperature || aiConfig.temperature,
    maxTokens: action.config.maxTokens || aiConfig.max_tokens,
    systemPrompt: action.config.systemPrompt || 'You are a helpful email assistant. Write professional, concise, and friendly email replies.',
    userMessage: cleanEmailBody,
    emailContext: {
      from: email.from,
      subject: email.subject,
      date: email.date
    }
  });

  console.log('✅ AI reply generated:', aiResponse.reply.substring(0, 100) + '...');

  // Format date nicely
  const formattedDate = new Date(email.date).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Send the AI-generated reply
  await gmailService.sendEmail(emailConfig.oauth_tokens, {
    to: email.from,
    subject: `Re: ${email.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
        <p style="white-space: pre-line;">${aiResponse.reply}</p>
        <br>
        <div style="border-top: 1px solid #ccc; margin-top: 20px; padding-top: 10px; color: #666;">
          <p style="margin: 5px 0;"><strong>From:</strong> ${email.from}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${email.subject}</p>
          <br>
          <div style="border-left: 3px solid #ccc; padding-left: 10px; color: #666;">
            ${cleanEmailBody}
          </div>
        </div>
      </div>
    `,
    body: `${aiResponse.reply}\n\n---------- Original Message ----------\nFrom: ${email.from}\nDate: ${formattedDate}\nSubject: ${email.subject}\n\n${cleanEmailBody}`
  });

  return { 
    replyTo: email.from, 
    originalSubject: email.subject,
    aiProvider: aiResponse.provider,
    aiModel: aiResponse.model,
    tokensUsed: aiResponse.tokensUsed,
    generatedReply: aiResponse.reply
  };
}

// Execute mark as read action
async function executeMarkAsReadAction(action, triggerData, agent) {
  const emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agent.id);
  if (!emailConfig || !emailConfig.oauth_tokens) {
    throw new Error('Email configuration not found or not authorized');
  }

  const email = triggerData.email;
  if (!email || !email.id) {
    throw new Error('No email ID in trigger');
  }

  await gmailService.markAsRead(emailConfig.oauth_tokens, email.id);

  return { emailId: email.id };
}

// Execute add label action
async function executeAddLabelAction(action, triggerData, agent) {
  const emailConfig = await emailAgentConfigModel.getEmailConfigByAgentId(agent.id);
  if (!emailConfig || !emailConfig.oauth_tokens) {
    throw new Error('Email configuration not found or not authorized');
  }

  const email = triggerData.email;
  if (!email || !email.id) {
    throw new Error('No email ID in trigger');
  }

  await gmailService.addLabel(emailConfig.oauth_tokens, email.id, action.config.labelId);

  return { emailId: email.id, labelId: action.config.labelId };
}

// Execute save to database action
async function executeSaveToDatabaseAction(action, triggerData, agent) {
  // This can be extended to save data to any table
  const db = require('../../utils/db');
  
  const tableName = action.config.tableName;
  const data = {};
  
  // Map trigger data to database columns
  for (const [key, value] of Object.entries(action.config.columnMapping || {})) {
    data[key] = replaceVariables(value, triggerData);
  }

  // Build INSERT query
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const query = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *;
  `;

  const result = await db.query(query, values);

  return { tableName, insertedRow: result.rows[0] };
}

// Execute HTTP request action
async function executeHttpRequestAction(action, triggerData, agent) {
  const axios = require('axios');

  const url = replaceVariables(action.config.url, triggerData);
  const method = action.config.method || 'POST';
  const headers = action.config.headers || {};
  const body = action.config.body ? JSON.parse(replaceVariables(JSON.stringify(action.config.body), triggerData)) : undefined;

  const response = await axios({
    method,
    url,
    headers,
    data: body
  });

  return {
    status: response.status,
    data: response.data
  };
}

// Replace template variables in strings
function replaceVariables(template, data) {
  if (typeof template !== 'string') return template;

  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.trim().split('.');
    let value = data;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return match; // Return original if path not found
      }
    }
    
    return value !== undefined && value !== null ? String(value) : '';
  });
}

// Evaluate conditions
function evaluateConditions(conditions, data) {
  if (!conditions || !conditions.rules) return true;

  const operator = conditions.operator || 'AND';
  const rules = conditions.rules;

  const results = rules.map(rule => evaluateRule(rule, data));

  if (operator === 'AND') {
    return results.every(r => r === true);
  } else if (operator === 'OR') {
    return results.some(r => r === true);
  }

  return false;
}

// Evaluate a single rule
function evaluateRule(rule, data) {
  const value = getValueFromPath(rule.field, data);
  const expectedValue = rule.value;

  switch (rule.operator) {
    case 'equals':
      return value === expectedValue;
    case 'not_equals':
      return value !== expectedValue;
    case 'contains':
      return String(value).includes(String(expectedValue));
    case 'not_contains':
      return !String(value).includes(String(expectedValue));
    case 'starts_with':
      return String(value).startsWith(String(expectedValue));
    case 'ends_with':
      return String(value).endsWith(String(expectedValue));
    case 'greater_than':
      return Number(value) > Number(expectedValue);
    case 'less_than':
      return Number(value) < Number(expectedValue);
    case 'is_empty':
      return !value || value === '';
    case 'is_not_empty':
      return value && value !== '';
    default:
      return false;
  }
}

// Get value from nested path
function getValueFromPath(path, data) {
  const keys = path.split('.');
  let value = data;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

module.exports = {
  executeWorkflow,
  executeAction,
  replaceVariables,
  evaluateConditions
};

