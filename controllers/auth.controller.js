const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { upsertUser } = require('../models/user.model');

// Dynamic URLs based on environment
const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'https://class.xytek.ai';
  }
  return process.env.BACKEND_URL || 'http://localhost:3000';
};

const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || ' https://xytek-classroom-assistant.vercel.app';
  }
  // For development, if frontend is on Vercel but backend is local
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  return 'http://localhost:3000';
};

const getCallbackUrl = () => {
  const backendUrl = getBackendUrl();
  const callbackUrl = `${backendUrl}/api/auth/google/callback`;
  console.log('🔧 OAuth Configuration Debug:', {
    NODE_ENV: process.env.NODE_ENV,
    BACKEND_URL: process.env.BACKEND_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    backendUrl: backendUrl,
    callbackUrl: callbackUrl
  });
  return callbackUrl;
};

// Create separate OAuth clients for web and mobile
const createOAuthClient = (callbackUrl) => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl
  );
};

// Web OAuth client (uses backend callback URL)
const webOAuthClient = createOAuthClient(getCallbackUrl());

// Mobile OAuth client (uses a custom redirect URI that works with web clients)
const mobileOAuthClient = createOAuthClient('https://class.xytek.ai/api/auth/google/mobile-callback');

// Valid roles constant
const VALID_ROLES = ['student', 'teacher', 'super_admin'];

// Common function to handle user authentication and token generation
const handleUserAuth = async (userInfo, tokens, role) => {
  const user = await upsertUser({
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    role: role,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  // Create JWT payload
  const jwtPayload = {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    role: user.role,
    sub: userInfo.id,
    iat: Math.floor(Date.now() / 1000),
  };

  // Generate JWT token
  const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256'
  });

  // Console log the generated JWT token
  console.log('🔐 JWT Token Generated:', token);
  console.log('👤 User Info:', {
    email: userInfo.email,
    name: userInfo.name,
    role: user.role
  });

  return {
    token,
    userData: {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      role: user.role
    }
  };
};

// Function to determine redirect path based on role
const getRedirectPath = (role) => {
  switch (role) {
    case 'teacher':
      return '/wizard';
    case 'student':
      return '/dashboard';
    case 'super_admin':
      return '/dashboard'; // You can change this to whatever path you want for super admins
    default:
      return '/dashboard';
  }
};

// Handle Web Authentication
const handleWebAuth = async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('Auth callback received:', { code, state });
    
    if (!state || !VALID_ROLES.includes(state)) {
      console.error('Invalid role in state:', state);
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be either "teacher", "student", or "super_admin"'
      });
    }

    const { tokens } = await webOAuthClient.getToken(code);
    webOAuthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: webOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    const user = await handleUserAuth(userInfo, tokens, state);

    console.log('✅ Web Auth Successful:', {
      email: user.userData.email,
      role: user.userData.role,
      redirectPath: getRedirectPath(user.userData.role)
    });

    const frontendUrl = getFrontendUrl();
    
    // Determine redirect path based on role
    const redirectPath = getRedirectPath(user.userData.role);
    
    const redirectUrl = new URL(frontendUrl + redirectPath);
    redirectUrl.searchParams.set('token', user.token);
    redirectUrl.searchParams.set('role', user.userData.role);
    redirectUrl.searchParams.set('name', user.userData.name);
    redirectUrl.searchParams.set('email', user.userData.email);
    redirectUrl.searchParams.set('picture', user.userData.picture);

    console.log('🔄 Redirect Debug:', {
      frontendUrl: frontendUrl,
      redirectPath: redirectPath,
      fullRedirectUrl: redirectUrl.toString()
    });

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Web auth error:', error);
    const frontendUrl = getFrontendUrl();
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set('error', 'Authentication failed');
    res.redirect(redirectUrl.toString());
  } 
};

// Handle Mobile Authentication
const handleMobileAuth = async (req, res) => {
  try {
    const { code, role } = req.body;
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be either "teacher", "student", or "super_admin"'
      });
    }
    
    const { tokens } = await mobileOAuthClient.getToken(code);
    mobileOAuthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: mobileOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    const user = await handleUserAuth(userInfo, tokens, role);

    console.log('✅ Mobile Auth Successful:', {
      email: user.userData.email,
      role: user.userData.role,
      tokenLength: user.token.length
    });

    res.json({
      success: true,
      token: user.token,
      user: user.userData
    });
  } catch (error) {
    console.error('Mobile auth error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Handle Mobile Callback (for OAuth redirect)
const handleMobileCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('Mobile callback received:', { code, state });
    
    if (!code) {
      console.log('❌ No code received');
      return res.status(400).json({
        success: false,
        error: 'NoCode',
        message: 'No authorization code received'
      });
    }

    // Validate the authorization code
    if (code.length < 10) {
      console.log('❌ Invalid code received');
      return res.status(400).json({
        success: false,
        error: 'InvalidCode',
        message: 'Invalid authorization code'
      });
    }

    if (!state || !VALID_ROLES.includes(state)) {
      console.log('❌ Invalid role in state:', state);
      return res.status(400).json({
        success: false,
        error: 'InvalidRole',
        message: 'Invalid role in state parameter'
      });
    }

    console.log('🔄 Exchanging authorization code for tokens...');
    
    // Exchange the authorization code for tokens
    const { tokens } = await mobileOAuthClient.getToken(code);
    mobileOAuthClient.setCredentials(tokens);

    console.log('✅ Tokens received from Google');

    // Get user information from Google
    const oauth2 = google.oauth2({ auth: mobileOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    console.log('👤 User info received:', { email: userInfo.email, name: userInfo.name });

    // Handle user authentication and generate JWT
    const user = await handleUserAuth(userInfo, tokens, state);

    console.log('✅ Mobile OAuth completed successfully:', {
      email: user.userData.email,
      role: user.userData.role
    });

    // Return tokens directly to mobile app
    res.json({
      success: true,
      token: user.token,
      user: user.userData,
      message: 'Mobile OAuth completed successfully'
    });

  } catch (error) {
    console.error('Mobile callback error:', error);
    
    res.status(500).json({
      success: false,
      error: 'AuthFailed',
      message: error.message
    });
  }
};

// Get Google OAuth URL
const getAuthUrl = (req, res) => {
  const { role, platform } = req.query;
  if (!role || !VALID_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid role. Must be either "teacher", "student", or "super_admin"'
    });
  }

  let url;
  
  if (platform === 'mobile') {
    // For mobile, manually construct the OAuth URL with the mobile callback
    const mobileOAuthClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://class.xytek.ai/api/auth/google/mobile-callback'
    );
    
    url = mobileOAuthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/classroom.courses',
        'https://www.googleapis.com/auth/classroom.coursework.students',
        'https://www.googleapis.com/auth/classroom.announcements',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/meetings',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/forms.body',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/classroom.rosters',
        'https://www.googleapis.com/auth/classroom.announcements',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ],
      prompt: 'consent',
      state: role
    });
  } else {
    // For web, use the web OAuth client
    url = webOAuthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/classroom.courses',
        'https://www.googleapis.com/auth/classroom.coursework.students',
        'https://www.googleapis.com/auth/classroom.announcements',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/meetings',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/forms.body',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/classroom.rosters',
        'https://www.googleapis.com/auth/classroom.announcements',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ],
      prompt: 'consent',
      state: role
    });
  }
  
  console.log('🔗 Generated OAuth URL:', {
    platform: platform || 'web',
    role: role,
    url: url
  });
  
  res.json({ url });
};

module.exports = {
  getAuthUrl,
  handleWebAuth,
  handleMobileAuth,
  handleMobileCallback
};
