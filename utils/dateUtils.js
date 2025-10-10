/**
 * Calculate a date from a natural language expression
 * @param {string} dateExpr - Natural language date expression (e.g., "next Friday", "tomorrow")
 * @returns {string} Date in YYYY-MM-DD format
 */
function calculateDateFromExpression(dateExpr) {
  const today = new Date();
  const expr = dateExpr.toLowerCase().trim();
  
  // Handle "next [day]" expressions
  if (expr.startsWith('next ')) {
    const day = expr.split(' ')[1];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(day);
    
    if (targetDay !== -1) {
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // If the day has passed this week, get next week's date
      
      const result = new Date(today);
      result.setDate(today.getDate() + daysToAdd);
      // Use local date methods to avoid timezone issues
      const year = result.getFullYear();
      const month = (result.getMonth() + 1).toString().padStart(2, '0');
      const day = result.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  // Handle "today"
  if (expr === 'today') {
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Handle "tomorrow"
  if (expr === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
    const day = tomorrow.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Handle "next week"
  if (expr === 'next week') {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const year = nextWeek.getFullYear();
    const month = (nextWeek.getMonth() + 1).toString().padStart(2, '0');
    const day = nextWeek.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Handle "in X weeks"
  const weeksMatch = expr.match(/in (\d+) weeks?/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1]);
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + (weeks * 7));
    const year = futureDate.getFullYear();
    const month = (futureDate.getMonth() + 1).toString().padStart(2, '0');
    const day = futureDate.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Handle "end of month"
  if (expr === 'end of month') {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const year = lastDay.getFullYear();
    const month = (lastDay.getMonth() + 1).toString().padStart(2, '0');
    const day = lastDay.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // If we can't parse the expression, return null
  return null;
}

/**
 * Convert time expression to HH:MM format
 * @param {string} timeExpr - Natural language time expression (e.g., "5 PM", "9 AM")
 * @returns {string} Time in HH:MM format
 */
function convertTimeExpression(timeExpr) {
  const expr = timeExpr.toLowerCase().trim();
  
  // Handle "noon"
  if (expr === 'noon') return '12:00';
  
  // Handle "midnight"
  if (expr === 'midnight') return '00:00';
  
  // Handle "X:XX AM/PM" format (with minutes)
  const timeWithMinutesMatch = expr.match(/(\d+):(\d+)\s*(am|pm)/);
  if (timeWithMinutesMatch) {
    let [_, hours, minutes, meridiem] = timeWithMinutesMatch;
    hours = parseInt(hours);
    minutes = parseInt(minutes);
    
    // Convert to 24-hour format
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // Handle "X AM/PM" format (hours only)
  const timeMatch = expr.match(/(\d+)\s*(am|pm)/);
  if (timeMatch) {
    let [_, hours, meridiem] = timeMatch;
    hours = parseInt(hours);
    
    // Convert to 24-hour format
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:00`;
  }
  
  // If we can't parse the expression, return null
  return null;
}

module.exports = {
  calculateDateFromExpression,
  convertTimeExpression
}; 