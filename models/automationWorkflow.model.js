const db = require('../utils/db');

// Create a workflow
async function createWorkflow({ agentId, name, description, triggerConfig, actions, conditions, status = 'active' }) {
  const query = `
    INSERT INTO automation_workflows (agent_id, name, description, trigger_config, actions, conditions, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [
    agentId,
    name,
    description,
    JSON.stringify(triggerConfig),
    JSON.stringify(actions),
    conditions ? JSON.stringify(conditions) : null,
    status
  ];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get workflow by ID
async function getWorkflowById(workflowId) {
  const query = `
    SELECT w.*, a.name as agent_name, a.type as agent_type
    FROM automation_workflows w
    LEFT JOIN automation_agents a ON w.agent_id = a.id
    WHERE w.id = $1;
  `;
  const result = await db.query(query, [workflowId]);
  return result.rows[0];
}

// Get workflows by agent
async function getWorkflowsByAgent(agentId) {
  const query = `
    SELECT * FROM automation_workflows
    WHERE agent_id = $1
    ORDER BY created_at DESC;
  `;
  const result = await db.query(query, [agentId]);
  return result.rows;
}

// Get active workflows
async function getActiveWorkflows(agentId = null) {
  let query = `
    SELECT w.*, a.name as agent_name, a.type as agent_type, a.config as agent_config
    FROM automation_workflows w
    LEFT JOIN automation_agents a ON w.agent_id = a.id
    WHERE w.status = 'active' AND a.status = 'active'
  `;
  const values = [];
  
  if (agentId) {
    query += ' AND w.agent_id = $1';
    values.push(agentId);
  }
  
  query += ' ORDER BY w.created_at DESC;';
  
  const result = await db.query(query, values);
  return result.rows;
}

// Update workflow
async function updateWorkflow(workflowId, updates) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(updates.description);
  }
  if (updates.triggerConfig !== undefined) {
    fields.push(`trigger_config = $${paramCount++}`);
    values.push(JSON.stringify(updates.triggerConfig));
  }
  if (updates.actions !== undefined) {
    fields.push(`actions = $${paramCount++}`);
    values.push(JSON.stringify(updates.actions));
  }
  if (updates.conditions !== undefined) {
    fields.push(`conditions = $${paramCount++}`);
    values.push(updates.conditions ? JSON.stringify(updates.conditions) : null);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramCount++}`);
    values.push(updates.status);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(workflowId);

  const query = `
    UPDATE automation_workflows
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *;
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

// Delete workflow
async function deleteWorkflow(workflowId) {
  const query = `DELETE FROM automation_workflows WHERE id = $1 RETURNING *;`;
  const result = await db.query(query, [workflowId]);
  return result.rows[0];
}

module.exports = {
  createWorkflow,
  getWorkflowById,
  getWorkflowsByAgent,
  getActiveWorkflows,
  updateWorkflow,
  deleteWorkflow
};

