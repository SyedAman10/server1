const courseService = require('../services/courseService');

// Create a new course
const createCourse = async (req, res) => {
  try {
    const { name, description, section, room } = req.body;
    const teacherId = req.user.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Course name is required'
      });
    }

    const result = await courseService.createCourse({
      name,
      description,
      section,
      room,
      teacherId
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create course',
      message: error.message
    });
  }
};

// Get all courses for the authenticated user
const getCourses = async (req, res) => {
  try {
    const result = await courseService.getCourses(req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get courses',
      message: error.message
    });
  }
};

// Get a single course by ID
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await courseService.getCourseById(id, req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    console.error('Get course error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('permission') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to get course',
      message: error.message
    });
  }
};

// Update a course
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await courseService.updateCourse(id, updates, req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    console.error('Update course error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('permission') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to update course',
      message: error.message
    });
  }
};

// Delete a course
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await courseService.deleteCourse(id, req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    console.error('Delete course error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('permission') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to delete course',
      message: error.message
    });
  }
};

// Enroll a student in a course
const enrollStudent = async (req, res) => {
  try {
    const { id } = req.params; // course id
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required'
      });
    }

    const result = await courseService.enrollStudent(id, studentId, req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    console.error('Enroll student error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('permission') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to enroll student',
      message: error.message
    });
  }
};

// Unenroll a student from a course
const unenrollStudent = async (req, res) => {
  try {
    const { id, studentId } = req.params;

    const result = await courseService.unenrollStudent(id, studentId, req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    console.error('Unenroll student error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('permission') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to unenroll student',
      message: error.message
    });
  }
};

// Get enrolled students in a course
const getEnrolledStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await courseService.getEnrolledStudents(id, req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    console.error('Get enrolled students error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('permission') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to get enrolled students',
      message: error.message
    });
  }
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  enrollStudent,
  unenrollStudent,
  getEnrolledStudents
};

