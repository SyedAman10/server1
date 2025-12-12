const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const assignmentService = require('../services/newAssignmentService');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads', 'assignments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  }
});

// File filter to validate file types
const fileFilter = (req, file, cb) => {
  // Allow common document types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: PDF, Word, Excel, PowerPoint, Images, Text, CSV, ZIP, Video, Audio'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: fileFilter
});

/**
 * Upload a file (general upload endpoint)
 * POST /api/upload
 * Returns file info that can be used to attach to an assignment
 */
router.post('/', authenticate, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Build the full URL for the file
    const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const fileUrl = `/uploads/assignments/${req.file.filename}`;
    const fullUrl = `${baseUrl}${fileUrl}`;

    res.json({
      success: true,
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
        fullUrl: fullUrl
      },
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Upload multiple files
 * POST /api/upload/multiple
 */
router.post('/multiple', authenticate, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    
    const files = req.files.map(file => {
      const fileUrl = `/uploads/assignments/${file.filename}`;
      return {
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        url: fileUrl,
        fullUrl: `${baseUrl}${fileUrl}`
      };
    });

    res.json({
      success: true,
      files: files,
      count: files.length,
      message: `${files.length} file(s) uploaded successfully`
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Upload file and attach to an existing assignment
 * POST /api/upload/assignment/:assignmentId
 */
router.post('/assignment/:assignmentId', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Build the file URL
    const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const fileUrl = `/uploads/assignments/${req.file.filename}`;
    const fullUrl = `${baseUrl}${fileUrl}`;

    // Prepare attachment object
    const attachment = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: fileUrl,
      fullUrl: fullUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId
    };

    // Add attachment to the assignment
    const result = await assignmentService.addAttachments(
      assignmentId,
      [attachment],
      userId,
      userRole
    );

    res.json({
      success: true,
      file: attachment,
      assignment: result.assignment,
      message: 'File uploaded and attached to assignment successfully'
    });
  } catch (error) {
    console.error('Error uploading file to assignment:', error);
    res.status(error.message.includes('permission') ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Upload multiple files and attach to an existing assignment
 * POST /api/upload/assignment/:assignmentId/multiple
 */
router.post('/assignment/:assignmentId/multiple', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;

    // Prepare attachment objects
    const attachments = req.files.map(file => {
      const fileUrl = `/uploads/assignments/${file.filename}`;
      return {
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        url: fileUrl,
        fullUrl: `${baseUrl}${fileUrl}`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId
      };
    });

    // Add attachments to the assignment
    const result = await assignmentService.addAttachments(
      assignmentId,
      attachments,
      userId,
      userRole
    );

    res.json({
      success: true,
      files: attachments,
      assignment: result.assignment,
      count: attachments.length,
      message: `${attachments.length} file(s) uploaded and attached successfully`
    });
  } catch (error) {
    console.error('Error uploading files to assignment:', error);
    res.status(error.message.includes('permission') ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete an attachment from an assignment
 * DELETE /api/upload/assignment/:assignmentId/:filename
 */
router.delete('/assignment/:assignmentId/:filename', authenticate, async (req, res) => {
  try {
    const { assignmentId, filename } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Remove from database
    const result = await assignmentService.removeAttachment(
      assignmentId,
      filename,
      userId,
      userRole
    );

    // Delete file from disk
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      success: true,
      assignment: result.assignment,
      message: 'Attachment removed successfully'
    });
  } catch (error) {
    console.error('Error removing attachment:', error);
    res.status(error.message.includes('permission') ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// Handle multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 50MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum is 10 files at once'
      });
    }
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  next();
});

module.exports = router;
