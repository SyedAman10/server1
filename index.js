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

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/ai', aiAgentRoutes); // Mount AI agent routes
app.use('/api', assignmentRoutes); // Add assignment routes

// Health check endpoint
app.get('/', (req, res) => res.send('AI Classroom Assistant is Live 🚀'));

// For local development
if (process.env.NODE_ENV === 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Export for Vercel
module.exports = app;