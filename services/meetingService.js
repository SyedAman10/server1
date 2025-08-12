const { getCalendarClient } = require('../integrations/google.calendar');
const { calculateDateFromExpression, convertTimeExpression } = require('../utils/dateUtils');

/**
 * Create a meeting in Google Calendar
 * @param {Object} tokens - OAuth2 tokens (access_token, refresh_token)
 * @param {Object} meetingData - Meeting details
 * @returns {Promise<Object>} Created meeting object
 */
async function createMeeting(tokens, meetingData) {
  try {
    const calendar = getCalendarClient(tokens);
    
    // Parse date and time
    let startDate = meetingData.date;
    let startTime = meetingData.time;
    
    // If natural language expressions are provided, convert them
    if (meetingData.dateExpr) {
      const calculatedDate = calculateDateFromExpression(meetingData.dateExpr);
      if (calculatedDate) {
        startDate = calculatedDate;
      } else {
        throw new Error(`Could not parse date expression: ${meetingData.dateExpr}`);
      }
    }
    
    if (meetingData.timeExpr) {
      const calculatedTime = convertTimeExpression(meetingData.timeExpr);
      if (calculatedTime) {
        startTime = calculatedTime;
      } else {
        throw new Error(`Could not parse time expression: ${meetingData.timeExpr}`);
      }
    }
    
    // Validate required fields
    if (!startDate || !startTime) {
      throw new Error('Date and time are required for meeting creation');
    }
    
    // Parse the date and time
    const [year, month, day] = startDate.split('-').map(Number);
    const [hours, minutes] = startTime.split(':').map(Number);
    
    // Create start and end times
    const startDateTime = new Date(year, month - 1, day, hours, minutes);
    const endDateTime = new Date(startDateTime.getTime() + (meetingData.duration || 60) * 60000); // Default 1 hour
    
    // Format for Google Calendar API (RFC3339)
    const startTimeRFC = startDateTime.toISOString();
    const endTimeRFC = endDateTime.toISOString();
    
    // Prepare attendees
    const attendees = [];
    if (meetingData.attendees && Array.isArray(meetingData.attendees)) {
      attendees.push(...meetingData.attendees.map(email => ({ email })));
    }
    
    // Create the event
    const event = {
      summary: meetingData.title || 'Meeting',
      description: meetingData.description || '',
      start: {
        dateTime: startTimeRFC,
        timeZone: meetingData.timezone || 'UTC',
      },
      end: {
        dateTime: endTimeRFC,
        timeZone: meetingData.timezone || 'UTC',
      },
      attendees: attendees,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 15 }, // 15 minutes before
        ],
      },
    };
    
    // Insert the event into the primary calendar
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all', // Send invitations to attendees
    });
    
    return {
      success: true,
      meeting: response.data,
      message: `Meeting "${event.summary}" created successfully for ${startDate} at ${startTime}`
    };
    
  } catch (error) {
    console.error('Error creating meeting:', error);
    throw new Error(`Failed to create meeting: ${error.message}`);
  }
}

/**
 * List upcoming meetings from Google Calendar
 * @param {Object} tokens - OAuth2 tokens (access_token, refresh_token)
 * @param {number} maxResults - Maximum number of meetings to return (default: 10)
 * @returns {Promise<Array>} Array of upcoming meetings
 */
async function listUpcomingMeetings(tokens, maxResults = 10) {
  try {
    const calendar = getCalendarClient(tokens);
    
    const now = new Date();
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    return response.data.items || [];
    
  } catch (error) {
    console.error('Error listing meetings:', error);
    throw new Error(`Failed to list meetings: ${error.message}`);
  }
}

/**
 * Find a meeting by date and time
 * @param {Object} tokens - OAuth2 tokens (access_token, refresh_token)
 * @param {string} dateExpr - Date expression (e.g., "today", "tomorrow")
 * @param {string} timeExpr - Time expression (e.g., "5pm", "6pm")
 * @returns {Promise<Object|null>} Found meeting or null
 */
async function findMeetingByDateTime(tokens, dateExpr, timeExpr) {
  try {
    const calendar = getCalendarClient(tokens);
    
    // Convert date and time expressions to actual dates
    let targetDate = dateExpr;
    let targetTime = timeExpr;
    
    if (dateExpr) {
      const calculatedDate = calculateDateFromExpression(dateExpr);
      if (calculatedDate) {
        targetDate = calculatedDate;
      } else {
        throw new Error(`Could not parse date expression: ${dateExpr}`);
      }
    }
    
    if (timeExpr) {
      const calculatedTime = convertTimeExpression(timeExpr);
      if (calculatedTime) {
        targetTime = calculatedTime;
      } else {
        throw new Error(`Could not parse time expression: ${timeExpr}`);
      }
    }
    
    // Parse the target date and time
    const [year, month, day] = targetDate.split('-').map(Number);
    const [hours, minutes] = targetTime.split(':').map(Number);
    
    // Create a time window (1 hour before and after the target time)
    const targetDateTime = new Date(year, month - 1, day, hours, minutes);
    const startTime = new Date(targetDateTime.getTime() - 60 * 60 * 1000); // 1 hour before
    const endTime = new Date(targetDateTime.getTime() + 60 * 60 * 1000); // 1 hour after
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    });
    
    const meetings = response.data.items || [];
    
    // Find the closest meeting to the target time
    if (meetings.length > 0) {
      let closestMeeting = meetings[0];
      let minDiff = Math.abs(new Date(meetings[0].start.dateTime).getTime() - targetDateTime.getTime());
      
      for (const meeting of meetings) {
        const meetingTime = new Date(meeting.start.dateTime);
        const diff = Math.abs(meetingTime.getTime() - targetDateTime.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestMeeting = meeting;
        }
      }
      
      return closestMeeting;
    }
    
    return null;
    
  } catch (error) {
    console.error('Error finding meeting by date/time:', error);
    throw new Error(`Failed to find meeting: ${error.message}`);
  }
}

/**
 * Delete/cancel a meeting
 * @param {Object} tokens - OAuth2 tokens (access_token, refresh_token)
 * @param {string} eventId - Google Calendar event ID
 * @returns {Promise<Object>} Deletion result
 */
async function deleteMeeting(tokens, eventId) {
  try {
    console.log('🔍 DEBUG: deleteMeeting called with eventId:', eventId);
    
    const calendar = getCalendarClient(tokens);
    
    // First, get the current event to get details for the response
    const currentEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });
    
    if (!currentEvent.data) {
      throw new Error('Meeting not found');
    }
    
    const event = currentEvent.data;
    console.log('🔍 DEBUG: Deleting event:', {
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end
    });
    
    // Delete the event
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all', // Send cancellation to attendees
    });
    
    return {
      success: true,
      message: `Meeting "${event.summary}" has been cancelled successfully!`,
      deletedEvent: event
    };
    
  } catch (error) {
    console.error('Error deleting meeting:', error);
    throw new Error(`Failed to delete meeting: ${error.message}`);
  }
}

/**
 * Update/reschedule a meeting
 * @param {Object} tokens - OAuth2 tokens (access_token, refresh_token)
 * @param {string} eventId - Google Calendar event ID
 * @param {Object} updateData - Update data (dateExpr, timeExpr, duration, title, description, attendees)
 * @returns {Promise<Object>} Updated meeting object
 */
async function updateMeeting(tokens, eventId, updateData) {
  try {
    console.log('🔍 DEBUG: updateMeeting called with:', {
      eventId,
      updateData: JSON.stringify(updateData, null, 2)
    });
    
    const calendar = getCalendarClient(tokens);
    
    // First, get the current event to preserve existing data
    const currentEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });
    
    if (!currentEvent.data) {
      throw new Error('Meeting not found');
    }
    
    const event = currentEvent.data;
    console.log('🔍 DEBUG: Current event data:', {
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end
    });
    
    // Parse new date and time if provided
    let newStartDate = event.start.dateTime;
    let newEndDate = event.end.dateTime;
    
         if (updateData.dateExpr || updateData.timeExpr) {
       // Check if this is an all-day event
       const isAllDayEvent = event.start.date && !event.start.dateTime;
       
       // For working location events or all-day events, we'll create a new timed event and delete the old one
       if (event.eventType === 'workingLocation' || isAllDayEvent) {
         console.log('🔍 DEBUG: Converting all-day/working location event to timed event');
         
         // Calculate new date and time
         let year, month, day, hours, minutes;
         
         if (updateData.dateExpr) {
           const calculatedDate = calculateDateFromExpression(updateData.dateExpr);
           if (calculatedDate) {
             [year, month, day] = calculatedDate.split('-').map(Number);
           } else {
             throw new Error(`Could not parse date expression: ${updateData.dateExpr}`);
           }
         } else {
           // Use the existing date
           [year, month, day] = event.start.date.split('-').map(Number);
         }
         
         if (updateData.timeExpr) {
           const calculatedTime = convertTimeExpression(updateData.timeExpr);
           if (calculatedTime) {
             [hours, minutes] = calculatedTime.split(':').map(Number);
           } else {
             throw new Error(`Could not parse time expression: ${updateData.timeExpr}`);
           }
         } else {
           hours = 9; // Default to 9 AM
           minutes = 0;
         }
         
         // Create new timed event
         const newEvent = {
           summary: event.summary,
           description: event.description || '',
           start: {
             dateTime: new Date(year, month - 1, day, hours, minutes).toISOString(),
             timeZone: 'UTC',
           },
           end: {
             dateTime: new Date(year, month - 1, day, hours, minutes + 60).toISOString(), // 1 hour duration
             timeZone: 'UTC',
           },
           attendees: event.attendees || [],
           reminders: event.reminders || { useDefault: true }
         };
         
         // Insert the new timed event
         const newEventResponse = await calendar.events.insert({
           calendarId: 'primary',
           resource: newEvent,
           sendUpdates: 'all',
         });
         
         // Delete the old all-day event
         await calendar.events.delete({
           calendarId: 'primary',
           eventId: eventId,
         });
         
         return {
           success: true,
           meeting: newEventResponse.data,
           message: `Meeting "${event.summary}" successfully converted from all-day to timed event at ${hours}:${minutes.toString().padStart(2, '0')} on ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
         };
       }
       
       // Declare variables in the outer scope so they're accessible throughout
       let year, month, day, hours, minutes;
       
       if (isAllDayEvent) {
         console.log('🔍 DEBUG: This is an all-day event, converting to timed event');
         
         if (updateData.dateExpr) {
           // Use the new date expression
           const calculatedDate = calculateDateFromExpression(updateData.dateExpr);
           if (calculatedDate) {
             [year, month, day] = calculatedDate.split('-').map(Number);
           } else {
             throw new Error(`Could not parse date expression: ${updateData.dateExpr}`);
           }
         } else {
           // Use the existing date
           [year, month, day] = event.start.date.split('-').map(Number);
         }
         
         // Set default time to 9 AM if no time specified
         if (updateData.timeExpr) {
           const calculatedTime = convertTimeExpression(updateData.timeExpr);
           if (calculatedTime) {
             [hours, minutes] = calculatedTime.split(':').map(Number);
           } else {
             throw new Error(`Could not parse time expression: ${updateData.timeExpr}`);
           }
         } else {
           hours = 9; // Default to 9 AM
           minutes = 0;
         }
         
         console.log('🔍 DEBUG: All-day event converted to timed:', { year, month, day, hours, minutes });
       } else {
         // Regular timed event - extract current date and time
         const currentStart = new Date(event.start.dateTime);
         year = currentStart.getFullYear();
         month = currentStart.getMonth() + 1;
         day = currentStart.getDate();
         hours = currentStart.getHours();
         minutes = currentStart.getMinutes();
         
         console.log('🔍 DEBUG: Current event date/time:', {
           original: event.start.dateTime,
           parsed: { year, month, day, hours, minutes }
         });
         
         // Update date if provided
         if (updateData.dateExpr) {
           console.log('🔍 DEBUG: Updating date with expression:', updateData.dateExpr);
           const calculatedDate = calculateDateFromExpression(updateData.dateExpr);
           console.log('🔍 DEBUG: Calculated date:', calculatedDate);
           if (calculatedDate) {
             const [newYear, newMonth, newDay] = calculatedDate.split('-').map(Number);
             year = newYear;
             month = newMonth;
             day = newDay;
             console.log('🔍 DEBUG: Updated date components:', { year, month, day });
           } else {
             throw new Error(`Could not parse date expression: ${updateData.dateExpr}`);
           }
         }
         
         // Update time if provided
         if (updateData.timeExpr) {
           console.log('🔍 DEBUG: Updating time with expression:', updateData.timeExpr);
           const calculatedTime = convertTimeExpression(updateData.timeExpr);
           console.log('🔍 DEBUG: Calculated time:', calculatedTime);
           if (calculatedTime) {
             const [newHours, newMinutes] = calculatedTime.split(':').map(Number);
             hours = newHours;
             minutes = newMinutes;
             console.log('🔍 DEBUG: Updated time components:', { hours, minutes });
           } else {
             throw new Error(`Could not parse time expression: ${updateData.timeExpr}`);
           }
         }
       }
      
      // Validate the date components
      if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
        throw new Error(`Invalid date/time values: year=${year}, month=${month}, day=${day}, hours=${hours}, minutes=${minutes}`);
      }
      
      // Ensure month is 0-11 for Date constructor
      if (month < 1 || month > 12) {
        throw new Error(`Invalid month value: ${month}. Month must be between 1 and 12.`);
      }
      
      // Ensure day is valid for the month
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day < 1 || day > daysInMonth) {
        throw new Error(`Invalid day value: ${day}. Day must be between 1 and ${daysInMonth} for month ${month}.`);
      }
      
      // Ensure hours and minutes are valid
      if (hours < 0 || hours > 23) {
        throw new Error(`Invalid hour value: ${hours}. Hour must be between 0 and 23.`);
      }
      if (minutes < 0 || minutes > 59) {
        throw new Error(`Invalid minute value: ${minutes}. Minute must be between 0 and 59.`);
      }
      
      console.log('🔍 DEBUG: Final date/time components before Date constructor:', {
        year, month, day, hours, minutes,
        monthForConstructor: month - 1
      });
      
      // Create new start and end times
      const newStartDateTime = new Date(year, month - 1, day, hours, minutes);
      
      console.log('🔍 DEBUG: Created Date object:', {
        dateObject: newStartDateTime,
        isValid: !isNaN(newStartDateTime.getTime()),
        timestamp: newStartDateTime.getTime(),
        isoString: newStartDateTime.toISOString()
      });
      
      // Validate the created date
      if (isNaN(newStartDateTime.getTime())) {
        throw new Error(`Failed to create valid date from: year=${year}, month=${month}, day=${day}, hours=${hours}, minutes=${minutes}`);
      }
      
      const duration = event.end.dateTime ? 
        new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime() : 
        (updateData.duration || 60) * 60000;
      
      newStartDate = newStartDateTime.toISOString();
      newEndDate = new Date(newStartDateTime.getTime() + duration).toISOString();
    }
    
    // Prepare update data
    const updateFields = {};
    
    if (updateData.title) {
      updateFields.summary = updateData.title;
    }
    
    if (updateData.description) {
      updateFields.description = updateData.description;
    }
    
    if (newStartDate !== event.start.dateTime) {
      updateFields.start = {
        dateTime: newStartDate,
        timeZone: event.start.timeZone || 'UTC',
      };
      updateFields.end = {
        dateTime: newEndDate,
        timeZone: event.end.timeZone || 'UTC',
      };
    }
    
    if (updateData.duration) {
      const startTime = new Date(newStartDate);
      const endTime = new Date(startTime.getTime() + updateData.duration * 60000);
      updateFields.end = {
        dateTime: endTime.toISOString(),
        timeZone: event.end.timeZone || 'UTC',
      };
    }
    
    if (updateData.attendees && Array.isArray(updateData.attendees)) {
      updateFields.attendees = updateData.attendees.map(email => ({ email }));
    }
    
         // Update the event
     // Use update instead of patch when converting from all-day to timed events
     const method = (event.start.date && !event.start.dateTime) ? 'update' : 'patch';
     console.log('🔍 DEBUG: Using method:', method, 'for event update');
     
     const response = await calendar.events[method]({
       calendarId: 'primary',
       eventId: eventId,
       resource: method === 'update' ? { ...event, ...updateFields } : updateFields,
       sendUpdates: 'all', // Send updates to attendees
     });
    
    return {
      success: true,
      meeting: response.data,
      message: `Meeting "${response.data.summary}" updated successfully!`
    };
    
  } catch (error) {
    console.error('Error updating meeting:', error);
    throw new Error(`Failed to update meeting: ${error.message}`);
  }
}

module.exports = {
  createMeeting,
  listUpcomingMeetings,
  findMeetingByDateTime,
  updateMeeting,
  deleteMeeting
};
