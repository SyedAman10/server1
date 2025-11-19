const db = require('../utils/db');

// Create an announcement
async function createAnnouncement({ courseId, teacherId, title, content }) {
  const query = `
    INSERT INTO announcements (course_id, teacher_id, title, content)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [courseId, teacherId, title, content];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get all announcements for a course
async function getAnnouncementsByCourse(courseId) {
  const query = `
    SELECT a.*, 
      u.name as teacher_name,
      u.email as teacher_email
    FROM announcements a
    LEFT JOIN users u ON a.teacher_id = u.id
    WHERE a.course_id = $1
    ORDER BY a.created_at DESC;
  `;
  const result = await db.query(query, [courseId]);
  return result.rows;
}

// Get a single announcement by ID
async function getAnnouncementById(announcementId) {
  const query = `
    SELECT a.*, 
      u.name as teacher_name,
      u.email as teacher_email,
      c.name as course_name
    FROM announcements a
    LEFT JOIN users u ON a.teacher_id = u.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE a.id = $1;
  `;
  const result = await db.query(query, [announcementId]);
  return result.rows[0];
}

// Update an announcement
async function updateAnnouncement(announcementId, { title, content }) {
  const query = `
    UPDATE announcements
    SET title = COALESCE($1, title),
        content = COALESCE($2, content),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *;
  `;
  const result = await db.query(query, [title, content, announcementId]);
  return result.rows[0];
}

// Delete an announcement
async function deleteAnnouncement(announcementId) {
  const query = `DELETE FROM announcements WHERE id = $1 RETURNING *;`;
  const result = await db.query(query, [announcementId]);
  return result.rows[0];
}

module.exports = {
  createAnnouncement,
  getAnnouncementsByCourse,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement
};

