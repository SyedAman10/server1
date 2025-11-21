const db = require('../utils/db');

// Create recipient list
async function createRecipientList({ userId, name, description, recipients }) {
  const query = `
    INSERT INTO recipient_lists (user_id, name, description, recipients, total_count)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [
    userId,
    name,
    description,
    JSON.stringify(recipients),
    recipients.length
  ];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get recipient list by ID
async function getRecipientListById(listId) {
  const query = `
    SELECT * FROM recipient_lists
    WHERE id = $1;
  `;
  const result = await db.query(query, [listId]);
  return result.rows[0];
}

// Get all recipient lists for a user
async function getRecipientListsByUser(userId) {
  const query = `
    SELECT id, name, description, total_count, created_at, updated_at
    FROM recipient_lists
    WHERE user_id = $1
    ORDER BY created_at DESC;
  `;
  const result = await db.query(query, [userId]);
  return result.rows;
}

// Update recipient list
async function updateRecipientList(listId, updates) {
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
  if (updates.recipients !== undefined) {
    fields.push(`recipients = $${paramCount++}`);
    values.push(JSON.stringify(updates.recipients));
    fields.push(`total_count = $${paramCount++}`);
    values.push(updates.recipients.length);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(listId);

  const query = `
    UPDATE recipient_lists
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *;
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

// Delete recipient list
async function deleteRecipientList(listId) {
  const query = `DELETE FROM recipient_lists WHERE id = $1 RETURNING *;`;
  const result = await db.query(query, [listId]);
  return result.rows[0];
}

module.exports = {
  createRecipientList,
  getRecipientListById,
  getRecipientListsByUser,
  updateRecipientList,
  deleteRecipientList
};

