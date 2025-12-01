const db = require('../utils/db');

// Create an invitation
async function createInvitation({ courseId, inviterUserId, inviteeEmail, inviteeRole, token, expiresAt }) {
  const query = `
    INSERT INTO invitations (course_id, inviter_user_id, invitee_email, invitee_role, token, status, expires_at)
    VALUES ($1, $2, $3, $4, $5, 'pending', $6)
    RETURNING *;
  `;
  const values = [courseId, inviterUserId, inviteeEmail, inviteeRole, token, expiresAt];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get invitation by token
async function getInvitationByToken(token) {
  const query = `
    SELECT i.*, 
      c.name as course_name,
      u.name as inviter_name,
      u.email as inviter_email
    FROM invitations i
    LEFT JOIN courses c ON i.course_id = c.id
    LEFT JOIN users u ON i.inviter_user_id = u.id
    WHERE i.token = $1;
  `;
  const result = await db.query(query, [token]);
  return result.rows[0];
}

// Get invitations by email
async function getInvitationsByEmail(email) {
  const query = `
    SELECT i.*, 
      c.name as course_name,
      u.name as inviter_name,
      u.email as inviter_email
    FROM invitations i
    LEFT JOIN courses c ON i.course_id = c.id
    LEFT JOIN users u ON i.inviter_user_id = u.id
    WHERE i.invitee_email = $1
    ORDER BY i.created_at DESC;
  `;
  const result = await db.query(query, [email]);
  return result.rows;
}

// Get invitations by course
async function getInvitationsByCourse(courseId) {
  const query = `
    SELECT i.*, 
      u.name as inviter_name
    FROM invitations i
    LEFT JOIN users u ON i.inviter_user_id = u.id
    WHERE i.course_id = $1
    ORDER BY i.created_at DESC;
  `;
  const result = await db.query(query, [courseId]);
  return result.rows;
}

// Update invitation status
async function updateInvitationStatus(invitationId, status, acceptedUserId = null) {
  // Build query based on status to avoid parameter type issues
  let query;
  let values;
  
  if (status === 'accepted') {
    query = `
      UPDATE invitations
      SET status = $2, 
          accepted_user_id = $3,
          accepted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    values = [invitationId, status, acceptedUserId];
  } else {
    query = `
      UPDATE invitations
      SET status = $2, 
          accepted_user_id = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    values = [invitationId, status, acceptedUserId];
  }
  
  const result = await db.query(query, values);
  return result.rows[0];
}

// Delete invitation
async function deleteInvitation(invitationId) {
  const query = `DELETE FROM invitations WHERE id = $1 RETURNING *;`;
  const result = await db.query(query, [invitationId]);
  return result.rows[0];
}

// Check if invitation exists for email and course
async function getExistingInvitation(courseId, email) {
  const query = `
    SELECT * FROM invitations 
    WHERE course_id = $1 AND invitee_email = $2 AND status = 'pending'
    LIMIT 1;
  `;
  const result = await db.query(query, [courseId, email]);
  return result.rows[0];
}

module.exports = {
  createInvitation,
  getInvitationByToken,
  getInvitationsByEmail,
  getInvitationsByCourse,
  updateInvitationStatus,
  deleteInvitation,
  getExistingInvitation
};

