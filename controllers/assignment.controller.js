const jwt = require('jsonwebtoken');
const { getUserByEmail } = require('../models/user.model');
const {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  getStudentSubmissions
} = require('../services/assignmentService');

/**
 * Create a new assignment in a course
 */
const createAssignmentController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    // Validate required fields
    if (!req.body.title) {
      return res.status(400).json({ error: 'Assignment title is required' });
    }

    const assignmentData = {
      title: req.body.title,
      description: req.body.description || '',
      materials: req.body.materials || [],
      state: req.body.state || 'PUBLISHED',
      maxPoints: req.body.maxPoints || 100,
      dueDate: req.body.dueDate,
      dueTime: req.body.dueTime,
      topicId: req.body.topicId
    };

    const result = await createAssignment(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      courseId,
      assignmentData
    );

    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating assignment:', err);
    if (err.response && err.response.data && err.response.data.error) {
      return res.status(err.response.status || 500).json({
        error: err.response.data.error.message || err.message,
        details: err.response.data.error.details
      });
    }
    res.status(500).json({ error: err.message });
  }
};

/**
 * List all assignments in a course
 */
const listAssignmentsController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const assignments = await listAssignments(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      courseId
    );

    res.json(assignments);
  } catch (err) {
    console.error('Error listing assignments:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get a specific assignment
 */
const getAssignmentController = async (req, res) => {
  try {
    const { courseId, assignmentId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const assignment = await getAssignment(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      courseId,
      assignmentId
    );

    res.json(assignment);
  } catch (err) {
    console.error('Error getting assignment:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update an assignment
 */
const updateAssignmentController = async (req, res) => {
  try {
    const { courseId, assignmentId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const result = await updateAssignment(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      courseId,
      assignmentId,
      req.body
    );

    res.json(result);
  } catch (err) {
    console.error('Error updating assignment:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Delete an assignment
 */
const deleteAssignmentController = async (req, res) => {
  try {
    const { courseId, assignmentId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    await deleteAssignment(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      courseId,
      assignmentId
    );

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting assignment:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get student submissions for an assignment
 */
const getStudentSubmissionsController = async (req, res) => {
  try {
    const { courseId, assignmentId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const submissions = await getStudentSubmissions(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      courseId,
      assignmentId
    );

    res.json(submissions);
  } catch (err) {
    console.error('Error getting student submissions:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createAssignmentController,
  listAssignmentsController,
  getAssignmentController,
  updateAssignmentController,
  deleteAssignmentController,
  getStudentSubmissionsController
}; 