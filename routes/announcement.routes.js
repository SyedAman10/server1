const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Create announcement (teachers and super_admin only)
router.post('/', announcementController.createAnnouncement);

// Get announcements for a course
router.get('/course/:courseId', announcementController.getAnnouncementsByCourse);

// Get a single announcement
router.get('/:announcementId', announcementController.getAnnouncementById);

// Update announcement (teachers and super_admin only)
router.put('/:announcementId', announcementController.updateAnnouncement);

// Delete announcement (teachers and super_admin only)
router.delete('/:announcementId', announcementController.deleteAnnouncement);

module.exports = router;

