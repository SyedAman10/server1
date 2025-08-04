const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { getUserByEmail } = require('../models/user.model');

const getDriveClient = (tokens) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  auth.setCredentials(tokens);
  return google.drive({ version: 'v3', auth });
};

const searchFiles = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const drive = getDriveClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Search for files in user's Drive
    const result = await drive.files.list({
      q: `name contains '${query}' and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink)',
      spaces: 'drive'
    });

    res.json({
      files: result.data.files.map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink
      }))
    });
  } catch (err) {
    console.error('Error searching Drive:', err);
    if (err.response && err.response.data && err.response.data.error) {
      return res.status(err.response.status || 500).json({
        error: err.response.data.error.message || err.message,
        details: err.response.data.error.details
      });
    }
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  searchFiles
}; 