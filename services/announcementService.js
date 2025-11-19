const announcementModel = require('../models/announcement.model');
const courseModel = require('../models/course.model');
const { sendAnnouncementEmail } = require('./announcementEmailService');

/**
 * Announcement Service
 * Handles business logic for announcement operations
 */

// Create a new announcement
async function createAnnouncement({ courseId, teacherId, title, content }) {
  try {
    // Verify course exists
    const course = await courseModel.getCourseById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Create announcement
    const announcement = await announcementModel.createAnnouncement({
      courseId,
      teacherId,
      title,
      content
    });

    // Get all students enrolled in the course
    const students = await courseModel.getEnrolledStudents(courseId);
    
    // Send email to all students
    const emailPromises = students.map(student => 
      sendAnnouncementEmail({
        toEmail: student.email,
        studentName: student.name,
        courseName: course.name,
        teacherName: course.teacher_name,
        announcementTitle: title || 'New Announcement',
        announcementContent: content
      }).catch(error => {
        console.error(`Failed to send announcement email to ${student.email}:`, error);
        return null; // Continue even if one email fails
      })
    );

    await Promise.all(emailPromises);

    return {
      success: true,
      announcement,
      emailsSent: students.length,
      message: `Announcement created and sent to ${students.length} student(s)!`
    };
  } catch (error) {
    console.error('Error creating announcement:', error);
    throw error;
  }
}

// Get announcements for a course
async function getAnnouncementsByCourse(courseId, userId, userRole) {
  try {
    const course = await courseModel.getCourseById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Check permissions
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to view announcements for this course');
    }

    if (userRole === 'student') {
      const isEnrolled = await courseModel.isStudentEnrolled(courseId, userId);
      if (!isEnrolled) {
        throw new Error('You are not enrolled in this course');
      }
    }

    const announcements = await announcementModel.getAnnouncementsByCourse(courseId);

    return {
      success: true,
      announcements,
      count: announcements.length
    };
  } catch (error) {
    console.error('Error getting announcements:', error);
    throw error;
  }
}

// Get a single announcement
async function getAnnouncementById(announcementId, userId, userRole) {
  try {
    const announcement = await announcementModel.getAnnouncementById(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    // Check permissions
    const course = await courseModel.getCourseById(announcement.course_id);
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to view this announcement');
    }

    if (userRole === 'student') {
      const isEnrolled = await courseModel.isStudentEnrolled(announcement.course_id, userId);
      if (!isEnrolled) {
        throw new Error('You are not enrolled in this course');
      }
    }

    return {
      success: true,
      announcement
    };
  } catch (error) {
    console.error('Error getting announcement:', error);
    throw error;
  }
}

// Update an announcement
async function updateAnnouncement(announcementId, updates, userId, userRole) {
  try {
    const announcement = await announcementModel.getAnnouncementById(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    // Only the teacher who created it or super_admin can update
    if (userRole === 'teacher' && announcement.teacher_id !== userId) {
      throw new Error('You do not have permission to update this announcement');
    }

    if (userRole === 'student') {
      throw new Error('Students cannot update announcements');
    }

    const updatedAnnouncement = await announcementModel.updateAnnouncement(announcementId, updates);

    return {
      success: true,
      announcement: updatedAnnouncement,
      message: 'Announcement updated successfully'
    };
  } catch (error) {
    console.error('Error updating announcement:', error);
    throw error;
  }
}

// Delete an announcement
async function deleteAnnouncement(announcementId, userId, userRole) {
  try {
    const announcement = await announcementModel.getAnnouncementById(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    // Only the teacher who created it or super_admin can delete
    if (userRole === 'teacher' && announcement.teacher_id !== userId) {
      throw new Error('You do not have permission to delete this announcement');
    }

    if (userRole === 'student') {
      throw new Error('Students cannot delete announcements');
    }

    await announcementModel.deleteAnnouncement(announcementId);

    return {
      success: true,
      message: 'Announcement deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting announcement:', error);
    throw error;
  }
}

module.exports = {
  createAnnouncement,
  getAnnouncementsByCourse,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement
};

