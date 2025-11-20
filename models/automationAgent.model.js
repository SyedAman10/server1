const db = require('../utils/db');

// Create an automation agent
async function createAgent({ userId, name, description, type, config, status = 'inactive' }) {
  const query = `
    INSERT INTO automation_agents (user_id, name, description, type, config, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [userId, name, description, type, JSON.stringify(config), status];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get agent by ID
async function getAgentById(agentId) {
  const query = `
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM automation_agents a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.id = $1;
  `;
  const result = await db.query(query, [agentId]);
  return result.rows[0];
}

// Get all agents for a user
async function getAgentsByUser(userId) {
  const query = `
    SELECT * FROM automation_agents
    WHERE user_id = $1
    ORDER BY created_at DESC;
  `;
  const result = await db.query(query, [userId]);
  return result.rows;
}

// Get agents by type
async function getAgentsByType(userId, type) {
  const query = `
    SELECT * FROM automation_agents
    WHERE user_id = $1 AND type = $2
    ORDER BY created_at DESC;
  `;
  const result = await db.query(query, [userId, type]);
  return result.rows;
}

// Get active agents (for execution)
async function getActiveAgents(type = null) {
  let query = `
    SELECT * FROM automation_agents
    WHERE status = 'active'
  `;
  const values = [];
  
  if (type) {
    query += ' AND type = $1';
    values.push(type);
  }
  
  query += ' ORDER BY created_at DESC;';
  
  const result = await db.query(query, values);
  return result.rows;
}

// Update agent
async function updateAgent(agentId, updates) {
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
  if (updates.config !== undefined) {
    fields.push(`config = $${paramCount++}`);
    values.push(JSON.stringify(updates.config));
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramCount++}`);
    values.push(updates.status);
  }
  if (updates.lastRunAt !== undefined) {
    fields.push(`last_run_at = $${paramCount++}`);
    values.push(updates.lastRunAt);
  }
  if (updates.nextRunAt !== undefined) {
    fields.push(`next_run_at = $${paramCount++}`);
    values.push(updates.nextRunAt);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(agentId);

  const query = `
    UPDATE automation_agents
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *;
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

// Delete agent
async function deleteAgent(agentId) {
  const query = `DELETE FROM automation_agents WHERE id = $1 RETURNING *;`;
  const result = await db.query(query, [agentId]);
  return result.rows[0];
}

// Update agent status
async function updateAgentStatus(agentId, status) {
  const query = `
    UPDATE automation_agents
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  const result = await db.query(query, [status, agentId]);
  return result.rows[0];
}

module.exports = {
  createAgent,
  getAgentById,
  getAgentsByUser,
  getAgentsByType,
  getActiveAgents,
  updateAgent,
  deleteAgent,
  updateAgentStatus
};

