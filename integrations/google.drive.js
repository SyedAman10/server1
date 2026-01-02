const { google } = require('googleapis');
const axios = require('axios');

/**
 * Google Drive Integration
 * Handles reading files from Google Drive
 */

/**
 * Get Google Drive client with OAuth2 authentication
 */
function getDriveClient(tokens) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  auth.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });
  
  return google.drive({ version: 'v3', auth });
}

/**
 * Extract Google Drive file ID from various URL formats
 */
function extractFileId(url) {
  if (!url) return null;
  
  // Handle different Google Drive URL formats
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,  // /d/FILE_ID
    /id=([a-zA-Z0-9_-]+)/,     // ?id=FILE_ID
    /\/file\/d\/([a-zA-Z0-9_-]+)/  // /file/d/FILE_ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // If no pattern matches, assume it's already a file ID
  if (url.length > 20 && url.length < 50 && !url.includes('/')) {
    return url;
  }
  
  return null;
}

/**
 * Read text content from a Google Drive file
 * @param {string} fileUrl - Google Drive file URL or ID
 * @param {Object} tokens - OAuth2 tokens (optional, for private files)
 * @returns {Promise<string>} File content as text
 */
async function readFileContent(fileUrl, tokens = null) {
  try {
    const fileId = extractFileId(fileUrl);
    
    if (!fileId) {
      throw new Error('Invalid Google Drive URL or file ID');
    }
    
    console.log(`📥 Downloading file from Drive: ${fileId}`);
    
    // Method 1: Try public access first (faster)
    try {
      const publicUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const response = await axios.get(publicUrl, {
        responseType: 'text',
        timeout: 10000
      });
      
      if (response.data && response.data.length > 0) {
        console.log(`✅ File downloaded (public access): ${response.data.length} characters`);
        return response.data;
      }
    } catch (publicError) {
      console.log('⚠️  Public access failed, trying authenticated access...');
    }
    
    // Method 2: Use OAuth2 tokens if available
    if (tokens && tokens.access_token) {
      const drive = getDriveClient(tokens);
      
      // Get file metadata to check MIME type
      const metadata = await drive.files.get({
        fileId: fileId,
        fields: 'name, mimeType, size'
      });
      
      console.log(`📄 File: ${metadata.data.name} (${metadata.data.mimeType})`);
      
      // Export Google Docs as plain text
      if (metadata.data.mimeType === 'application/vnd.google-apps.document') {
        const response = await drive.files.export({
          fileId: fileId,
          mimeType: 'text/plain'
        }, {
          responseType: 'text'
        });
        
        console.log(`✅ Google Doc exported: ${response.data.length} characters`);
        return response.data;
      }
      
      // For other file types, try direct download
      const response = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'text'
      });
      
      console.log(`✅ File downloaded: ${response.data.length} characters`);
      return response.data;
    }
    
    throw new Error('File is not publicly accessible and no OAuth tokens provided');
    
  } catch (error) {
    console.error('❌ Error reading Drive file:', error.message);
    throw error;
  }
}

/**
 * Get file metadata from Google Drive
 */
async function getFileMetadata(fileUrl, tokens) {
  try {
    const fileId = extractFileId(fileUrl);
    
    if (!fileId) {
      throw new Error('Invalid Google Drive URL or file ID');
    }
    
    const drive = getDriveClient(tokens);
    
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting file metadata:', error);
    throw error;
  }
}

module.exports = {
  getDriveClient,
  extractFileId,
  readFileContent,
  getFileMetadata
};

