const express = require('express');
const { updateCompanyInfo, getCompany } = require('../controllers/company.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Company routes
router.post('/', updateCompanyInfo);
router.get('/get', getCompany);

module.exports = router; 