const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const GRADING_MODEL = process.env.OPENAI_GRADING_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_ATTACHMENT_CHARS = 12000;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

async function generateJsonWithOpenAI(prompt) {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: GRADING_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert educator assistant. Return valid JSON only, without markdown code fences.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  return JSON.parse(content);
}

function parseAttachments(value) {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

function buildAttachmentPath(att) {
  const attachmentUrl = (att.url || '').replace(/^\/+/, '');
  return path.join(__dirname, '..', attachmentUrl);
}

let cachedTextractPromise = null;
function getTextractPromise() {
  if (cachedTextractPromise) {
    return cachedTextractPromise;
  }

  const textract = require('textract');
  const util = require('util');
  cachedTextractPromise = util.promisify(textract.fromFileWithPath);
  return cachedTextractPromise;
}

async function extractTextFromAttachment(att) {
  const filePath = buildAttachmentPath(att);

  if (!filePath || !fs.existsSync(filePath)) {
    return { ok: false, reason: `File not found: ${att.originalName || att.filename || 'unknown'}` };
  }

  let rawText = '';
  if (att.mimetype === 'text/plain' || (att.originalName || '').toLowerCase().endsWith('.txt')) {
    rawText = fs.readFileSync(filePath, 'utf8');
  } else {
    const textractPromise = getTextractPromise();
    rawText = await textractPromise(filePath);
  }

  if (!rawText || !rawText.trim()) {
    return { ok: false, reason: `No readable text in: ${att.originalName || att.filename || 'unknown'}` };
  }

  const trimmed = rawText.trim();
  const wasTruncated = trimmed.length > MAX_ATTACHMENT_CHARS;

  return {
    ok: true,
    text: wasTruncated ? `${trimmed.slice(0, MAX_ATTACHMENT_CHARS)}\n[...truncated...]` : trimmed,
    originalLength: trimmed.length,
    wasTruncated
  };
}

async function buildAttachmentTextBlock(attachments, sectionTitle) {
  if (!attachments.length) {
    return '';
  }

  let block = `\n**${sectionTitle}:**\n`;

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    const name = att.originalName || att.filename || `Attachment ${i + 1}`;
    block += `\n--- File ${i + 1}: ${name} ---\n`;

    try {
      const extraction = await extractTextFromAttachment(att);
      if (!extraction.ok) {
        console.log(`WARN  ${extraction.reason}`);
        block += `(${extraction.reason})\n`;
      } else {
        block += `${extraction.text}\n`;
        console.log(`INFO  Read ${name} (${extraction.originalLength} chars${extraction.wasTruncated ? ', truncated' : ''})`);
      }
    } catch (error) {
      console.log(`WARN  Error reading file ${name}: ${error.message}`);
      block += `(Error reading file: ${name})\n`;
    }

    block += `--- End of File ${i + 1} ---\n`;
  }

  return block;
}

/**
 * AI Grading Service
 * Handles AI-powered grading of student submissions
 */

/**
 * Extract grading criteria from assignment description and files
 */
async function extractGradingCriteria(assignment, userToken = null) {
  try {
    let prompt = `You are an expert educator. Analyze this assignment and extract the grading criteria, rubric, and expectations.

Assignment Title: ${assignment.title}
Description: ${assignment.description || 'No description provided'}
Max Points: ${assignment.max_points || 100}
`;

    const attachments = parseAttachments(assignment.attachments);
    prompt += await buildAttachmentTextBlock(attachments, 'ASSIGNMENT INSTRUCTIONS FROM ATTACHED DOCUMENTS');

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

    const extractedCriteria = await generateJsonWithOpenAI(prompt);
    return {
      success: true,
      criteria: extractedCriteria,
      rawText: JSON.stringify(extractedCriteria)
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

**STUDENT SUBMISSION TEXT:**
${submission.submission_text || 'No text provided'}
`;

    const submissionAttachments = parseAttachments(submission.attachments);

    if (submissionAttachments.length > 0) {
      prompt += `\n**Student uploaded ${submissionAttachments.length} file(s):**\n`;
      submissionAttachments.forEach((att, i) => {
        const sizeKb = att.size ? (att.size / 1024).toFixed(2) : '0.00';
        prompt += `${i + 1}. ${att.originalName || att.filename || 'Unnamed file'} (${sizeKb} KB)\n`;
      });
      prompt += await buildAttachmentTextBlock(submissionAttachments, 'EXTRACTED CONTENT FROM STUDENT ATTACHMENTS');
    }

    prompt += `\n**YOUR TASK:**
Grade this submission based on the criteria provided. Use the submission text and extracted attachment content as the primary evidence. Provide:

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

    const gradeData = await generateJsonWithOpenAI(prompt);
    return {
      success: true,
      grade: gradeData.grade,
      feedback: gradeData.feedback,
      analysis: gradeData,
      rawResponse: JSON.stringify(gradeData)
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

    const rubric = await generateJsonWithOpenAI(prompt);
    return {
      success: true,
      rubric
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

    console.log(`INFO  Processing AI grading for submission ${submissionId}...`);

    const assignmentModel = require('../models/assignment.model');
    const assignment = await assignmentModel.getAssignmentById(assignmentId);

    if (!assignment) {
      console.error(`ERROR Assignment ${assignmentId} not found for grading`);
      return { success: false, error: 'Assignment not found' };
    }

    const aiGradingSettingsModel = require('../models/aiGradingSettings.model');
    let settings = await aiGradingSettingsModel.getGradingSettings(assignmentId);

    if (!settings || settings.uses_teacher_defaults !== false) {
      const teacherPreferencesModel = require('../models/teacherAIPreferences.model');
      const teacherPrefs = await teacherPreferencesModel.getTeacherPreferences(teacherId);

      if (teacherPrefs && teacherPrefs.ai_grading_enabled) {
        settings = {
          ai_grading_enabled: true,
          grading_mode: teacherPrefs.default_grading_mode,
          ai_instructions: teacherPrefs.default_ai_instructions,
          max_points: assignment.max_points,
          rubric: null,
          uses_teacher_defaults: true
        };
        console.log(`INFO  Using teacher's global AI grading preferences (mode: ${settings.grading_mode})`);
      }
    }

    if (!settings || !settings.ai_grading_enabled) {
      console.log(`INFO  AI grading not enabled for assignment ${assignmentId}`);
      return { success: true, skipped: true, reason: 'AI grading not enabled' };
    }

    console.log(`INFO  AI grading enabled - Mode: ${settings.grading_mode}`);

    if (!settings.rubric) {
      console.log('INFO  Extracting grading criteria from assignment...');
      const criteriaResult = await extractGradingCriteria(assignment, userToken);
      if (criteriaResult.success) {
        settings.rubric = criteriaResult.criteria;
        console.log('INFO  Grading criteria extracted');
      }
    }

    console.log('INFO  Grading submission with AI...');
    const gradeResult = await gradeSubmission(
      {
        submission_text: submissionText,
        attachments: attachments
      },
      assignment,
      settings
    );

    if (!gradeResult.success) {
      console.error(`ERROR AI grading failed: ${gradeResult.error}`);
      return { success: false, error: gradeResult.error };
    }

    console.log(`INFO  AI grade generated: ${gradeResult.grade}/${settings.max_points || assignment.max_points}`);

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
          console.log(`INFO  Manual approval email sent to teacher: ${teacher.email}`);
        }
      } catch (emailError) {
        console.error('ERROR Error sending approval email:', emailError);
      }
    } else {
      try {
        const submissionModel = require('../models/submission.model');
        const { getUserById } = require('../models/user.model');
        const courseModel = require('../models/course.model');
        const { sendGradeNotificationEmail, sendTeacherGradeNotificationEmail } = require('./gradeNotificationEmailService');

        await submissionModel.updateSubmission(submissionId, {
          grade: gradeResult.grade,
          feedback: gradeResult.feedback,
          status: 'graded'
        });
        console.log('INFO  Grade auto-approved and applied to submission');

        const [teacher, student, course] = await Promise.all([
          getUserById(teacherId),
          getUserById(studentId),
          courseModel.getCourseById(assignment.course_id)
        ]);

        if (student && student.email) {
          await sendGradeNotificationEmail({
            toEmail: student.email,
            studentName: student.name,
            courseName: course ? course.name : 'Your Course',
            assignmentTitle: assignment.title,
            grade: gradeResult.grade,
            maxPoints: settings.max_points || assignment.max_points,
            feedback: gradeResult.feedback,
            assignmentId: assignment.id
          });
          console.log(`INFO  Grade email sent to student: ${student.email}`);
        }

        if (teacher && teacher.email) {
          await sendTeacherGradeNotificationEmail({
            toEmail: teacher.email,
            teacherName: teacher.name,
            studentName: student ? student.name : 'Student',
            studentEmail: student ? student.email : 'N/A',
            courseName: course ? course.name : 'Unknown Course',
            assignmentTitle: assignment.title,
            grade: gradeResult.grade,
            maxPoints: settings.max_points || assignment.max_points,
            feedback: gradeResult.feedback,
            assignmentId: assignment.id
          });
          console.log(`INFO  Grade email sent to teacher: ${teacher.email}`);
        }
      } catch (updateError) {
        console.error('ERROR Error updating submission with auto-approved grade:', updateError);
      }
    }

    return {
      success: true,
      grade: savedGrade,
      mode: settings.grading_mode,
      status: status
    };

  } catch (error) {
    console.error('ERROR Error in processSubmissionForGrading:', error);
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
