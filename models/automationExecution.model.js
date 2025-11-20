const db = require('../utils/db');

// Create an execution record
async function createExecution({ agentId, workflowId, status = 'running', triggerData, executionData }) {
  const query = `
    INSERT INTO automation_executions (agent_id, workflow_id, status, trigger_data, execution_data, started_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const values = [
    agentId,
    workflowId,
    status,
    triggerData ? JSON.stringify(triggerData) : null,
    executionData ? JSON.stringify(executionData) : null
  ];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Update execution
async function updateExecution(executionId, updates) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  if (updates.status !== undefined) {
    fields.push(`status = $${paramCount++}`);
    values.push(updates.status);
  }
  if (updates.executionData !== undefined) {
    fields.push(`execution_data = $${paramCount++}`);
    values.push(JSON.stringify(updates.executionData));
  }
  if (updates.errorMessage !== undefined) {
    fields.push(`error_message = $${paramCount++}`);
    values.push(updates.errorMessage);
  }
  if (updates.completedAt !== undefined) {
    fields.push(`completed_at = $${paramCount++}`);
    values.push(updates.completedAt);
  }
  if (updates.durationMs !== undefined) {
    fields.push(`duration_ms = $${paramCount++}`);
    values.push(updates.durationMs);
  }

  values.push(executionId);

  const query = `
    UPDATE automation_executions
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *;
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

// Complete execution
async function completeExecution(executionId, status, executionData = null, errorMessage = null) {
  const startedAt = await db.query('SELECT started_at FROM automation_executions WHERE id = $1', [executionId]);
  const duration = startedAt.rows[0] ? Date.now() - new Date(startedAt.rows[0].started_at).getTime() : null;

  const query = `
    UPDATE automation_executions
    SET status = $1,
        execution_data = $2,
        error_message = $3,
        completed_at = CURRENT_TIMESTAMP,
        duration_ms = $4
    WHERE id = $5
    RETURNING *;
  `;
  const values = [
    status,
    executionData ? JSON.stringify(executionData) : null,
    errorMessage,
    duration,
    executionId
  ];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get execution by ID
async function getExecutionById(executionId) {
  const query = `
    SELECT e.*, 
      a.name as agent_name, 
      a.type as agent_type,
      w.name as workflow_name
    FROM automation_executions e
    LEFT JOIN automation_agents a ON e.agent_id = a.id
    LEFT JOIN automation_workflows w ON e.workflow_id = w.id
    WHERE e.id = $1;
  `;
  const result = await db.query(query, [executionId]);
  return result.rows[0];
}

// Get executions by agent
async function getExecutionsByAgent(agentId, limit = 50, offset = 0) {
  const query = `
    SELECT e.*,
      w.name as workflow_name
    FROM automation_executions e
    LEFT JOIN automation_workflows w ON e.workflow_id = w.id
    WHERE e.agent_id = $1
    ORDER BY e.started_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await db.query(query, [agentId, limit, offset]);
  return result.rows;
}

// Get executions by workflow
async function getExecutionsByWorkflow(workflowId, limit = 50, offset = 0) {
  const query = `
    SELECT e.*,
      a.name as agent_name,
      a.type as agent_type
    FROM automation_executions e
    LEFT JOIN automation_agents a ON e.agent_id = a.id
    WHERE e.workflow_id = $1
    ORDER BY e.started_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await db.query(query, [workflowId, limit, offset]);
  return result.rows;
}

// Get execution statistics
async function getExecutionStats(agentId = null, workflowId = null) {
  let query = `
    SELECT 
      COUNT(*) as total_executions,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      AVG(duration_ms) as avg_duration_ms
    FROM automation_executions
    WHERE 1=1
  `;
  const values = [];
  let paramCount = 1;

  if (agentId) {
    query += ` AND agent_id = $${paramCount++}`;
    values.push(agentId);
  }
  if (workflowId) {
    query += ` AND workflow_id = $${paramCount++}`;
    values.push(workflowId);
  }

  const result = await db.query(query, values);
  return result.rows[0];
}

module.exports = {
  createExecution,
  updateExecution,
  completeExecution,
  getExecutionById,
  getExecutionsByAgent,
  getExecutionsByWorkflow,
  getExecutionStats
};

