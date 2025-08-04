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
      return result.toISOString().split('T')[0];
    }
  }
  
  // Handle "tomorrow"
  if (expr === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Handle "next week"
  if (expr === 'next week') {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  }
  
  // Handle "in X weeks"
  const weeksMatch = expr.match(/in (\d+) weeks?/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1]);
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + (weeks * 7));
    return futureDate.toISOString().split('T')[0];
  }
  
  // Handle "end of month"
  if (expr === 'end of month') {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
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
  
  // Handle "X AM/PM" format
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