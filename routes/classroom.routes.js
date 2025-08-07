const express = require('express');
const router = express.Router();
const classroomController = require('../controllers/classroom.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Protect all classroom routes
router.use(authenticate);

// Courses
router.get('/courses', classroomController.listCourses);
router.get('/courses/:courseId', classroomController.getCourse);
router.post('/courses', classroomController.createCourse);
router.patch('/courses/:courseId', classroomController.updateCourse);
router.delete('/courses/:courseId', classroomController.deleteCourse);
router.post('/courses/:courseId/archive', classroomController.archiveCourse);

// Announcements
router.post('/courses/:courseId/announcements', classroomController.createAnnouncement);
router.get('/courses/:courseId/announcements', classroomController.getAnnouncements);

// Students & Teachers
router.post('/courses/:courseId/invite-student', classroomController.inviteStudents);
router.post('/courses/:courseId/invite-teachers', classroomController.inviteTeachers);
router.get('/courses/:courseId/students', classroomController.listStudents);
router.get('/courses/:courseId/enrolled-students', classroomController.getEnrolledStudents);

// Assignments
router.post('/courses/:courseId/assignments', classroomController.createAssignment);
router.get('/courses/:courseId/assignments', classroomController.listAssignments);
router.get('/courses/:courseId/assignments/:assignmentId', classroomController.getAssignment);
router.patch('/courses/:courseId/assignments/:assignmentId', classroomController.updateAssignment);
router.delete('/courses/:courseId/assignments/:assignmentId', classroomController.deleteAssignment);

// Grades
router.get('/courses/:courseId/grades', classroomController.getGrades);
router.post('/courses/:courseId/assignments/:assignmentId/grade/:studentId', classroomController.gradeAssignment);

module.exports = router;
