const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * AI Grading Service
 * Handles AI-powered grading of student submissions
 */

/**
 * Extract grading criteria from assignment description and files
 */
async function extractGradingCriteria(assignment, userToken = null) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    let prompt = `You are an expert educator. Analyze this assignment and extract the grading criteria, rubric, and expectations.

Assignment Title: ${assignment.title}
Description: ${assignment.description || 'No description provided'}
Max Points: ${assignment.max_points || 100}
`;

    // If assignment has attachments (instructions file), read them from local storage
    const attachments = assignment.attachments ? 
      (typeof assignment.attachments === 'string' ? JSON.parse(assignment.attachments) : assignment.attachments) : [];
    
    if (attachments.length > 0) {
      prompt += `\n**ASSIGNMENT INSTRUCTIONS FROM ATTACHED DOCUMENTS:**\n`;
      
      const fs = require('fs');
      const path = require('path');
      const textract = require('textract');
      const util = require('util');
      const textractPromise = util.promisify(textract.fromFileWithPath);
      
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        prompt += `\n--- Document ${i + 1}: ${att.originalName} ---\n`;
        
        try {
          // Build file path - attachments.url is like "/uploads/assignments/filename.pdf"
          const filePath = path.join(__dirname, '..', att.url);
          
          // Check if file exists
          if (!fs.existsSync(filePath)) {
            console.log(`⚠️  File not found: ${filePath}`);
            prompt += `(File not found on server)\n`;
            continue;
          }
          
          // Try to extract text from the file
          let fileContent = '';
          
          // For plain text files, just read directly
          if (att.mimetype === 'text/plain' || att.originalName.endsWith('.txt')) {
            fileContent = fs.readFileSync(filePath, 'utf8');
          } else {
            // For Word, PDF, etc., use textract
            try {
              fileContent = await textractPromise(filePath);
            } catch (extractError) {
              console.log(`⚠️  Could not extract text from ${att.originalName}: ${extractError.message}`);
              prompt += `(File format not readable: ${att.originalName})\n`;
              continue;
            }
          }
          
          if (fileContent && fileContent.trim().length > 0) {
            prompt += fileContent.trim() + '\n';
            console.log(`✅ Read assignment document: ${att.originalName} (${fileContent.length} chars)`);
          } else {
            prompt += `(File is empty or could not extract content)\n`;
          }
        } catch (fileError) {
          console.log(`⚠️  Error reading file ${att.originalName}: ${fileError.message}`);
          prompt += `(Error reading file: ${att.originalName})\n`;
        }
        prompt += `--- End of Document ${i + 1} ---\n`;
      }
    }

    prompt += `\nPlease extract and structure:
1. **Grading Criteria**: What are the main evaluation points?
2. **Rubric**: Break down how points should be allocated
3. **Key Requirements**: What must students include/demonstrate?
4. **Quality Indicators**: What makes a good vs. poor submission?

Provide the output in JSON format:
{
  "criteria": ["criterion 1", "criterion 2", ...],
  "rubric": {
    "criterion_name": {
      "points": X,
      "description": "...",
      "levels": {
        "excellent": "...",
        "good": "...",
        "fair": "...",
        "poor": "..."
      }
    }
  },
  "requirements": ["requirement 1", "requirement 2", ...],
  "totalPoints": ${assignment.max_points || 100}
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extractedCriteria = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        criteria: extractedCriteria,
        rawText: response
      };
    }
    
    return {
      success: false,
      error: 'Could not extract structured criteria',
      rawText: response
    };
    
  } catch (error) {
    console.error('Error extracting grading criteria:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Grade a student submission using AI
 */
async function gradeSubmission(submission, assignment, gradingSettings) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Get grading criteria
    const criteria = gradingSettings.rubric || {};
    const maxPoints = gradingSettings.max_points || assignment.max_points || 100;
    
    let prompt = `You are an expert educator grading a student assignment. Be fair, constructive, and thorough.

**ASSIGNMENT DETAILS:**
Title: ${assignment.title}
Description: ${assignment.description || 'No description'}
Max Points: ${maxPoints}

**GRADING CRITERIA:**
${JSON.stringify(criteria, null, 2)}

${gradingSettings.ai_instructions ? `\n**INSTRUCTOR'S GRADING INSTRUCTIONS:**\n${gradingSettings.ai_instructions}\n` : ''}

**STUDENT SUBMISSION:**
${submission.submission_text || 'No text provided'}
`;

    // If submission has attachments, mention them
    const submissionAttachments = submission.attachments ? 
      (typeof submission.attachments === 'string' ? JSON.parse(submission.attachments) : submission.attachments) : [];
    
    if (submissionAttachments.length > 0) {
      prompt += `\n**Student uploaded ${submissionAttachments.length} file(s):**\n`;
      submissionAttachments.forEach((att, i) => {
        prompt += `${i + 1}. ${att.originalName} (${(att.size / 1024).toFixed(2)} KB)\n`;
      });
    }

    prompt += `\n**YOUR TASK:**
Grade this submission based on the criteria provided. Provide:

1. **Overall Grade**: A numerical score out of ${maxPoints}
2. **Detailed Feedback**: Constructive comments on what was done well and what needs improvement
3. **Breakdown**: Score for each criterion
4. **Suggestions**: Specific recommendations for improvement

Output in JSON format:
{
  "grade": X,
  "maxPoints": ${maxPoints},
  "percentage": X,
  "feedback": "Detailed constructive feedback...",
  "breakdown": {
    "criterion_name": {
      "score": X,
      "maxScore": Y,
      "comment": "..."
    }
  },
  "strengths": ["strength 1", "strength 2", ...],
  "improvements": ["improvement 1", "improvement 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}

Be specific, encouraging, and helpful in your feedback.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const gradeData = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        grade: gradeData.grade,
        feedback: gradeData.feedback,
        analysis: gradeData,
        rawResponse: response
      };
    }
    
    return {
      success: false,
      error: 'Could not extract structured grade',
      rawResponse: response
    };
    
  } catch (error) {
    console.error('Error grading submission:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate grading rubric suggestions based on assignment
 */
async function generateRubricSuggestions(assignment) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const prompt = `As an educational expert, suggest a grading rubric for this assignment:

Title: ${assignment.title}
Description: ${assignment.description || 'No description'}
Max Points: ${assignment.max_points || 100}

Create a detailed, fair rubric that breaks down the grading into specific criteria.
Each criterion should have point values and clear expectations.

Output in JSON format:
{
  "criteria": [
    {
      "name": "Criterion Name",
      "points": X,
      "description": "What this evaluates",
      "levels": {
        "excellent": "Description of excellent work (90-100%)",
        "good": "Description of good work (70-89%)",
        "satisfactory": "Description of satisfactory work (50-69%)",
        "needs_improvement": "Description of work needing improvement (<50%)"
      }
    }
  ],
  "totalPoints": ${assignment.max_points || 100}
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        success: true,
        rubric: JSON.parse(jsonMatch[0])
      };
    }
    
    return {
      success: false,
      error: 'Could not generate rubric'
    };
    
  } catch (error) {
    console.error('Error generating rubric:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process a submission for AI grading (main entry point)
 * This is called automatically when a student submits an assignment
 */
async function processSubmissionForGrading(submissionData) {
  try {
    const {
      submissionId,
      assignmentId,
      courseId,
      studentId,
      teacherId,
      submissionText,
      attachments,
      userToken,
      req
    } = submissionData;

    console.log(`🤖 Processing AI grading for submission ${submissionId}...`);

    // Get assignment details
    const assignmentModel = require('../models/assignment.model');
    const assignment = await assignmentModel.getAssignmentById(assignmentId);

    if (!assignment) {
      console.error(`❌ Assignment ${assignmentId} not found for grading`);
      return { success: false, error: 'Assignment not found' };
    }

    // Get AI grading settings for this assignment
    const aiGradingSettingsModel = require('../models/aiGradingSettings.model');
    let settings = await aiGradingSettingsModel.getGradingSettings(assignmentId);

    // If no assignment-specific settings, check teacher's global preferences
    if (!settings || settings.uses_teacher_defaults !== false) {
      const teacherPreferencesModel = require('../models/teacherAIPreferences.model');
      const teacherPrefs = await teacherPreferencesModel.getTeacherPreferences(teacherId);
      
      if (teacherPrefs && teacherPrefs.ai_grading_enabled) {
        // Use teacher's global preferences
        settings = {
          ai_grading_enabled: true,
          grading_mode: teacherPrefs.default_grading_mode,
          ai_instructions: teacherPrefs.default_ai_instructions,
          max_points: assignment.max_points,
          rubric: null,
          uses_teacher_defaults: true
        };
        console.log(`📋 Using teacher's global AI grading preferences (mode: ${settings.grading_mode})`);
      }
    }

    // Check if AI grading is enabled
    if (!settings || !settings.ai_grading_enabled) {
      console.log(`⏭️ AI grading not enabled for assignment ${assignmentId}`);
      return { success: true, skipped: true, reason: 'AI grading not enabled' };
    }

    console.log(`✅ AI grading enabled - Mode: ${settings.grading_mode}`);

    // Extract grading criteria if not already available
    if (!settings.rubric) {
      console.log('📝 Extracting grading criteria from assignment...');
      const criteriaResult = await extractGradingCriteria(assignment, userToken);
      if (criteriaResult.success) {
        settings.rubric = criteriaResult.criteria;
        console.log('✅ Grading criteria extracted');
      }
    }

    // Grade the submission using AI
    console.log('🎯 Grading submission with AI...');
    const gradeResult = await gradeSubmission(
      {
        submission_text: submissionText,
        attachments: attachments
      },
      assignment,
      settings
    );

    if (!gradeResult.success) {
      console.error(`❌ AI grading failed: ${gradeResult.error}`);
      return { success: false, error: gradeResult.error };
    }

    console.log(`✅ AI grade generated: ${gradeResult.grade}/${settings.max_points || assignment.max_points}`);

    // Save the AI-generated grade
    const aiGradeModel = require('../models/aiGrade.model');
    const status = settings.grading_mode === 'auto' ? 'approved' : 'pending';
    
    const savedGrade = await aiGradeModel.createAIGrade({
      submissionId,
      assignmentId,
      studentId,
      teacherId,
      proposedGrade: gradeResult.grade,
      proposedFeedback: gradeResult.feedback,
      aiAnalysis: gradeResult.analysis,
      status
    });

    // If manual approval mode, send email to teacher
    if (settings.grading_mode === 'manual') {
      try {
        const { sendGradingApprovalEmail } = require('./aiGradingEmailService');
        const { getUserById } = require('../models/user.model');
        const courseModel = require('../models/course.model');
        
        const teacher = await getUserById(teacherId);
        const student = await getUserById(studentId);
        const course = await courseModel.getCourseById(assignment.course_id);

        if (teacher && teacher.email) {
          await sendGradingApprovalEmail({
            toEmail: teacher.email,
            teacherName: teacher.name,
            studentName: student.name,
            studentEmail: student.email,
            courseName: course.name,
            assignmentTitle: assignment.title,
            proposedGrade: gradeResult.grade,
            maxPoints: settings.max_points || assignment.max_points,
            proposedFeedback: gradeResult.feedback,
            approvalToken: savedGrade.approval_token,
            submittedAt: new Date()
          });
          console.log(`✅ Manual approval email sent to teacher: ${teacher.email}`);
        }
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
        // Don't fail the grading if email fails
      }
    } else {
      // Auto-approve mode - update submission with grade immediately
      try {
        const submissionModel = require('../models/submission.model');
        await submissionModel.updateSubmission(submissionId, {
          grade: gradeResult.grade,
          feedback: gradeResult.feedback,
          status: 'graded'
        });
        console.log(`✅ Grade auto-approved and applied to submission`);
      } catch (updateError) {
        console.error('❌ Error updating submission with auto-approved grade:', updateError);
      }
    }

    return {
      success: true,
      grade: savedGrade,
      mode: settings.grading_mode,
      status: status
    };

  } catch (error) {
    console.error('❌ Error in processSubmissionForGrading:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  extractGradingCriteria,
  gradeSubmission,
  generateRubricSuggestions,
  processSubmissionForGrading
};

