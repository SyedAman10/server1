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
async function extractGradingCriteria(assignment) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    let prompt = `You are an expert educator. Analyze this assignment and extract the grading criteria, rubric, and expectations.

Assignment Title: ${assignment.title}
Description: ${assignment.description || 'No description provided'}
Max Points: ${assignment.max_points || 100}
`;

    // If assignment has attachments (instructions file), mention it
    const attachments = assignment.attachments ? 
      (typeof assignment.attachments === 'string' ? JSON.parse(assignment.attachments) : assignment.attachments) : [];
    
    if (attachments.length > 0) {
      prompt += `\nThe assignment includes ${attachments.length} attachment(s) with instructions.\n`;
      attachments.forEach((att, i) => {
        prompt += `File ${i + 1}: ${att.originalName}\n`;
      });
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
    let settings = await aiGradingSettingsModel.getSettings(assignmentId);

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
      const criteriaResult = await extractGradingCriteria(assignment);
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
    const status = settings.grading_mode === 'auto_approve' ? 'approved' : 'pending';
    
    const savedGrade = await aiGradeModel.createGrade({
      submissionId,
      assignmentId,
      studentId,
      aiGrade: gradeResult.grade,
      aiFeedback: gradeResult.feedback,
      aiAnalysis: gradeResult.analysis,
      status,
      reviewedBy: settings.grading_mode === 'auto_approve' ? teacherId : null,
      reviewedAt: settings.grading_mode === 'auto_approve' ? new Date() : null
    });

    // If manual approval mode, send email to teacher
    if (settings.grading_mode === 'manual_approve') {
      try {
        const { sendEmail } = require('./emailService');
        const { getUserById } = require('../models/user.model');
        const courseModel = require('../models/course.model');
        
        const teacher = await getUserById(teacherId);
        const student = await getUserById(studentId);
        const course = await courseModel.getCourseById(courseId);

        if (teacher && teacher.email) {
          const approveUrl = `https://class.xytek.ai/api/ai-grading/grades/${savedGrade.id}/approve`;
          const rejectUrl = `https://class.xytek.ai/api/ai-grading/grades/${savedGrade.id}/reject`;
          
          const emailSubject = `🤖 AI Grade Ready for Review: ${assignment.title}`;
          const emailBody = `
            <h2>🤖 AI-Generated Grade Pending Approval</h2>
            <p>The AI has graded a student submission and is awaiting your review:</p>
            
            <h3>📚 Assignment Details:</h3>
            <ul>
              <li><strong>Course:</strong> ${course.name}</li>
              <li><strong>Assignment:</strong> ${assignment.title}</li>
              <li><strong>Student:</strong> ${student.name} (${student.email})</li>
              <li><strong>Submitted:</strong> ${new Date().toLocaleString()}</li>
            </ul>
            
            <h3>🎯 AI-Generated Grade:</h3>
            <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p style="font-size: 24px; margin: 0;"><strong>${gradeResult.grade} / ${settings.max_points || assignment.max_points}</strong></p>
              <p style="margin: 5px 0;">(${Math.round((gradeResult.grade / (settings.max_points || assignment.max_points)) * 100)}%)</p>
            </div>
            
            <h3>💬 AI Feedback:</h3>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p>${gradeResult.feedback}</p>
            </div>
            
            ${gradeResult.analysis?.breakdown ? `
            <h3>📊 Grade Breakdown:</h3>
            <ul>
              ${Object.entries(gradeResult.analysis.breakdown).map(([criterion, data]) => `
                <li><strong>${criterion}:</strong> ${data.score}/${data.maxScore} - ${data.comment}</li>
              `).join('')}
            </ul>
            ` : ''}
            
            <h3>✅ Review Actions:</h3>
            <p>Please review this AI-generated grade and choose an action:</p>
            <div style="margin: 20px 0;">
              <a href="${approveUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">✅ Approve Grade</a>
              <a href="${rejectUrl}" style="background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">❌ Reject & Grade Manually</a>
            </div>
            
            <p><a href="https://class.xytek.ai/assignments/${assignmentId}">View full submission and grade details</a></p>
            
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              <strong>Note:</strong> This grade was automatically generated by AI. Please review it carefully before approving.
              You can modify the grade or provide your own feedback if needed.
            </p>
          `;
          
          await sendEmail(teacher.email, emailSubject, emailBody);
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

