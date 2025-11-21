require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const classroomRoutes = require('./routes/classroom.routes');
const companyRoutes = require('./routes/company.routes');
const aiAgentRoutes = require('./routes/ai-agent.routes'); // New AI agent routes
const assignmentRoutes = require('./routes/newAssignment.routes'); // Database-based assignment routes
const audioRoutes = require('./routes/audio.routes'); // New audio routes
const calendarRoutes = require('./routes/calendar.routes'); // New calendar routes
const courseRoutes = require('./routes/course.routes'); // New course routes
const invitationRoutes = require('./routes/invitation.routes'); // New invitation routes
const automationRoutes = require('./routes/automation.routes'); // Automation system routes

const app = express();

// Dynamic CORS configuration based on environment
const getCorsOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    const origins = [
      process.env.FRONTEND_URL || 'https://xytek-classroom-assistant.vercel.app',
      process.env.BACKEND_URL || 'https://class.xytek.ai',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:5000',
      'http://localhost:5173', // Vite default port
      'http://localhost:8080'
    ];
    // Remove duplicates
    return [...new Set(origins)];
  }
  return [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.BACKEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5000',
    'http://localhost:5173', // Vite default port
    'http://localhost:8080'
  ];
};

// CORS configuration
app.use(cors({
  origin: getCorsOrigins(),
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Global request logging middleware
app.use((req, res, next) => {
  console.log(`DEBUG: Incoming request - ${req.method} ${req.originalUrl}`);
  console.log('DEBUG: Request headers:', req.headers);
  console.log('DEBUG: Request body:', req.body);
  console.log('DEBUG: Request method from Express:', req.method);
  console.log('DEBUG: Request method from headers:', req.headers['x-http-method-override'] || 'none');
  console.log('DEBUG: Content-Type:', req.headers['content-type'] || 'none');
  console.log('DEBUG: Content-Length:', req.headers['content-length'] || 'none');
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/ai', aiAgentRoutes); // Mount AI agent routes
app.use('/api/assignments', assignmentRoutes); // Add database-based assignment routes
app.use('/api/audio', audioRoutes); // Mount audio routes
app.use('/api/calendar', calendarRoutes); // Mount calendar routes
app.use('/api/courses', courseRoutes); // Mount course routes
app.use('/api/invitations', invitationRoutes); // Mount invitation routes
app.use('/api/announcements', require('./routes/announcement.routes')); // Mount announcement routes
app.use('/api/automation', automationRoutes); // Mount automation routes
app.use('/api/ai-config', require('./routes/aiConfig.routes')); // AI configuration routes

// OAuth callback route for mobile apps
app.get('/auth/callback', (req, res) => {
  const { code, state, error, message } = req.query;
  
  console.log('🔗 OAuth callback received:', { code, state, error, message });
  
  if (error) {
    // Return error as JSON instead of redirecting
    console.log('❌ OAuth error received:', error, message);
    return res.json({
      success: false,
      error: error,
      message: message || 'Authentication error occurred',
      state: state
    });
  } else if (code) {
    // Return success as JSON instead of redirecting
    console.log('✅ OAuth code received successfully:', code);
    return res.json({
      success: true,
      code: code,
      state: state,
      message: 'Authorization code received successfully'
    });
  } else {
    // No code or error, return error as JSON
    console.log('❌ No code received');
    return res.json({
      success: false,
      error: 'NoCode',
      message: 'No authorization code received',
      state: state
    });
  }
});

// Debug endpoint to test routing
app.post('/api/classroom/test', (req, res) => {
  console.log('DEBUG: Test POST endpoint hit');
  res.json({ message: 'Test POST endpoint working', method: req.method, body: req.body });
});

app.get('/api/classroom/test', (req, res) => {
  console.log('DEBUG: Test GET endpoint hit');
  res.json({ message: 'Test GET endpoint working', method: req.method });
});

// Simple test endpoint for AI to call
app.post('/api/classroom/create-test', (req, res) => {
  console.log('DEBUG: AI create-test endpoint hit');
  console.log('DEBUG: Method:', req.method);
  console.log('DEBUG: Body:', req.body);
  console.log('DEBUG: Headers:', req.headers);
  res.status(201).json({ 
    message: 'Test course created', 
    method: req.method, 
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// Echo endpoint to see exactly what's received
app.all('/api/classroom/echo', (req, res) => {
  console.log('DEBUG: Echo endpoint hit');
  console.log('DEBUG: Method:', req.method);
  console.log('DEBUG: URL:', req.originalUrl);
  console.log('DEBUG: Headers:', req.headers);
  console.log('DEBUG: Body:', req.body);
  console.log('DEBUG: Query:', req.query);
  
  res.json({
    message: 'Echo response',
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body,
    query: req.query,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/', (req, res) => res.send('AI Classroom Assistant is Live 🚀'));

// For local development
if (process.env.NODE_ENV === 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start email polling service for automation agents
    const emailPollingService = require('./services/automation/emailPollingService');
    emailPollingService.startEmailPolling(15); // Poll every 15 seconds for faster responses
    console.log('📧 Email polling service started');
  });
}

// Export for Vercel
module.exports = app;
