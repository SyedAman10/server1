const db = require('../utils/db');

/**
 * Database-driven Announcement Controller
 * No Google Classroom dependencies
 */

// Create an announcement
exports.createAnnouncement = async (req, res) => {
  try {
    const { courseId, title, content } = req.body;
    const teacherId = req.user.id;
    const userRole = req.user.role;

    // Only teachers and super_admin can create announcements
    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers and administrators can create announcements'
      });
    }

    if (!courseId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Course ID and content are required'
      });
    }

    // Verify the teacher owns this course
    const courseCheck = await db.query(
      'SELECT id FROM courses WHERE id = $1 AND teacher_id = $2',
      [courseId, teacherId]
    );

    if (courseCheck.rows.length === 0 && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to post announcements in this course'
      });
    }

    // Create the announcement
    const result = await db.query(
      `INSERT INTO announcements (course_id, teacher_id, title, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [courseId, teacherId, title || null, content]
    );

    const announcement = result.rows[0];

    // Get enrolled students for this course
    const studentsResult = await db.query(
      `SELECT u.id, u.email, u.name
       FROM users u
       INNER JOIN course_enrollments ce ON u.id = ce.student_id
       WHERE ce.course_id = $1`,
      [courseId]
    );

    // TODO: Send email notifications (optional)
    // const emailsSent = await sendAnnouncementEmails(studentsResult.rows, announcement);

    return res.status(201).json({
      success: true,
      announcement: announcement,
      message: 'Announcement created successfully',
      emailsSent: 0, // Update when email service is implemented
      studentsNotified: studentsResult.rows.length
    });

  } catch (error) {
    console.error('Error creating announcement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create announcement'
    });
  }
};

// Get announcements for a course
exports.getAnnouncementsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
    }

    // Verify user has access to this course
    let accessCheck;
    if (userRole === 'teacher' || userRole === 'super_admin') {
      accessCheck = await db.query(
        'SELECT id FROM courses WHERE id = $1',
        [courseId]
      );
    } else {
      // Students can only see announcements from enrolled courses
      accessCheck = await db.query(
        `SELECT c.id FROM courses c
         INNER JOIN course_enrollments ce ON c.id = ce.course_id
         WHERE c.id = $1 AND ce.student_id = $2`,
        [courseId, userId]
      );
    }

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this course'
      });
    }

    // Get announcements
    const result = await db.query(
      `SELECT 
        a.*,
        u.name as teacher_name,
        u.email as teacher_email,
        c.name as course_name
       FROM announcements a
       LEFT JOIN users u ON a.teacher_id = u.id
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE a.course_id = $1
       ORDER BY a.created_at DESC`,
      [courseId]
    );

    return res.status(200).json({
      success: true,
      announcements: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error getting announcements:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get announcements'
    });
  }
};

// Get all announcements for current user
exports.getAllAnnouncements = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { limit = 50, offset = 0 } = req.query;

    let result;

    if (userRole === 'teacher' || userRole === 'super_admin') {
      // Teachers see announcements from their courses
      result = await db.query(
        `SELECT 
          a.*,
          c.name as course_name,
          COUNT(*) OVER() as total_count
         FROM announcements a
         LEFT JOIN courses c ON a.course_id = c.id
         WHERE a.teacher_id = $1 OR $2 = 'super_admin'
         ORDER BY a.created_at DESC
         LIMIT $3 OFFSET $4`,
        [userId, userRole, limit, offset]
      );
    } else {
      // Students see announcements from enrolled courses
      result = await db.query(
        `SELECT 
          a.*,
          c.name as course_name,
          u.name as teacher_name,
          COUNT(*) OVER() as total_count
         FROM announcements a
         INNER JOIN courses c ON a.course_id = c.id
         INNER JOIN course_enrollments ce ON c.id = ce.course_id
         LEFT JOIN users u ON a.teacher_id = u.id
         WHERE ce.student_id = $1
         ORDER BY a.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
    }

    return res.status(200).json({
      success: true,
      announcements: result.rows,
      count: result.rows.length,
      totalCount: result.rows[0]?.total_count || 0
    });

  } catch (error) {
    console.error('Error getting all announcements:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get announcements'
    });
  }
};

// Get a single announcement by ID
exports.getAnnouncementById = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!announcementId) {
      return res.status(400).json({
        success: false,
        message: 'Announcement ID is required'
      });
    }

    const result = await db.query(
      `SELECT 
        a.*,
        u.name as teacher_name,
        u.email as teacher_email,
        c.name as course_name
       FROM announcements a
       LEFT JOIN users u ON a.teacher_id = u.id
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE a.id = $1`,
      [announcementId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    const announcement = result.rows[0];

    // Verify access
    if (userRole === 'student') {
      const enrollmentCheck = await db.query(
        `SELECT 1 FROM course_enrollments 
         WHERE course_id = $1 AND student_id = $2`,
        [announcement.course_id, userId]
      );

      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this announcement'
        });
      }
    }

    return res.status(200).json({
      success: true,
      announcement: announcement
    });

  } catch (error) {
    console.error('Error getting announcement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get announcement'
    });
  }
};

// Update an announcement
exports.updateAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!announcementId) {
      return res.status(400).json({
        success: false,
        message: 'Announcement ID is required'
      });
    }

    // Verify ownership
    const ownershipCheck = await db.query(
      'SELECT * FROM announcements WHERE id = $1',
      [announcementId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    const announcement = ownershipCheck.rows[0];

    if (announcement.teacher_id !== userId && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this announcement'
      });
    }

    // Update announcement
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }

    if (content !== undefined) {
      updates.push(`content = $${paramIndex}`);
      values.push(content);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(announcementId);

    const result = await db.query(
      `UPDATE announcements 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return res.status(200).json({
      success: true,
      announcement: result.rows[0],
      message: 'Announcement updated successfully'
    });

  } catch (error) {
    console.error('Error updating announcement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update announcement'
    });
  }
};

// Delete an announcement
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!announcementId) {
      return res.status(400).json({
        success: false,
        message: 'Announcement ID is required'
      });
    }

    // Verify ownership
    const ownershipCheck = await db.query(
      'SELECT * FROM announcements WHERE id = $1',
      [announcementId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    const announcement = ownershipCheck.rows[0];

    if (announcement.teacher_id !== userId && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this announcement'
      });
    }

    // Delete announcement
    await db.query(
      'DELETE FROM announcements WHERE id = $1',
      [announcementId]
    );

    return res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting announcement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete announcement'
    });
  }
};
