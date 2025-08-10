require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const classroomRoutes = require('./routes/classroom.routes');
const companyRoutes = require('./routes/company.routes');
const aiAgentRoutes = require('./routes/ai-agent.routes'); // New AI agent routes
const assignmentRoutes = require('./routes/assignment.routes'); // New assignment routes

const app = express();

// Dynamic CORS configuration based on environment
const getCorsOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    const origins = [
      process.env.FRONTEND_URL || 'https://xytek-classroom-assistant.vercel.app',
      process.env.BACKEND_URL || 'https://class.xytek.ai'
    ];
    // Remove duplicates
    return [...new Set(origins)];
  }
  return [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.BACKEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002'
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
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/ai', aiAgentRoutes); // Mount AI agent routes
app.use('/api', assignmentRoutes); // Add assignment routes

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
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Export for Vercel
module.exports = app;
