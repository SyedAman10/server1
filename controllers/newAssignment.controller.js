const assignmentService = require('../services/newAssignmentService');

/**
 * Assignment Controller
 * Handles HTTP requests for assignment operations
 */

// Create assignment
exports.createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, dueDate, maxPoints } = req.body;
    const teacherId = req.user.id;
    const userRole = req.user.role;

    // Only teachers and super_admin can create assignments
    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers and administrators can create assignments'
      });
    }

    if (!courseId || !title) {
      return res.status(400).json({
        success: false,
        message: 'Course ID and title are required'
      });
    }

    const result = await assignmentService.createAssignment({
      courseId,
      teacherId,
      title,
      description,
      dueDate,
      maxPoints
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating assignment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create assignment'
    });
  }
};

// Get assignments for a course
exports.getAssignmentsByCourse = async (req, res) => {
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

    const result = await assignmentService.getAssignmentsByCourse(
      courseId,
      userId,
      userRole
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting assignments:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get assignments'
    });
  }
};

// Get a single assignment
exports.getAssignmentById = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID is required'
      });
    }

    const result = await assignmentService.getAssignmentById(
      assignmentId,
      userId,
      userRole
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting assignment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get assignment'
    });
  }
};

// Update assignment
exports.updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { title, description, dueDate, maxPoints } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID is required'
      });
    }

    const result = await assignmentService.updateAssignment(
      assignmentId,
      { title, description, dueDate, maxPoints },
      userId,
      userRole
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating assignment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update assignment'
    });
  }
};

// Delete assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID is required'
      });
    }

    const result = await assignmentService.deleteAssignment(
      assignmentId,
      userId,
      userRole
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete assignment'
    });
  }
};

// Get upcoming assignments
exports.getUpcomingAssignments = async (req, res) => {
  try {
    const { days } = req.query;

    const result = await assignmentService.getUpcomingAssignments(
      days ? parseInt(days) : 7
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting upcoming assignments:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get upcoming assignments'
    });
  }
};

