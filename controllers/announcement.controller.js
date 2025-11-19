const announcementService = require('../services/announcementService');

/**
 * Announcement Controller
 * Handles HTTP requests for announcement operations
 */

// Create announcement
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

    const result = await announcementService.createAnnouncement({
      courseId,
      teacherId,
      title,
      content
    });

    return res.status(201).json(result);
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

    const result = await announcementService.getAnnouncementsByCourse(
      courseId,
      userId,
      userRole
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting announcements:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get announcements'
    });
  }
};

// Get a single announcement
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

    const result = await announcementService.getAnnouncementById(
      announcementId,
      userId,
      userRole
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting announcement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get announcement'
    });
  }
};

// Update announcement
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

    const result = await announcementService.updateAnnouncement(
      announcementId,
      { title, content },
      userId,
      userRole
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating announcement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update announcement'
    });
  }
};

// Delete announcement
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

    const result = await announcementService.deleteAnnouncement(
      announcementId,
      userId,
      userRole
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete announcement'
    });
  }
};

