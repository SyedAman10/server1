const express = require('express');
const {
  listCalendarEvents,
  createCalendarEvent,
  getCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} = require('../controllers/calendar.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all calendar routes
router.use(authenticate);

// Calendar routes
router.get('/:calendarId/events', listCalendarEvents);
router.post('/:calendarId/events', createCalendarEvent);
router.get('/:calendarId/events/:eventId', getCalendarEvent);
router.patch('/:calendarId/events/:eventId', updateCalendarEvent);
router.delete('/:calendarId/events/:eventId', deleteCalendarEvent);

module.exports = router;
