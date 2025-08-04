const express = require('express');
const { 
  listCourses, 
  getCourse, 
  createCourse, 
  updateCourse, 
  deleteCourse, 
  archiveCourse,
  createAnnouncement,
  inviteStudents,
  inviteTeachers,
  listStudents
} = require('../controllers/classroom.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all classroom routes
router.use(authenticate);

// Course routes
router.get('/', listCourses);
router.get('/:courseId', getCourse);
router.post('/', createCourse);
router.patch('/:courseId', updateCourse);
router.delete('/:courseId', deleteCourse);
router.patch('/:courseId/archive', archiveCourse);

// Announcement routes
router.post('/:courseId/announcements', createAnnouncement);

// Student invitation routes
router.post('/:courseId/invite', inviteStudents);

// Teacher invitation routes
router.post('/:courseId/invite-teachers', inviteTeachers);

// Student list route
router.get('/:courseId/students', listStudents);

module.exports = router;
