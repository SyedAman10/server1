const jwt = require('jsonwebtoken');
const { getUserByEmail } = require('../models/user.model');
const {
  createMeeting,
  listUpcomingMeetings,
  updateMeeting,
  deleteMeeting,
  getMeeting
} = require('../services/meetingService');

/**
 * List calendar events for a specific calendar
 */
const listCalendarEvents = async (req, res) => {
  try {
    const { calendarId } = req.params;
    const { timeMin, timeMax } = req.query;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    // Use the meeting service to list events
    const events = await listUpcomingMeetings(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      calendarId,
      timeMin,
      timeMax
    );

    res.json(events);
  } catch (err) {
    console.error('Error listing calendar events:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Create a new calendar event
 */
const createCalendarEvent = async (req, res) => {
  try {
    const { calendarId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const eventData = {
      title: req.body.summary,
      description: req.body.description,
      date: req.body.startTime ? req.body.startTime.split('T')[0] : null, // Extract date part
      time: req.body.startTime ? req.body.startTime.split('T')[1].substring(0, 5) : null, // Extract time part
      duration: req.body.endTime && req.body.startTime ? 
        Math.round((new Date(req.body.endTime) - new Date(req.body.startTime)) / 60000) : 60, // Calculate duration in minutes
      attendees: req.body.attendees || [],
      location: req.body.location,
      reminders: req.body.reminders
    };

    const result = await createMeeting(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      eventData,
      calendarId
    );

    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating calendar event:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get a specific calendar event
 */
const getCalendarEvent = async (req, res) => {
  try {
    const { calendarId, eventId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const event = await getMeeting(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      eventId,
      calendarId
    );

    res.json(event);
  } catch (err) {
    console.error('Error getting calendar event:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update a calendar event
 */
const updateCalendarEvent = async (req, res) => {
  try {
    const { calendarId, eventId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const updateData = {
      title: req.body.summary,
      description: req.body.description,
      dateExpr: req.body.startTime ? req.body.startTime.split('T')[0] : null, // Extract date part
      timeExpr: req.body.startTime ? req.body.startTime.split('T')[1].substring(0, 5) : null, // Extract time part
      duration: req.body.endTime && req.body.startTime ? 
        Math.round((new Date(req.body.endTime) - new Date(req.body.startTime)) / 60000) : null, // Calculate duration in minutes
      attendees: req.body.attendees,
      location: req.body.location,
      reminders: req.body.reminders
    };

    const result = await updateMeeting(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      eventId,
      updateData,
      calendarId
    );

    res.json(result);
  } catch (err) {
    console.error('Error updating calendar event:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Delete a calendar event
 */
const deleteCalendarEvent = async (req, res) => {
  try {
    const { calendarId, eventId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    await deleteMeeting(
      {
        access_token: user.access_token,
        refresh_token: user.refresh_token
      },
      eventId,
      calendarId
    );

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting calendar event:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  listCalendarEvents,
  createCalendarEvent,
  getCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
};
