const { upsertCompanyInfo, getCompanyInfo } = require('../models/company.model');

// Add or update company information
const updateCompanyInfo = async (req, res) => {
  try {
    // Check if user is a teacher
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        error: 'Only teachers can update company information'
      });
    }

    const {
      company_name,
      company_email,
      company_phone,
      teacher_name,
      teacher_email,
      teacher_phone
    } = req.body;

    // Validate required fields
    if (!company_name || !company_email || !company_phone || 
        !teacher_name || !teacher_email || !teacher_phone) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    console.log('DEBUG: req.user object:', req.user);
    console.log('DEBUG: req.user.sub:', req.user.sub);
    
    const companyData = {
      teacher_id: req.user.sub, // Use sub (user ID) as string from JWT token
      company_name,
      company_email,
      company_phone,
      teacher_name,
      teacher_email,
      teacher_phone
    };

    console.log('DEBUG: Creating/updating company info with data:', companyData);
    const result = await upsertCompanyInfo(companyData);
    console.log('DEBUG: Company info upsert result:', result);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating company info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update company information'
    });
  }
};

// Get company information
const getCompany = async (req, res) => {
  try {
    // Check if user is a teacher
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        error: 'Only teachers can access company information'
      });
    }

    console.log('DEBUG: Getting company info for teacher_id:', req.user.sub);
    const companyInfo = await getCompanyInfo(req.user.sub);
    console.log('DEBUG: Retrieved company info:', companyInfo);

    if (!companyInfo) {
      return res.status(404).json({
        success: false,
        error: 'Company information not found'
      });
    }

    res.json({
      success: true,
      data: companyInfo
    });
  } catch (error) {
    console.error('Error getting company info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get company information'
    });
  }
};

module.exports = {
  updateCompanyInfo,
  getCompany
}; 