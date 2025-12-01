const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Create announcement (teachers and super_admin only)
router.post('/', announcementController.createAnnouncement);

// Get all announcements for current user
router.get('/', announcementController.getAllAnnouncements);

// Get announcements for a specific course
router.get('/course/:courseId', announcementController.getAnnouncementsByCourse);

// Get a single announcement by ID
router.get('/:announcementId', announcementController.getAnnouncementById);

// Update announcement (teachers and super_admin only)
router.put('/:announcementId', announcementController.updateAnnouncement);

// Delete announcement (teachers and super_admin only)
router.delete('/:announcementId', announcementController.deleteAnnouncement);

module.exports = router;
