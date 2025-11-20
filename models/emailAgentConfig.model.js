const db = require('../utils/db');

// Create email agent config
async function createEmailConfig({ agentId, emailAddress, provider = 'gmail', oauthTokens, imapConfig, smtpConfig, filters, pollingInterval = 300 }) {
  const query = `
    INSERT INTO email_agent_configs (
      agent_id, email_address, provider, oauth_tokens, imap_config, smtp_config, filters, polling_interval
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  const values = [
    agentId,
    emailAddress,
    provider,
    oauthTokens ? JSON.stringify(oauthTokens) : null,
    imapConfig ? JSON.stringify(imapConfig) : null,
    smtpConfig ? JSON.stringify(smtpConfig) : null,
    filters ? JSON.stringify(filters) : null,
    pollingInterval
  ];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get email config by agent ID
async function getEmailConfigByAgentId(agentId) {
  const query = `
    SELECT * FROM email_agent_configs
    WHERE agent_id = $1;
  `;
  const result = await db.query(query, [agentId]);
  return result.rows[0];
}

// Update email config
async function updateEmailConfig(agentId, updates) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  if (updates.emailAddress !== undefined) {
    fields.push(`email_address = $${paramCount++}`);
    values.push(updates.emailAddress);
  }
  if (updates.provider !== undefined) {
    fields.push(`provider = $${paramCount++}`);
    values.push(updates.provider);
  }
  if (updates.oauthTokens !== undefined) {
    fields.push(`oauth_tokens = $${paramCount++}`);
    values.push(JSON.stringify(updates.oauthTokens));
  }
  if (updates.imapConfig !== undefined) {
    fields.push(`imap_config = $${paramCount++}`);
    values.push(JSON.stringify(updates.imapConfig));
  }
  if (updates.smtpConfig !== undefined) {
    fields.push(`smtp_config = $${paramCount++}`);
    values.push(JSON.stringify(updates.smtpConfig));
  }
  if (updates.filters !== undefined) {
    fields.push(`filters = $${paramCount++}`);
    values.push(updates.filters ? JSON.stringify(updates.filters) : null);
  }
  if (updates.pollingInterval !== undefined) {
    fields.push(`polling_interval = $${paramCount++}`);
    values.push(updates.pollingInterval);
  }
  if (updates.lastEmailId !== undefined) {
    fields.push(`last_email_id = $${paramCount++}`);
    values.push(updates.lastEmailId);
  }
  if (updates.lastCheckedAt !== undefined) {
    fields.push(`last_checked_at = $${paramCount++}`);
    values.push(updates.lastCheckedAt);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(agentId);

  const query = `
    UPDATE email_agent_configs
    SET ${fields.join(', ')}
    WHERE agent_id = $${paramCount}
    RETURNING *;
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

// Get all email configs that need polling
async function getEmailConfigsForPolling() {
  const query = `
    SELECT ec.*, a.id as agent_id, a.name as agent_name, a.user_id, a.status as agent_status
    FROM email_agent_configs ec
    JOIN automation_agents a ON ec.agent_id = a.id
    WHERE a.status = 'active' 
      AND a.type = 'email_inbound'
      AND (ec.last_checked_at IS NULL 
           OR ec.last_checked_at < NOW() - (ec.polling_interval || ' seconds')::INTERVAL)
    ORDER BY ec.last_checked_at ASC NULLS FIRST;
  `;
  const result = await db.query(query);
  return result.rows;
}

// Delete email config
async function deleteEmailConfig(agentId) {
  const query = `DELETE FROM email_agent_configs WHERE agent_id = $1 RETURNING *;`;
  const result = await db.query(query, [agentId]);
  return result.rows[0];
}

module.exports = {
  createEmailConfig,
  getEmailConfigByAgentId,
  updateEmailConfig,
  getEmailConfigsForPolling,
  deleteEmailConfig
};

