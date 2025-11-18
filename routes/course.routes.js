const express = require('express');
const { 
  createCourse, 
  getCourses, 
  getCourseById, 
  updateCourse, 
  deleteCourse,
  enrollStudent,
  unenrollStudent,
  getEnrolledStudents
} = require('../controllers/course.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Course CRUD operations
router.post('/', requireRole('teacher', 'super_admin'), createCourse);
router.get('/', getCourses);
router.get('/:id', getCourseById);
router.put('/:id', requireRole('teacher', 'super_admin'), updateCourse);
router.delete('/:id', requireRole('teacher', 'super_admin'), deleteCourse);

// Student enrollment operations
router.post('/:id/enroll', requireRole('teacher', 'super_admin'), enrollStudent);
router.delete('/:id/students/:studentId', requireRole('teacher', 'super_admin'), unenrollStudent);
router.get('/:id/students', getEnrolledStudents);

module.exports = router;

